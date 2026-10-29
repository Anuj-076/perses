import { cors, json, blocked, authenticate, streamJson, sendMail, alertAdmin, rest, IDENTITY } from './_lib.js';
import { allModels, CHAINS, PROV, M, mid, selfTestAndStore } from './_engines.js';
export const config = { runtime: 'edge' };
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function playground(b) {
  const want = Array.isArray(b.models) && b.models.length ? b.models : allModels().map(mid);
  const list = allModels().filter(m => want.includes(mid(m))).slice(0, 10), prompt = String(b.prompt || '').slice(0, 1500);
  return { results: await Promise.all(list.map(async m => {
    const t = Date.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 22000);
    try {
      const r = await fetch(PROV[m.p].url(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + PROV[m.p].key() }, signal: ctl.signal, body: JSON.stringify({ model: m.id, stream: false, max_tokens: 700, messages: [{ role: 'user', content: prompt }], ...(m.effort ? { reasoning_effort: m.effort } : {}) }) });
      if (!r.ok) return { id: mid(m), ok: false, ms: Date.now() - t, text: r.status + ' ' + (await r.text()).slice(0, 120) };
      const d = await r.json(); return { id: mid(m), ok: true, ms: Date.now() - t, text: d.choices?.[0]?.message?.content || '(empty)' };
    } catch (e) { return { id: mid(m), ok: false, ms: Date.now() - t, text: e.name === 'AbortError' ? 'timeout' : 'network error' }; } finally { clearTimeout(to); }
  })) };
}
async function mail(b, a) {
  const subject = String(b.subject || '').slice(0, 150), html = String(b.html || '').slice(0, 20000);
  if (!subject || !html) return { error: 'Write a subject and a message.' };
  const r = await rest('rpc/admin_emails', { method: 'POST', body: JSON.stringify({ p_users: Array.isArray(b.uids) && b.uids.length ? b.uids : null, p_plan: b.plan || '' }) });
  const emails = r.ok ? await r.json() : [];
  if (!emails || !emails.length) return { error: 'No recipients found.' };
  let sent = 0;
  for (let i = 0; i < emails.length; i += 50) if (await sendMail({ bcc: emails.slice(i, i + 50), subject, html })) sent += Math.min(50, emails.length - i);
  rest('audit_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor: a.email, action: 'mail', target: String(emails.length), detail: { subject, sent } }) }).catch(() => {});
  return sent ? { sent, total: emails.length } : { error: 'Email service not set up. Add BREVO_API_KEY and MAIL_FROM in Vercel.' };
}

export default async function handler(req) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
  if (blocked(req)) return json({ error: 'Origin not allowed' }, 403, h);
  const a = await authenticate(req, h, false);
  if (a.fail) return a.fail;
  if (!a.role) return json({ error: 'Not allowed' }, 403, h);
  let b; try { b = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }
  const edit = a.role === 'owner' || a.role === 'admin';
  switch (b.action) {
    case 'models': return json({ all: allModels().map(m => ({ id: mid(m), label: m.id, eng: m.p })), chains: Object.fromEntries(Object.entries(CHAINS).map(([k, v]) => [k, [...new Set(v.map(mid))]])) }, 200, h);
    case 'identity_default': return json({ text: IDENTITY }, 200, h);
    case 'playground': return edit ? streamJson(h, () => playground(b)) : json({ error: 'Not allowed' }, 403, h);
    case 'selftest': return edit ? streamJson(h, () => selfTestAndStore()) : json({ error: 'Not allowed' }, 403, h);
    case 'test_alert': if (!edit) return json({ error: 'Not allowed' }, 403, h); await alertAdmin('Test alert from the Perses admin dashboard.'); return json({ ok: true }, 200, h);
    case 'mail': return edit ? streamJson(h, () => mail(b, a)) : json({ error: 'Not allowed' }, 403, h);
    case 'ticket_mail': {
      const r = await rest(`tickets?id=eq.${+b.ticket}&select=email,subject`), t = r.ok ? (await r.json())[0] : null;
      if (!t || !t.email) return json({ error: 'No email on file for this ticket.' }, 200, h);
      const ok = await sendMail({ to: t.email, subject: 'Re: ' + t.subject, html: `<p>${esc(b.text)}</p><p style="color:#888">You can also read this reply inside Perses under Help &gt; Contact support.</p>` });
      return json(ok ? { ok: true } : { error: 'Email service not set up.' }, 200, h);
    }
  }
  return json({ error: 'Unknown action' }, 400, h);
}
