import { cors, json, blocked, authenticate, consume, limitResponse, buildSystem } from './_lib.js';
export const config = { runtime: 'edge' };

/* ---------- providers: separate companies, so they are rarely down together ---------- */
const PROV = {
  groq:   { url: () => 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY },
  gemini: { url: () => 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: () => process.env.GEMINI_API_KEY },
  cf:     { url: () => `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`, key: () => (process.env.CF_ACCOUNT_ID ? process.env.CF_API_TOKEN : '') },
  or:     { url: () => 'https://openrouter.ai/api/v1/chat/completions', key: () => process.env.OPENROUTER_API_KEY }
};

/* ---------- models (v:1 = can read images). If a name stops working, change it here. ---------- */
const M = {
  groq120: { p: 'groq', id: 'openai/gpt-oss-120b', effort: 'low' },
  groq20:  { p: 'groq', id: 'openai/gpt-oss-20b', effort: 'low' },
  cf120:   { p: 'cf', id: '@cf/openai/gpt-oss-120b', effort: 'low' },
  cf20:    { p: 'cf', id: '@cf/openai/gpt-oss-20b', effort: 'low' },
  cfQwen:  { p: 'cf', id: '@cf/qwen/qwen3.8-27b', v: 1 },
  cfGlm:   { p: 'cf', id: '@cf/zai-org/glm-4.7-flash' },
  g38:     { p: 'gemini', id: 'gemini-3.8-flash', v: 1, effort: 'low' },
  g38deep: { p: 'gemini', id: 'gemini-3.8-flash', v: 1, effort: 'medium' },
  g35:     { p: 'gemini', id: 'gemini-3.5-flash', v: 1 },
  g35lite: { p: 'gemini', id: 'gemini-3.5-flash-lite', v: 1 },
  g31lite: { p: 'gemini', id: 'gemini-3.1-flash-lite-preview', v: 1 }
};
// Optional last resort (only used if OPENROUTER_API_KEY is set). Change with the OPENROUTER_MODELS variable.
const OR_MODELS = (process.env.OPENROUTER_MODELS || 'openai/gpt-oss-120b:free,openai/gpt-oss-20b:free')
  .split(',').map(s => s.trim()).filter(Boolean).map(id => ({ p: 'or', id }));

// Order = preference. Others start automatically if one is slow or failing.
const CHAINS = {
  free:  [M.groq120, M.g35lite, M.cf120, M.groq20, M.g31lite, M.cf20, M.cfQwen, M.cfGlm, ...OR_MODELS],
  pro:   [M.g38, M.groq120, M.cf120, M.g35lite, M.groq20, M.cf20, M.g31lite, M.cfQwen, M.cfGlm, ...OR_MODELS],
  elite: [M.g38deep, M.g35, M.groq120, M.cf120, M.g35lite, M.groq20, M.cfQwen, M.cf20, M.g31lite, M.cfGlm, ...OR_MODELS]
};
const STAGGER_MS = 3000;   // start the next model if the current one has not answered after this long
const TOTAL_MS = 23000;
const TOTAL_LONG_MS = 24000;

const cool = new Map();    // models that just failed are skipped for a short while
const hasImages = msgs => msgs.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
const sseOf = t => 'data: ' + JSON.stringify({ choices: [{ delta: { content: t } }] }) + '\n\ndata: [DONE]\n\n';

function prepare(plan, needVision, longCtx) {
  let list = (CHAINS[plan] || CHAINS.free).filter(m => PROV[m.p].key());
  if (needVision) list = list.filter(m => m.v);
  if (longCtx) list = list.filter(m => m.p === 'gemini' || m.p === 'cf');   // big documents need long-context models
  const now = Date.now();
  const warm = list.filter(m => !(cool.get(m.p + m.id) > now));
  list = warm.length ? warm : list;
  if (plan === 'free' && list.length > 1 && Math.random() < 0.5) [list[0], list[1]] = [list[1], list[0]];   // spread the load
  return list;
}

function makeAttempt(system, messages) {
  return async (m, signal) => {
    const p = PROV[m.p];
    const base = { model: m.id, stream: true, messages: [{ role: 'system', content: system }, ...messages] };
    const bodies = m.effort ? [{ ...base, reasoning_effort: m.effort }, base] : [base];
    for (const b of bodies) {
      const r = await fetch(p.url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + p.key() },
        body: JSON.stringify(b),
        signal
      });
      if (r.ok) return { ok: true, body: r.body };
      const t = await r.text();
      if (r.status === 400 && b.reasoning_effort) continue;      // retry without the reasoning setting
      return { ok: false, err: r.status + ' ' + t.replace(/\s+/g, ' ').slice(0, 70) };
    }
    return { ok: false, err: '400 rejected' };
  };
}

// Starts models one after another (every STAGGER_MS), or immediately when one fails. First good answer wins.
function race(list, attempt, staggerMs, totalMs) {
  return new Promise(resolve => {
    const errs = [], ctls = [];
    let done = false, next = 0, failed = 0, timer = 0, dead = 0;
    const end = v => { done = true; clearTimeout(timer); clearTimeout(dead); resolve(v); };
    const fail = (i, why) => {
      if (done) return;
      errs.push(`${list[i].id}: ${why}`); failed++;
      const k = list[i].p + list[i].id;
      if (/^404/.test(why)) cool.set(k, Date.now() + 600000);
      else if (/^(429|5\d\d)|slow|network/.test(why)) cool.set(k, Date.now() + 45000);
      if (next < list.length) launch();
      else if (failed >= list.length) end({ ok: false, errs });
    };
    const launch = () => {
      if (done || next >= list.length) return;
      clearTimeout(timer);
      const i = next++, ctl = new AbortController();
      ctls[i] = ctl;
      attempt(list[i], ctl.signal).then(r => {
        if (done) { try { r.body && r.body.cancel(); } catch {} return; }
        if (r.ok) { ctls.forEach((c, j) => { if (j !== i) c.abort(); }); end({ ok: true, res: r, model: list[i] }); }
        else fail(i, r.err);
      }).catch(e => fail(i, e.name === 'AbortError' ? 'too slow' : 'network error'));
      timer = setTimeout(launch, staggerMs);
    };
    dead = setTimeout(() => {
      if (done) return;
      ctls.forEach(c => c.abort());
      end({ ok: false, errs: errs.concat('timeout') });
    }, totalMs);
    launch();
  });
}

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

  // Extra context from the app (project rules, documents). Plugins send this in "context".
  const ctx = typeof body.context === 'string' ? body.context.slice(0, 320000) : '';
  const longCtx = ctx.length > 15000;
  let system = buildSystem(a, body.mode);
  if (ctx) system += '\n\nEXTRA CONTEXT FROM THE USER (project rules, documents). Use it when relevant:\n' + ctx;
  if (body.voice === true) system += '\n\nVOICE MODE: The user is talking with you out loud. Reply in 1 to 3 short, natural spoken sentences. No markdown, lists, code or emojis.';

  const sseHeaders = { ...h, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' };
  const usageFail = async (ok, res) => {
    if (res) { try { await res.body.cancel(); } catch {} }
    return ok === false ? limitResponse(a, 'msgs', h) : json({ error: 'Usage service error. Check the Supabase setup (SQL + SUPABASE_SERVICE_KEY).' }, 500, h);
  };
  const started = Date.now();
  const totalMs = longCtx ? TOTAL_LONG_MS : TOTAL_MS;

  // 1) Web search mode (logged-in users)
  if (body.search === true && !a.guest) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 11000);
    let text = null;
    try { text = await searchReply(system, messages, ctl.signal); } catch {}
    clearTimeout(t);
    if (text) {
      const ok = await consume(a, 'msgs');
      if (ok !== true) return usageFail(ok);
      return new Response(sseOf(text), { headers: sseHeaders });
    }
  }

  // 2) Normal chat: several providers, racing, first good answer wins
  const list = prepare(a.plan, hasImages(messages), longCtx);
  if (!list.length) return json({ error: 'No AI engine is set up on the server yet.', detail: 'Add GROQ_API_KEY, GEMINI_API_KEY or CF_ACCOUNT_ID + CF_API_TOKEN in Vercel.', code: 'busy' }, 503, h);

  const out = await race(list, makeAttempt(system, messages), STAGGER_MS, Math.max(6000, totalMs - (Date.now() - started)));
  if (!out.ok) {
    return json({ error: 'Perses is very busy right now. Please try again in a moment.', detail: out.errs.join(' | ').slice(0, 700), code: 'busy' }, 503, h);
  }
  const ok = await consume(a, 'msgs');
  if (ok !== true) return usageFail(ok, out.res);
  return new Response(out.res.body, { headers: sseHeaders });
}
