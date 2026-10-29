import { rest, alertAdmin, logAi } from './_lib.js';

export const PROV = {
  groq:   { url: () => 'https://api.groq.com/openai/v1/chat/completions', key: () => process.env.GROQ_API_KEY },
  gemini: { url: () => 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: () => process.env.GEMINI_API_KEY },
  cf:     { url: () => `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`, key: () => (process.env.CF_ACCOUNT_ID ? process.env.CF_API_TOKEN : '') },
  or:     { url: () => 'https://openrouter.ai/api/v1/chat/completions', key: () => process.env.OPENROUTER_API_KEY }
};
// v:1 = can read images. If a model name stops working, change it here (or switch it off in the admin dashboard).
export const M = {
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
const OR_MODELS = (process.env.OPENROUTER_MODELS || 'openai/gpt-oss-120b:free,openai/gpt-oss-20b:free').split(',').map(s => s.trim()).filter(Boolean).map(id => ({ p: 'or', id }));
export const CHAINS = {
  free:  [M.groq120, M.g35lite, M.cf120, M.groq20, M.g31lite, M.cf20, M.cfQwen, M.cfGlm, ...OR_MODELS],
  pro:   [M.g38, M.groq120, M.cf120, M.g35lite, M.groq20, M.cf20, M.g31lite, M.cfQwen, M.cfGlm, ...OR_MODELS],
  elite: [M.g38deep, M.g35, M.groq120, M.cf120, M.g35lite, M.groq20, M.cfQwen, M.cf20, M.g31lite, M.cfGlm, ...OR_MODELS]
};
export const mid = m => m.p + ':' + m.id;
export function allModels() { const seen = new Set(), out = []; for (const c of Object.values(CHAINS)) for (const m of c) if (!seen.has(mid(m)) && PROV[m.p].key()) { seen.add(mid(m)); out.push(m); } return out; }

const cool = new Map();
export function prepare(plan, needVision, longCtx, cfg) {
  const e = (cfg && cfg.s && cfg.s.engines) || {}, offs = new Set(e.off || []);
  let list = (CHAINS[plan] || CHAINS.free).filter(m => PROV[m.p].key() && !offs.has(mid(m)));
  if (needVision) list = list.filter(m => m.v);
  if (longCtx) list = list.filter(m => m.p === 'gemini' || m.p === 'cf');
  const ord = e.order && e.order[plan];
  if (ord && ord.length) list = [...list].sort((a, b) => { const x = ord.indexOf(mid(a)), y = ord.indexOf(mid(b)); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); });
  const now = Date.now(), warm = list.filter(m => !(cool.get(mid(m)) > now));
  list = warm.length ? warm : list;
  if (plan === 'free' && !(ord && ord.length) && list.length > 1 && Math.random() < 0.5) [list[0], list[1]] = [list[1], list[0]];
  return list;
}

export function makeAttempt(system, messages) {
  return async (m, signal) => {
    const p = PROV[m.p];
    const base = { model: m.id, stream: true, messages: [{ role: 'system', content: system }, ...messages] };
    for (const b of (m.effort ? [{ ...base, reasoning_effort: m.effort }, base] : [base])) {
      const r = await fetch(p.url(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + p.key() }, body: JSON.stringify(b), signal });
      if (r.ok) return { ok: true, body: r.body };
      const t = await r.text();
      if (r.status === 400 && b.reasoning_effort) continue;
      return { ok: false, err: r.status + ' ' + t.replace(/\s+/g, ' ').slice(0, 70) };
    }
    return { ok: false, err: '400 rejected' };
  };
}

// Starts a model every staggerMs (or at once when one fails). The first good answer wins.
export function race(list, attempt, staggerMs, totalMs) {
  return new Promise(resolve => {
    const fails = [], ctls = [], t0 = [];
    let done = false, next = 0, failed = 0, timer = 0, dead = 0;
    const end = v => { done = true; clearTimeout(timer); clearTimeout(dead); resolve({ ...v, fails }); };
    const fail = (i, why) => {
      if (done) return;
      fails.push({ m: list[i], why, ms: Date.now() - t0[i] }); failed++;
      const k = mid(list[i]);
      if (/^404/.test(why)) cool.set(k, Date.now() + 600000); else if (/^(429|5\d\d)|slow|network/.test(why)) cool.set(k, Date.now() + 45000);
      if (next < list.length) launch(); else if (failed >= list.length) end({ ok: false });
    };
    const launch = () => {
      if (done || next >= list.length) return;
      clearTimeout(timer);
      const i = next++, ctl = new AbortController(); ctls[i] = ctl; t0[i] = Date.now();
      attempt(list[i], ctl.signal).then(r => {
        if (done) { try { r.body && r.body.cancel(); } catch {} return; }
        if (r.ok) { ctls.forEach((c, j) => { if (j !== i) c.abort(); }); end({ ok: true, res: r, model: list[i] }); } else fail(i, r.err);
      }).catch(e => fail(i, e.name === 'AbortError' ? 'too slow' : 'network error'));
      timer = setTimeout(launch, staggerMs);
    };
    dead = setTimeout(() => { if (done) return; ctls.forEach(c => c.abort()); end({ ok: false }); }, totalMs);
    launch();
  });
}

// passes the stream through unchanged and gives the full text at the end
export function tee(body, onDone) {
  const dec = new TextDecoder(); let buf = '', acc = '';
  return body.pipeThrough(new TransformStream({
    transform(ch, ctl) {
      ctl.enqueue(ch); buf += dec.decode(ch, { stream: true });
      const ls = buf.split('\n'); buf = ls.pop();
      for (const l of ls) if (l.startsWith('data:') && !l.includes('[DONE]')) { try { acc += JSON.parse(l.slice(5)).choices?.[0]?.delta?.content || ''; } catch {} }
    },
    flush() { try { onDone(acc); } catch {} }
  }));
}

/* ---- daily self-test: 10 easy questions to every engine ---- */
const QA = [['What is 15 plus 27? Answer with just the number.', '42'], ['What is the capital of France? One word.', 'paris'], ['What is the opposite of hot? One word.', 'cold'], ['How many days are in a week? Just the number.', '7'], ['What color do you get mixing blue and yellow? One word.', 'green'], ['What is 9 times 8? Just the number.', '72'], ['Which planet is closest to the sun? One word.', 'mercury'], ['Reverse the word "stop". Just the word.', 'pots'], ['What is the chemical formula of water? Just the formula.', 'h2o'], ['What is 100 divided by 4? Just the number.', '25']];
export async function selfTest(models) {
  models = models || allModels();
  return Promise.all(models.map(async m => {
    let pass = 0, ms = 0, err = '', bad = 0;
    for (const [q, exp] of QA) {
      const t = Date.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
      try {
        const r = await fetch(PROV[m.p].url(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PROV[m.p].key() }, body: JSON.stringify({ model: m.id, stream: false, max_tokens: 400, messages: [{ role: 'user', content: q }], ...(m.effort ? { reasoning_effort: m.effort } : {}) }), signal: ctl.signal });
        ms += Date.now() - t;
        if (!r.ok) { err = String(r.status); bad++; } else {
          const d = await r.json(); const txt = String(d.choices?.[0]?.message?.content || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
          if (txt.includes(exp)) pass++;
        }
      } catch (e) { err = e.name === 'AbortError' ? 'timeout' : 'net'; bad++; }
      clearTimeout(to);
      if (bad >= 2 && pass === 0) break;
    }
    return { id: mid(m), eng: m.p, model: m.id, pass, avg_ms: Math.round(ms / QA.length), err };
  }));
}
export async function selfTestAndStore() {
  const results = await selfTest(), ts = new Date().toISOString();
  await rest('settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'selftest_last', value: { ts, results }, updated_by: 'selftest' }) }).catch(() => {});
  await logAi(results.map(r => ({ kind: 'selftest', eng: r.eng, model: r.model, ok: r.pass >= 8, ms: r.avg_ms, err: r.err || null })));
  const broken = results.filter(r => r.pass < 7);
  if (broken.length) await alertAdmin('Self-test problem: ' + broken.map(r => `${r.id} scored ${r.pass}/10${r.err ? ' (' + r.err + ')' : ''}`).join('; '));
  return { ts, results };
}
