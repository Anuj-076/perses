export const config = { runtime: 'edge' };

const SYSTEM =
  "You are Perses, a helpful, accurate and friendly AI assistant. Reply in Markdown. " +
  "Put all code in fenced code blocks with the language name. Be concise unless asked for detail.";

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

  // Optional lock: ALLOWED_ORIGINS=https://a.com,https://b.github.io
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, h);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  const { messages, model } = body;
  if (!Array.isArray(messages) || !messages.length || typeof model !== 'string')
    return json({ error: 'messages and model required' }, 400, h);

  const isGemini = model.startsWith('gemini');
  const url = isGemini
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';
  const key = isGemini ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
  if (!key) return json({ error: 'Server is missing the API key for this model.' }, 500, h);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  if (!isGemini) { headers['HTTP-Referer'] = origin || 'https://perses.app'; headers['X-Title'] = 'Perses'; }

  const up = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: SYSTEM }, ...messages] })
  });
  if (!up.ok) {
    const t = await up.text();
    return json({ error: `Provider error ${up.status}: ${t.slice(0, 300)}` }, up.status, h);
  }
  return new Response(up.body, { headers: { ...h, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
