import { cors, json, blocked, authenticate, consume, limitResponse } from './_lib.js';
export const config = { runtime: 'edge' };

const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

async function restyle(prompt, imageB64) {
  const id = process.env.CF_ACCOUNT_ID, tok = process.env.CF_API_TOKEN;
  if (!id || !tok) throw new Error('Cloudflare keys are missing in Vercel');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_b64: imageB64, strength: 0.6, num_steps: 20, guidance: 7.5 }),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 100));
    if ((r.headers.get('content-type') || '').includes('json')) {
      const d = await r.json();
      if (!d.result?.image) throw new Error('no image returned');
      return 'data:image/png;base64,' + d.result.image;
    }
    return 'data:image/png;base64,' + b64(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;

  let b; try { b = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  const image = String(b.image || '');
  const style = String(b.prompt || '').slice(0, 200).trim();
  if (!image.startsWith('data:image/') || image.length > 3000000 || !style) return json({ error: 'Choose an image and a style.' }, 400, h);

  const ok = await consume(a, 'imgs');
  if (ok === false) return limitResponse(a, 'imgs', h);
  if (ok === null) return json({ error: 'Usage service error. Check the Supabase setup.' }, 500, h);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const ka = setInterval(() => { try { ctl.enqueue(enc.encode(' ')); } catch {} }, 4000);
      let out;
      try { out = { image: await restyle(style + ', highly detailed, high quality', image.split(',')[1]) }; }
      catch (e) { out = { error: 'Restyle failed: ' + String(e.message || e).slice(0, 160) }; }
      clearInterval(ka);
      ctl.enqueue(enc.encode(JSON.stringify(out)));
      ctl.close();
    }
  });
  return new Response(stream, { status: 200, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
}
