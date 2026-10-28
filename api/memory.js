import { cors, json, blocked, authenticate, consume } from './_lib.js';
export const config = { runtime: 'edge' };

const SYS = `You maintain a short long-term memory about a user for an AI assistant. Output the UPDATED memory only.
Keep durable, useful facts: preferences (language, answer style), background (student, profession, city-level location), goals, projects, interests.
NEVER store: passwords, ID, bank or card numbers, health or medical details, sexual orientation, religion, politics, exact addresses, details about children, or anything the user said is private.
Format: one fact per line starting with "- ". Max 12 lines and 800 characters. Merge duplicates and drop outdated facts.
If nothing new is worth remembering, return the existing memory unchanged.`;

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;

  let b; try { b = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  const old = String(b.memory || '').slice(0, 1800);
  const convo = (Array.isArray(b.messages) ? b.messages : []).slice(-8)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content || '').slice(0, 800)}`).join('\n');
  const k = process.env.GROQ_API_KEY;
  if (!convo || !k) return json({ memory: old }, 200, h);
  if ((await consume(a, 'mem')) !== true) return json({ memory: old }, 200, h);

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', temperature: 0.2, max_tokens: 400,
        messages: [{ role: 'system', content: SYS }, { role: 'user', content: `EXISTING MEMORY:\n${old || '(empty)'}\n\nRECENT CONVERSATION:\n${convo}` }]
      })
    });
    if (!r.ok) return json({ memory: old }, 200, h);
    const d = await r.json();
    let out = (d.choices?.[0]?.message?.content || '').trim();
    if (!out || out.length > 1500) out = old;
    return json({ memory: out }, 200, h);
  } catch { return json({ memory: old }, 200, h); }
}
