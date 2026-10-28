import { cors, json, blocked, authenticate, consume, limitResponse } from './_lib.js';
export const config = { runtime: 'edge' };

// Gemini models are only a bonus (they only work if your key allows image creation for free).
// Edit the names here if Google renames them.
const GEM_IMAGE = {
  free:  ['gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'],
  pro:   ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-lite-image'],
  elite: ['gemini-3-pro-image-preview', 'gemini-nano-banana-2.1', 'gemini-3.1-flash-image-preview']
};
const HQ = new Set(['gemini-3-pro-image-preview', 'gemini-nano-banana-2.1', 'gemini-3.1-flash-image-preview']);

// Rewrites the request into a detailed prompt (keeps everything the user asked for)
async function enhance(prompt) {
  const k = process.env.GROQ_API_KEY;
  if (!k) return prompt;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', temperature: 0.4, max_tokens: 220,
        messages: [
          { role: 'system', content: 'You rewrite image requests into ONE detailed prompt for an AI image generator. Keep EVERY subject, object, text, color, number and style the user asked for exactly. Add helpful detail about composition, lighting, camera or art style, background and quality. If the request is not in English, translate it to English but keep any text that must appear inside the image unchanged. Output ONLY the final prompt, max 90 words.' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: ctl.signal
    });
    clearTimeout(t);
    if (!r.ok) return prompt;
    const d = await r.json();
    const o = d.choices?.[0]?.message?.content?.trim();
    return o && o.length > 10 ? o.slice(0, 900) : prompt;
  } catch { clearTimeout(t); return prompt; }
}

async function gemini(model, prompt, imgs) {
  const parts = [{ text: prompt }];
  for (const u of imgs) {
    const m = /^data:(.+?);base64,(.+)$/.exec(u);
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
  }
  for (const sized of [true, false]) {
    const cfg = { aspectRatio: '1:1' };
    if (sized && HQ.has(model)) cfg.imageSize = '2K';
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 70000);
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: cfg } }),
        signal: ctl.signal
      });
    } finally { clearTimeout(t); }
    if (r.ok) {
      const d = await r.json();
      const p = (d.candidates?.[0]?.content?.parts || []).find(x => x.inlineData || x.inline_data);
      if (p) { const i = p.inlineData || p.inline_data; return `data:${i.mimeType || i.mime_type};base64,${i.data}`; }
      throw new Error('no image returned');
    }
    if (r.status === 400 && sized && HQ.has(model)) continue;   // retry without the 2K setting
    throw new Error(r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 90));
  }
  return null;
}

async function cloudflare(prompt) {
  const id = process.env.CF_ACCOUNT_ID, tok = process.env.CF_API_TOKEN;
  if (!id || !tok) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 8 }),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 80));
    const d = await r.json();
    return d.result?.image ? 'data:image/jpeg;base64,' + d.result.image : null;
  } finally { clearTimeout(t); }
}

async function generate(a, prompt, imgs) {
  const errs = [];
  const editing = imgs.length > 0;
  const finalPrompt = editing ? prompt : await enhance(prompt);
  const gems = GEM_IMAGE[a.plan] || GEM_IMAGE.free;
  const order = ['cf', 'gem'];   // free Cloudflare first, Gemini only as a bonus
  const t0 = Date.now();
  for (const step of order) {
    if (step === 'cf' && !editing) {
      try { const img = await cloudflare(finalPrompt); if (img) return { image: img }; } catch (e) { errs.push('cf: ' + e.message); }
    }
    if (step === 'gem' && process.env.GEMINI_API_KEY) {
      for (const m of gems) {
        if (Date.now() - t0 > 100000) break;
        try { const img = await gemini(m, finalPrompt, imgs); if (img) return { image: img }; } catch (e) { errs.push(m + ': ' + e.message); }
      }
    }
  }
  return { error: 'Image creation is busy or not available right now. Please try again in a minute. (' + errs.join(' | ').slice(0, 320) + ')' };
}

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);

  const a = await authenticate(req, h, true);
  if (a.fail) return a.fail;

  let prompt = '', imgs = [];
  try {
    const b = await req.json();
    prompt = String(b.prompt || '').slice(0, 1000);
    imgs = Array.isArray(b.images) ? b.images.slice(0, 3).filter(x => typeof x === 'string' && x.startsWith('data:image/')) : [];
  } catch {}
  if (!prompt) return json({ error: 'Describe the image you want.' }, 400, h);

  const ok = await consume(a, 'imgs');
  if (ok === false) return limitResponse(a, 'imgs', h);
  if (ok === null) return json({ error: 'Usage service error. Check the Supabase setup.' }, 500, h);

  // Stream spaces while working so the connection stays alive, then send the JSON result.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const ka = setInterval(() => { try { ctl.enqueue(enc.encode(' ')); } catch {} }, 4000);
      let out;
      try { out = await generate(a, prompt, imgs); } catch (e) { out = { error: 'Image creation failed. Please try again.' }; }
      clearInterval(ka);
      ctl.enqueue(enc.encode(JSON.stringify(out)));
      ctl.close();
    }
  });
  return new Response(stream, { status: 200, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}
