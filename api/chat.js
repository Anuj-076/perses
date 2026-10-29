import { cors, json, blocked, authenticate, consume, limitResponse, buildSystem, logAi, rest, featureOff } from './_lib.js';
import { prepare, makeAttempt, race, tee } from './_engines.js';
export const config = { runtime: 'edge' };

const STAGGER_MS = 3000, TOTAL_MS = 23000, TOTAL_LONG_MS = 24000;
const hasImages = msgs => msgs.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
const sseOf = t => 'data: ' + JSON.stringify({ choices: [{ delta: { content: t } }] }) + '\n\ndata: [DONE]\n\n';
async function sha1(s) { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

async function searchReply(system, messages, signal) {
  const key = process.env.GEMINI_API_KEY; if (!key) return null;
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: typeof m.content === 'string' ? [{ text: m.content || ' ' }] : m.content.map(p => { if (p.type === 'text') return { text: p.text }; const mt = /^data:(.+?);base64,(.+)$/.exec(p.image_url?.url || ''); return mt ? { inlineData: { mimeType: mt[1], data: mt[2] } } : { text: ' ' }; }) }));
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: [{ google_search: {} }] }), signal });
  if (!r.ok) return null;
  const d = await r.json(), c = d.candidates?.[0], text = (c?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) return null;
  const seen = new Set(); let src = '';
  for (const g of c.groundingMetadata?.groundingChunks || []) { const u = g.web?.uri; if (u && !seen.has(u)) { seen.add(u); src += `\n${seen.size}. [${String(g.web.title || u).replace(/[\[\]]/g, '')}](${u})`; } }
  return text + (src ? `\n\n**Sources**${src}` : '');
}

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, true);
  if (a.fail) return a.fail;

  let body; try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  let messages = body.messages;
  if (!Array.isArray(messages) || !messages.length) return json({ error: 'messages required' }, 400, h);
  messages = messages.slice(-30).map((m, i, arr) => (i < arr.length - 6 && typeof m.content === 'string' && m.content.length > 700) ? { ...m, content: m.content.slice(0, 500) + ' ...[trimmed]' } : m);

  const kill = a.cfg.s.kill || {};
  const ctx = typeof body.context === 'string' ? body.context.slice(0, 320000) : '';
  const longCtx = ctx.length > 15000, voice = body.voice === true && !kill.voice;
  if (kill.chat) return featureOff(h, 'Chat is temporarily switched off. Please try again later.');
  if (longCtx && kill.docs) return featureOff(h, 'Reading documents is temporarily switched off.');
  if (body.search && kill.search) return featureOff(h, 'Web search is temporarily switched off.');

  let system = buildSystem(a, body.mode);
  if (ctx) system += '\n\nEXTRA CONTEXT FROM THE USER (project rules, documents, exam settings). Use it when relevant:\n' + ctx;
  if (voice) system += '\n\nVOICE MODE: The user is talking with you out loud. Reply in 1 to 3 short, natural spoken sentences. No markdown, lists, code or emojis.';

  const rid = crypto.randomUUID().slice(0, 8), t0 = Date.now();
  const feats = [body.search && 'search', voice && 'voice', /DOCUMENTS ATTACHED/.test(ctx) && 'docs', /^PROJECT /.test(ctx) && 'project'].filter(Boolean).join(',');
  const lg = { rid, uid: a.uid || null, gk: a.gk || null, ih: a.ih, plan: a.plan, country: a.country || null, mode: body.mode || 'default', tag: body.tag || null, feat: feats || null };
  const sse = { ...h, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Rid': rid };
  const usageFail = async (ok, res) => { if (res) { try { await res.body.cancel(); } catch {} } return ok === false ? limitResponse(a, 'msgs', h) : json({ error: 'Usage service error. Check the Supabase setup.' }, 500, h); };

  if (body.search === true && !a.guest) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 11000); let text = null;
    try { text = await searchReply(system, messages, ctl.signal); } catch {}
    clearTimeout(t);
    if (text) {
      const ok = await consume(a, 'msgs'); if (ok !== true) return usageFail(ok);
      await logAi([{ ...lg, kind: 'search', eng: 'gemini', model: 'search', ok: true, ms: Date.now() - t0 }]);
      return new Response(sseOf(text), { headers: sse });
    }
  }

  const one = messages.length === 1 && typeof messages[0].content === 'string' && messages[0].content.length < 400;
  const cacheable = one && !ctx && !body.search && !voice && !body.regen && !(a.cfg.s.cache || {}).off;
  let ckey = '';
  if (cacheable) {
    try {
      ckey = await sha1([body.mode, a.display_name, a.memory, a.age != null && a.age < 18 ? 'minor' : '', messages[0].content].join('|'));
      const r = await rest(`ai_cache?h=eq.${ckey}&select=answer,ts`); const row = r.ok ? (await r.json())[0] : null;
      if (row && Date.now() - new Date(row.ts) < 259200000) {
        const ok = await consume(a, 'msgs'); if (ok !== true) return usageFail(ok);
        await logAi([{ ...lg, kind: 'chat', eng: 'cache', model: 'cache', ok: true, ms: Date.now() - t0 }]);
        return new Response(sseOf(row.answer), { headers: sse });
      }
    } catch {}
  }

  const list = prepare(a.plan, hasImages(messages), longCtx, a.cfg);
  if (!list.length) return json({ error: 'No AI engine is available right now.', detail: 'No engine has a key, or all are switched off in the admin dashboard.', code: 'busy' }, 503, h);
  const out = await race(list, makeAttempt(system, messages), STAGGER_MS, Math.max(6000, (longCtx ? TOTAL_LONG_MS : TOTAL_MS) - (Date.now() - t0)));
  const failRows = out.fails.map(f => ({ ...lg, kind: 'chat', eng: f.m.p, model: f.m.id, ok: false, ms: f.ms, err: f.why.slice(0, 80) }));
  if (!out.ok) {
    await logAi([...failRows, { ...lg, kind: 'chat', eng: 'ALL', ok: false, ms: Date.now() - t0, err: 'all engines failed' }]);
    return json({ error: 'Perses is very busy right now. Please try again in a moment.', detail: out.fails.map(f => `${f.m.id}: ${f.why}`).join(' | ').slice(0, 700), code: 'busy' }, 503, h);
  }
  const ok = await consume(a, 'msgs'); if (ok !== true) return usageFail(ok, out.res);
  await logAi([...failRows, { ...lg, kind: 'chat', eng: out.model.p, model: out.model.id, ok: true, ms: Date.now() - t0 }]);
  const stream = tee(out.res.body, text => {
    if (cacheable && ckey && text.length > 20 && text.length < 6000) rest('ai_cache?on_conflict=h', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ h: ckey, answer: text, ts: new Date().toISOString() }) }).catch(() => {});
  });
  return new Response(stream, { headers: sse });
}
