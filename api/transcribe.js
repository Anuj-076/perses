import { cors, json, blocked, authenticate } from './_lib.js';
import { bump } from './_llm.js';
export const config = { runtime: 'edge' };

const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const MINUTES = { free: 30, pro: 120, elite: 300 };   // audio minutes per day (one piece = one minute)

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;

  const buf = await req.arrayBuffer();
  if (buf.byteLength < 2000 || buf.byteLength > 4300000) return json({ error: 'That audio piece is too small or too large.' }, 400, h);
  const lim = MINUTES[a.plan] || 30, ok = await bump(a, 'stt', lim);
  if (ok === false) return json({ error: `You reached today's transcription limit (${lim} minutes on your plan). Try again tomorrow or upgrade.`, code: 'limit' }, 429, h);
  if (ok === null) return json({ error: 'Usage service error. Check the Supabase setup.' }, 500, h);

  const errs = [];
  if (process.env.GROQ_API_KEY) {
    for (const model of [process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo', 'whisper-large-v3']) {
      try {
        const fd = new FormData();
        fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav'); fd.append('model', model); fd.append('response_format', 'json'); fd.append('temperature', '0');
        const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, body: fd });
        if (r.ok) { const d = await r.json(); return json({ text: String(d.text || '').trim() }, 200, h); }
        errs.push(model + ' ' + r.status);
      } catch { errs.push(model + ' net'); }
    }
  }
  if (process.env.GEMINI_API_KEY) {
    const data = b64(buf);
    for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash']) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Transcribe this audio exactly, word for word, in the language that is spoken. Output ONLY the transcript text. If there is no speech, output nothing.' }, { inlineData: { mimeType: 'audio/wav', data } }] }] })
        });
        if (r.ok) { const d = await r.json(), t = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim(); return json({ text: t }, 200, h); }
        errs.push(model + ' ' + r.status);
      } catch { errs.push(model + ' net'); }
    }
  }
  return json({ error: 'Transcription is busy right now. Please try again.', detail: errs.join(' | ') }, 503, h);
}
