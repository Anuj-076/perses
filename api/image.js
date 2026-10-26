export const config = { runtime: 'edge' };

function corsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
const json = (obj, status, h) =>
  new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } });

export default async function handler(req) {
  const h = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);

  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, h);

  let prompt = '';
  try { prompt = String((await req.json()).prompt || '').slice(0, 1000); } catch {}
  if (!prompt) return json({ error: 'prompt required' }, 400, h);

  // 1) Try Gemini image generation
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      if (r.ok) {
        const d = await r.json();
        const parts = d.candidates?.[0]?.content?.parts || [];
        const p = parts.find(x => x.inlineData || x.inline_data);
        if (p) {
          const i = p.inlineData || p.inline_data;
          return json({ image: `data:${i.mimeType || i.mime_type};base64,${i.data}`, source: 'gemini' }, 200, h);
        }
      }
    } catch {}
  }

  // 2) Free fallback (no key, no credits)
  const seed = Math.floor(Math.random() * 1e9);
  const image = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  return json({ image, source: 'pollinations' }, 200, h);
}
