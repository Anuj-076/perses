import { cors, json, blocked, authenticate, consume, limitResponse, featureOff } from './_lib.js';
import { llm, groundedSearch, BEST } from './_llm.js';
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;
  const kill = a.cfg.s.kill || {};
  if (kill.search || kill.chat) return featureOff(h, 'Deep research is temporarily switched off.');

  let topic = ''; try { topic = String((await req.json()).topic || '').trim().slice(0, 500); } catch {}
  if (topic.length < 3) return json({ error: 'Tell me what to research.' }, 400, h);

  // a research run costs 3 messages from the daily allowance
  for (let i = 0; i < 3; i++) {
    const ok = await consume(a, 'msgs');
    if (ok === false) return limitResponse(a, 'msgs', h);
    if (ok === null) return json({ error: 'Usage service error. Check the Supabase setup.' }, 500, h);
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const send = o => { try { ctl.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch {} };
      const ka = setInterval(() => { try { ctl.enqueue(enc.encode(' ')); } catch {} }, 4000);
      try {
        send({ p: 'Planning the research...' });
        let qs = [];
        try {
          const raw = await llm([{ role: 'system', content: 'You plan web research. Reply with ONLY a JSON array of 4 or 5 short, specific search questions that together cover the topic from different angles (background, latest news, numbers and data, different viewpoints, practical advice). Use the same language as the topic.' }, { role: 'user', content: topic }], { max: 600 });
          const m = raw.match(/\[[\s\S]*\]/); qs = JSON.parse(m ? m[0] : '[]').map(String).filter(Boolean).slice(0, 5);
        } catch {}
        if (!qs.length) qs = [topic, topic + ' latest news', topic + ' statistics and data', topic + ' advantages and disadvantages'];
        send({ p: `Searching the web (${qs.length} searches)...` });
        const results = await Promise.all(qs.map(q => groundedSearch(q).catch(() => null)));
        const good = results.map((r, i) => r && { q: qs[i], ...r }).filter(Boolean);
        if (!good.length) { send({ error: 'Web search is not available right now. Please try again later.' }); }
        else {
          const srcs = [], idx = new Map();
          good.forEach(g => g.sources.forEach(s => { if (!idx.has(s.uri)) { idx.set(s.uri, srcs.length + 1); srcs.push(s); } }));
          send({ p: 'Writing the report...' });
          const notes = good.map(g => `### ${g.q}\n${g.text}\nSources: ${g.sources.map(s => '[' + idx.get(s.uri) + ']').join(' ')}`).join('\n\n');
          const report = await llm([
            { role: 'system', content: 'You write clear research reports in Markdown. Use ONLY the research notes. Structure: a title, a 3-sentence summary, sections with headings, key facts and numbers, different viewpoints, and a short conclusion. Cite sources inline like [1] using the numbers in the notes. Never invent facts or sources. Use the same language as the topic.' },
            { role: 'user', content: (`Topic: ${topic}\n\nRESEARCH NOTES:\n${notes}`).slice(0, 60000) }
          ], { max: 3500, ms: 45000, models: BEST });
          const list = srcs.map((s, i) => `${i + 1}. [${String(s.title).replace(/[\[\]]/g, '')}](${s.uri})`).join('\n');
          send({ report: report + (list ? '\n\n**Sources**\n' + list : '') });
        }
      } catch (e) { send({ error: 'Research failed: ' + String(e.message || e).slice(0, 160) }); }
      clearInterval(ka); ctl.close();
    }
  });
  return new Response(stream, { status: 200, headers: { ...h, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' } });
}
