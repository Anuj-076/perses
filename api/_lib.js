// Shared helpers for the API routes (the underscore keeps it from being a public route)
export const PLANS = {
  free:  { msgs: 20,   imgs: 3 },
  pro:   { msgs: 200,  imgs: 30 },
  elite: { msgs: 1000, imgs: 100 }
};

export function cors(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}
export const json = (obj, status, h) =>
  new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } });

export function blocked(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const o = req.headers.get('origin') || '';
  return allowed.length > 0 && o && !allowed.includes(o);
}

const base = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_KEY || '';
function svcHeaders() {
  const k = key();
  const h = { apikey: k, 'Content-Type': 'application/json' };
  if (k.startsWith('eyJ')) h.Authorization = 'Bearer ' + k;
  return h;
}

// Checks the login token and returns the user's id, plan and username.
export async function authenticate(req, h) {
  if (!base() || !key()) return { fail: json({ error: 'Server setup incomplete: Supabase keys are missing in Vercel.' }, 500, h) };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { fail: json({ error: 'Please log in first.', code: 'auth' }, 401, h) };

  const r = await fetch(base() + '/auth/v1/user', {
    headers: { apikey: process.env.SUPABASE_ANON_KEY || key(), Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return { fail: json({ error: 'Session expired. Please log in again.', code: 'auth' }, 401, h) };
  const u = await r.json();

  let plan = 'free', username = '';
  try {
    const pr = await fetch(`${base()}/rest/v1/profiles?id=eq.${u.id}&select=plan,username`, { headers: svcHeaders() });
    if (pr.ok) {
      const a = await pr.json();
      if (a[0]) { plan = PLANS[a[0].plan] ? a[0].plan : 'free'; username = a[0].username || ''; }
    }
  } catch {}
  return { uid: u.id, plan, username };
}

// Adds 1 to today's usage if under the limit. true = allowed, false = limit reached, null = error
export async function bump(uid, kind, limit) {
  try {
    const r = await fetch(base() + '/rest/v1/rpc/bump_usage', {
      method: 'POST', headers: svcHeaders(),
      body: JSON.stringify({ p_user: uid, p_kind: kind, p_limit: limit })
    });
    if (!r.ok) return null;
    return (await r.json()) === true;
  } catch { return null; }
}
