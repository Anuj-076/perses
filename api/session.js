import { cors, json, blocked, authenticate, rest, sendMail } from './_lib.js';
export const config = { runtime: 'edge' };

const parse = ua => ({
  browser: /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /firefox\//i.test(ua) ? 'Firefox' : /chrome\//i.test(ua) ? 'Chrome' : /safari\//i.test(ua) ? 'Safari' : 'Browser',
  os: /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown'
});
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;
  let b = {}; try { b = await req.json(); } catch {}
  const did = String(b.did || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(did)) return json({ error: 'Bad device id' }, 400, h);
  const now = new Date().toISOString(), ua = parse(req.headers.get('user-agent') || ''), label = `${ua.browser} on ${ua.os}`;
  let isNew = false, hadAny = false;

  if (b.action === 'remove') {
    await rest(`devices?uid=eq.${a.uid}&did=eq.${String(b.target || '').replace(/[^A-Za-z0-9-]/g, '')}`, { method: 'DELETE' });
  } else if (b.action === 'ping') {
    const ex = await (await rest(`devices?uid=eq.${a.uid}&select=did&limit=50`)).json().catch(() => []);
    hadAny = Array.isArray(ex) && ex.length > 0; isNew = !(ex || []).some(d => d.did === did);
    await rest('devices?on_conflict=uid,did', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ uid: a.uid, did, label, country: a.country || null, last_seen: now }) });
    if (b.login) {
      await rest('login_history', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ uid: a.uid, did, device: label, browser: ua.browser, os: ua.os, country: a.country || null, ih: a.ih, new_device: isNew && hadAny }) });
      if (isNew && hadAny) {
        await sendMail({ to: a.email, subject: 'New sign-in to your Perses account', html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2>New sign-in</h2><p>Your Perses account was just signed in from a new device.</p><p><b>Device:</b> ${esc(label)}<br><b>Country:</b> ${esc(a.country || 'unknown')}<br><b>Time:</b> ${new Date().toUTCString()}</p><p>If this was you, you can ignore this email. If not, open Perses, go to <b>Settings &gt; Security &amp; devices</b>, press <b>Log out everywhere</b>, and change your password.</p></div>` });
      }
    }
  }
  const dv = await (await rest(`devices?uid=eq.${a.uid}&select=did,label,country,first_seen,last_seen&order=last_seen.desc&limit=20`)).json().catch(() => []);
  const hs = await (await rest(`login_history?uid=eq.${a.uid}&select=ts,device,country,new_device&order=ts.desc&limit=15`)).json().catch(() => []);
  return json({ devices: dv, history: hs, new_device: isNew && hadAny }, 200, h);
}
