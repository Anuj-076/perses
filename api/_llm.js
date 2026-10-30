import { rest } from './_lib.js';
import { PROV, M } from './_engines.js';

const FAST = [M.groq20, M.cf20, M.g35lite, M.groq120, M.cf120, M.g31lite];
export const BEST = [M.g38, M.groq120, M.cf120, M.g35, M.groq20, M.cf20];

// One non-streaming answer, trying engines in order
export async function llm(messages, o = {}) {
  const max = o.max || 600, ms = o.ms || 15000, list = (o.models || FAST).filter(m => PROV[m.p].key()), errs = [];
  for (const m of list) {
    const base = { model: m.id, stream: false, max_tokens: max, messages };
    for (const body of (m.effort ? [{ ...base, reasoning_effort: m.effort }, base] : [base])) {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
      try {
        const r = await fetch(PROV[m.p].url(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PROV[m.p].key() }, body: JSON.stringify(body), signal: ctl.signal });
        clearTimeout(t);
        if (r.ok) { const d = await r.json(), txt = String(d.choices?.[0]?.message?.content || '').trim(); if (txt) return txt; errs.push(m.id + ': empty'); break; }
        if (r.status === 400 && body.reasoning_effort) continue;
        errs.push(m.id + ': ' + r.status); break;
      } catch (e) { clearTimeout(t); errs.push(m.id + ': ' + (e.name === 'AbortError' ? 'slow' : 'net')); break; }
    }
  }
  throw new Error('All AI engines failed (' + errs.join(' | ').slice(0, 160) + ')');
}

// Google-search-grounded answer with its sources
export async function groundedSearch(query) {
  const key = process.env.GEMINI_API_KEY; if (!key) return null;
  for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash']) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: ctl.signal,
        body: JSON.stringify({ systemInstruction: { parts: [{ text: 'Answer with specific facts, numbers and dates. Be concise and accurate.' }] }, contents: [{ role: 'user', parts: [{ text: query }] }], tools: [{ google_search: {} }] })
      });
      clearTimeout(t); if (!r.ok) continue;
      const d = await r.json(), c = d.candidates?.[0], text = (c?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (!text) continue;
      const sources = (c.groundingMetadata?.groundingChunks || []).map(g => g.web).filter(w => w && w.uri).map(w => ({ title: w.title || w.uri, uri: w.uri }));
      return { text, sources };
    } catch { clearTimeout(t); }
  }
  return null;
}

// Daily counters for the extra features (true = allowed, false = limit reached, null = error)
export async function bump(a, kind, limit) {
  try {
    const r = await rest('rpc/bump_usage', { method: 'POST', body: JSON.stringify({ p_user: a.uid, p_kind: kind, p_limit: limit }) });
    if (!r.ok) return null; return (await r.json()) === true;
  } catch { return null; }
}
