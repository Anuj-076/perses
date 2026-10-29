import { cors, json, blocked, authenticate, rest } from './_lib.js';
export const config = { runtime: 'edge' };
const FEATS = ['code_run', 'preview', 'branch', 'share', 'listen', 'regen', 'voice_chat', 'doc_attach', 'image_tools', 'roadmap_vote', 'support', 'sync', 'toolbar'];
const parse = ua => ({
  device: /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop',
  browser: /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /firefox\//i.test(ua) ? 'Firefox' : /chrome\//i.test(ua) ? 'Chrome' : /safari\//i.test(ua) ? 'Safari' : 'Other',
  os: /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Other'
});
export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST' || blocked(req)) return json({ ok: false }, 200, h);
  const a = await authenticate(req, h, true);
  if (a.fail) return json({ ok: false }, 200, h);
  let b = {}; try { b = await req.json(); } catch {}
  const ua = parse(req.headers.get('user-agent') || ''), k = a.uid || a.gk, now = new Date().toISOString();
  const jobs = [];
  if (b.k === 'visit' || b.k === 'feat') {
    if (b.k === 'feat' && !FEATS.includes(b.name)) return json({ ok: false }, 200, h);
    jobs.push(rest('events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ kind: b.k, uid: a.uid || null, gk: a.gk || null, ih: a.ih, country: a.country || null, ...ua, meta: b.k === 'feat' ? { name: b.name } : null }) }));
  }
  jobs.push(rest('presence?on_conflict=k', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ k, uid: a.uid || null, ts: now, country: a.country || null, device: ua.device, browser: ua.browser }) }));
  if (a.uid) jobs.push(rest(`profiles?id=eq.${a.uid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_seen: now, country: a.country || null }) }));
  await Promise.all(jobs.map(p => p.catch(() => {})));
  return json({ ok: true, country: a.country || '' }, 200, h);
}
