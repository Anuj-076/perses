export const config = { runtime: 'edge' };

const SYSTEM =
  "You are Perses, a helpful, accurate and friendly AI assistant. Reply in Markdown. " +
  "Put all code in fenced code blocks with the language name. Be concise unless asked for detail.";

// Tried in this order. Each gets a few seconds to start answering, then we move on.
const CHAIN = [
  { id: 'gemini-3.8-flash', vision: true },
  { id: 'gemini-3.5-flash-lite', vision: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', vision: false }
];
const PER_MODEL_MS = 7000;   // max wait per model before trying the next
const TOTAL_MS = 21000;      // Vercel allows ~25s to start responding

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

function hasImages(messages) {
  return messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
}

export default async function handler(req) {
  const h = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);

  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, h);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  const { messages, model } = body;
  if (!Array.isArray(messages) || !messages.length) return json({ error: 'messages required' }, 400, h);

  const images = hasImages(messages);
  let list = [];
  if (model && model !== 'auto') list.push({ id: model, vision: model.startsWith('gemini') });
  CHAIN.forEach(c => { if (!list.find(x => x.id === c.id)) list.push(c); });
  if (images) list = list.filter(c => c.vision);

  const started = Date.now();
  let lastError = 'No model available.';

  for (const c of list) {
    if (Date.now() - started > TOTAL_MS - 2000) break;

    const isGemini = c.id.startsWith('gemini');
    const key = isGemini ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
    if (!key) { lastError = 'Missing API key for ' + (isGemini ? 'Gemini' : 'OpenRouter'); continue; }

    const url = isGemini
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
    if (!isGemini) { headers['HTTP-Referer'] = origin || 'https://perses.app'; headers['X-Title'] = 'Perses'; }

    const payload = { model: c.id, stream: true, messages: [{ role: 'system', content: SYSTEM }, ...messages] };
    if (c.id === 'gemini-3.8-flash') payload.reasoning_effort = 'low'; // answer faster

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(PER_MODEL_MS, TOTAL_MS - (Date.now() - started)));
    try {
      const up = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctl.signal });
      clearTimeout(timer);
      if (up.ok) {
        return new Response(up.body, {
          headers: { ...h, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Perses-Model': c.id }
        });
      }
      const t = await up.text();
      lastError = `${c.id} -> ${up.status}: ${t.slice(0, 160)}`;
    } catch (e) {
      clearTimeout(timer);
      lastError = `${c.id} -> ${e.name === 'AbortError' ? 'too slow' : 'network error'}`;
    }
  }
  return json({ error: 'The AI models are busy right now. Please try again in a minute. (' + lastError + ')' }, 503, h);
}
