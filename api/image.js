import { PLANS, cors, json, blocked, authenticate, bump } from './_lib.js';
export const config = { runtime: 'edge' };

const GEMINI_IMAGE_MODELS = ['gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);

  const a = await authenticate(req, h);
  if (a.fail) return a.fail;

  let prompt = '';
  try { prompt = String((await req.json()).prompt || '').slice(0, 1000); } catch {}
  if (!prompt) return json({ error: 'Describe the image you want.' }, 400, h);

  const limit = PLANS[a.plan].imgs;
  const ok = await bump(a.uid, 'imgs', limit);
  if (ok === false) return json({ error: `You've used all ${limit} images for today on your plan. Upgrade for more, or come back tomorrow.`, code: 'limit' }, 429, h);
  if (ok === null) return json({ error: 'Usage service error. Check the Supabase setup.' }, 500, h);

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    for (const model of GEMINI_IMAGE_MODELS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10000);
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: ctl.signal
        });
        clearTimeout(timer);
        if (r.ok) {
          const d = await r.json();
          const parts = d.candidates?.[0]?.content?.parts || [];
          const p = parts.find(x => x.inlineData || x.inline_data);
          if (p) {
            const i = p.inlineData || p.inline_data;
            return json({ image: `data:${i.mimeType || i.mime_type};base64,${i.data}`, source: 'gemini' }, 200, h);
          }
        }
      } catch { clearTimeout(timer); }
    }
  }

  // Free fallback (no key needed)
  const seed = Math.floor(Math.random() * 1e9);
  const image = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  return json({ image, source: 'pollinations' }, 200, h);
}
