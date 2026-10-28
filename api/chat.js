import { cors, json, blocked, authenticate, consume, limitResponse, buildSystem } from './_lib.js';
export const config = { runtime: 'edge' };

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const M = {
  groq70:  { p: 'groq',   id: 'llama-3.3-70b-versatile' },
  groqVis: { p: 'groq',   id: 'meta-llama/llama-4-scout-17b-16e-instruct', v: 1 },
  g38:     { p: 'gemini', id: 'gemini-3.8-flash', v: 1, effort: 'low' },
  g38deep: { p: 'gemini', id: 'gemini-3.8-flash', v: 1, effort: 'medium' },
  g35:     { p: 'gemini', id: 'gemini-3.5-flash', v: 1 },
  g35lite: { p: 'gemini', id: 'gemini-3.5-flash-lite', v: 1 },
  g31lite: { p: 'gemini', id: 'gemini-3.1-flash-lite-preview', v: 1 }
};
const CHAINS = {
  free:  [M.groq70, M.groqVis, M.g35lite, M.g31lite],
  pro:   [M.g38, M.groq70, M.groqVis, M.g35lite],
  elite: [M.g38deep, M.g35, M.groq70, M.groqVis]
};
const PER_MODEL_MS = 9000;
const TOTAL_MS = 23000;

const hasImages = msgs => msgs.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
const sseOf = t => 'data: ' + JSON.stringify({ choices: [{ delta: { content: t } }] }) + '\n\ndata: [DONE]\n\n';

// Web search through Gemini's built-in Google Search tool. Returns text with sources, or null.
async function searchReply(system, messages, signal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: typeof m.content === 'string' ? [{ text: m.content || ' ' }]
      : m.content.map(p => {
          if (p.type === 'text') return { text: p.text };
          const mt = /^data:(.+?);base64,(.+)$/.exec(p.image_url?.url || '');
          return mt ? { inlineData: { mimeType: mt[1], data: mt[2] } } : { text: ' ' };
        })
  }));
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: [{ google_search: {} }] }),
    signal
  });
  if (!r.ok) return null;
  const d = await r.json();
  const c = d.candidates?.[0];
  const text = (c?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) return null;
  const seen = new Set();
  let src = '';
  for (const g of c.groundingMetadata?.groundingChunks || []) {
    const u = g.web?.uri;
    if (u && !seen.has(u)) { seen.add(u); src += `\n${seen.size}. [${String(g.web.title || u).replace(/[\[\]]/g, '')}](${u})`; }
  }
  return text + (src ? `\n\n**Sources**${src}` : '');
}

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);

  const a = await authenticate(req, h, true);
  if (a.fail) return a.fail;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  let messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) return json({ error: 'messages required' }, 400, h);
  messages = messages.slice(-30);

  const system = buildSystem(a, body.mode);
  const started = Date.now();
  const sseHeaders = { ...h, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' };
  const usageFail = async (ok, up) => {
    if (up) { try { await up.body.cancel(); } catch {} }
    return ok === false ? limitResponse(a, 'msgs', h) : json({ error: 'Usage service error. Check the Supabase setup (SQL + SUPABASE_SERVICE_KEY).' }, 500, h);
  };

  // 1) Web search mode (logged-in users)
  if (body.search === true && !a.guest) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 13000);
    let text = null;
    try { text = await searchReply(system, messages, ctl.signal); } catch {}
    clearTimeout(t);
    if (text) {
      const ok = await consume(a, 'msgs');
      if (ok !== true) return usageFail(ok);
      return new Response(sseOf(text), { headers: sseHeaders });
    }
  }

  // 2) Normal chat with backups
  let list = CHAINS[a.plan] || CHAINS.free;
  if (hasImages(messages)) list = list.filter(m => m.v);
  const errs = [];

  for (const m of list) {
    const left = TOTAL_MS - (Date.now() - started);
    if (left < 2500) break;
    const key = m.p === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;
    if (!key) { errs.push(m.p + ': key missing'); continue; }

    const payload = { model: m.id, stream: true, messages: [{ role: 'system', content: system }, ...messages] };
    if (m.p === 'gemini' && m.effort) payload.reasoning_effort = m.effort;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(PER_MODEL_MS, left));
    try {
      const up = await fetch(m.p === 'groq' ? GROQ_URL : GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify(payload),
        signal: ctl.signal
      });
      clearTimeout(timer);
      if (up.ok) {
        const ok = await consume(a, 'msgs');
        if (ok !== true) return usageFail(ok, up);
        return new Response(up.body, { headers: { ...sseHeaders, 'X-Perses-Model': m.id } });
      }
      const t = await up.text();
      errs.push(`${m.id} ${up.status}: ${t.replace(/\s+/g, ' ').slice(0, 80)}`);
    } catch (e) {
      clearTimeout(timer);
      errs.push(`${m.id}: ${e.name === 'AbortError' ? 'too slow' : 'network error'}`);
    }
  }
  return json({ error: 'Perses is very busy right now. Please try again in a minute. (' + errs.join(' | ').slice(0, 400) + ')' }, 503, h);
}
