import { cors, json, blocked, authenticate, sbBase, sbHeaders } from './_lib.js';
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;

  let b; try { b = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  if (b.action !== 'delete' || b.confirm !== 'DELETE') return json({ error: 'Bad request' }, 400, h);

  // The user must have just verified their email code (fresh sign-in within 10 minutes)
  const age = Date.now() - new Date(a.last_sign_in || 0).getTime();
  if (!(age >= 0 && age < 10 * 60 * 1000)) return json({ error: 'Please verify with the emailed code first.', code: 'verify' }, 403, h);

  const r = await fetch(`${sbBase()}/auth/v1/admin/users/${a.uid}`, { method: 'DELETE', headers: sbHeaders() });
  if (!r.ok) return json({ error: 'Could not delete the account (' + r.status + '). Please try again.' }, 500, h);
  return json({ ok: true }, 200, h);
}
