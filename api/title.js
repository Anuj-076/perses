import { cors, json, blocked, authenticate } from './_lib.js';
import { llm, bump } from './_llm.js';
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;
  let text = ''; try { text = String((await req.json()).text || '').slice(0, 700); } catch {}
  if (text.length < 5) return json({ title: '' }, 200, h);
  if ((await bump(a, 'title', 100)) !== true) return json({ title: '' }, 200, h);
  try {
    let t = await llm([{ role: 'system', content: 'Write a short title (3 to 6 words) for this chat, in the same language as the user. No quotes, no ending punctuation, no emojis. Output ONLY the title.' }, { role: 'user', content: text }], { max: 500 });
    t = t.split('\n')[0].replace(/^["'`*#\s]+|["'`*#.\s]+$/g, '').slice(0, 60);
    return json({ title: t }, 200, h);
  } catch { return json({ title: '' }, 200, h); }
}
