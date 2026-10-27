import { PLANS, cors, json, blocked, authenticate, bump } from './_lib.js';
export const config = { runtime: 'edge' };

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// v:1 means the model can read images
const M = {
  groq70:  { p: 'groq',   id: 'llama-3.3-70b-versatile' },
  groqVis: { p: 'groq',   id: 'meta-llama/llama-4-scout-17b-16e-instruct', v: 1 },
  g38:     { p: 'gemini', id: 'gemini-3.8-flash', v: 1, effort: 'low' },
  g38deep: { p: 'gemini', id: 'gemini-3.8-flash', v: 1, effort: 'medium' },
  g35:     { p: 'gemini', id: 'gemini-3.5-flash', v: 1 },
  g35lite: { p: 'gemini', id: 'gemini-3.5-flash-lite', v: 1 },
  g31lite: { p: 'gemini', id: 'gemini-3.1-flash-lite-preview', v: 1 }
};
// Order = who answers first. If one is busy, the next one takes over.
const CHAINS = {
  free:  [M.groq70, M.groqVis, M.g35lite, M.g31lite],
  pro:   [M.g38, M.groq70, M.groqVis, M.g35lite],
  elite: [M.g38deep, M.g35, M.groq70, M.groqVis]
};
const PER_MODEL_MS = 9000;
const TOTAL_MS = 22000;

const hasImages = msgs => msgs.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);

  const a = await authenticate(req, h);
  if (a.fail) return a.fail;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  let messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) return json({ error: 'messages required' }, 400, h);
  messages = messages.slice(-30);

  const system =
    "You are Perses, a helpful, accurate and friendly AI assistant. Reply in Markdown. " +
    "Put all code in fenced code blocks with the language name. Be concise unless asked for detail." +
    (a.username ? ` The user's name is ${a.username}.` : '');

  let list = CHAINS[a.plan] || CHAINS.free;
  if (hasImages(messages)) list = list.filter(m => m.v);

  const started = Date.now();
  const errs = [];
  const limit = PLANS[a.plan].msgs;

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
        const ok = await bump(a.uid, 'msgs', limit);
        if (ok === false) {
          try { await up.body.cancel(); } catch {}
          return json({ error: `You've used all ${limit} messages for today on your plan. Upgrade for more, or come back tomorrow.`, code: 'limit' }, 429, h);
        }
        if (ok === null) {
          try { await up.body.cancel(); } catch {}
          return json({ error: 'Usage service error. Check the Supabase setup (SQL + SUPABASE_SERVICE_KEY).' }, 500, h);
        }
        return new Response(up.body, {
          headers: { ...h, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Perses-Model': m.id }
        });
      }
      const t = await up.text();
      errs.push(`${m.id} ${up.status}: ${t.replace(/\s+/g, ' ').slice(0, 90)}`);
    } catch (e) {
      clearTimeout(timer);
      errs.push(`${m.id}: ${e.name === 'AbortError' ? 'too slow' : 'network error'}`);
    }
  }
  return json({ error: 'The AI is very busy right now. Please try again in a minute. (' + errs.join(' | ').slice(0, 420) + ')' }, 503, h);
}
