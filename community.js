/* Perses community layer: banners, announcements, what's new, polls, roadmap, support, maintenance, visit tracking */
(() => {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const cfg = window.PCFG = { ann: [], log: [], poll: null, kill: {}, flags: {}, maintenance: null };
  const box = el('div'); box.id = 'bannerBox'; document.body.append(box);
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sheet = (title, html) => { const m = el('div', 'modal', `<div class="sheet"><button class="x" aria-label="Close">\u2715</button><h2>${x(title)}</h2><div class="cbody">${html}</div></div>`); m.querySelector('.x').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; document.body.append(m); return m; };

  async function track(k, name) { try { const r = await fetch(CONFIG.API_BASE + '/api/track', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ k, name }) }); const d = await r.json(); if (d.country) window.PCOUNTRY = d.country; } catch {} }
  window.track = track;
  document.addEventListener('click', e => {
    const t = e.target.closest('.runbtn,[data-a]'); if (!t) return;
    if (t.classList.contains('runbtn')) track('feat', /preview/i.test(t.textContent) ? 'preview' : 'code_run');
    else if (t.dataset.a === 'branch') track('feat', 'branch'); else if (t.dataset.a === 'listen') track('feat', 'listen'); else if (t.dataset.a === 'regen') track('feat', 'regen');
  });
  const _sh = window.shareChat; if (_sh) window.shareChat = async c => { await _sh(c); track('feat', 'share'); };

  function paint() {
    box.innerHTML = '';
    const bn = (text, warn, id) => { const b = el('div', 'bn' + (warn ? ' warn' : ''), `<span>${text}</span>`); if (id) { const c = el('button', '', '\u2715'); c.onclick = () => { localStorage.setItem('perses_ann_' + id, '1'); b.remove(); }; b.append(c); } box.append(b); };
    if (cfg.maintenance && cfg.maintenance.on) bn(x(cfg.maintenance.message || 'Perses is under maintenance. Replies may be unavailable for a while.'), true);
    (cfg.ann || []).forEach(a => {
      if (localStorage.getItem('perses_ann_' + a.id)) return;
      if (a.plans && a.plans.length && !a.plans.includes(plan())) return;
      if (a.countries && a.countries.length && !a.countries.map(c => c.toUpperCase()).includes((window.PCOUNTRY || '').toUpperCase())) return;
      if (a.kind === 'popup') { localStorage.setItem('perses_ann_' + a.id, '1'); dialog({ title: a.title, text: a.body, ok: 'Got it', cancel: '' }); }
      else bn(`<b>${x(a.title)}</b> ${x(a.body)}`, false, a.id);
    });
    const latest = (cfg.log[0] || {}).id || 0, seen = +localStorage.getItem('perses_log_seen');
    if (latest && seen && latest > seen) toast("New: " + cfg.log[0].title + ". See Help & info > What's new.");
    if (latest && !seen) localStorage.setItem('perses_log_seen', latest);
    if (cfg.poll && user && !localStorage.getItem('perses_poll_' + cfg.poll.id)) setTimeout(showPoll, 4000);
  }
  async function load() { try { const { data } = await sb.rpc('public_config'); if (data) { cfg.maintenance = data.maintenance; cfg.kill = data.kill || {}; cfg.flags = data.flags || {}; cfg.ann = data.ann || []; cfg.log = data.log || []; cfg.poll = data.poll; paint(); } } catch {} }

  function showPoll() {
    const p = cfg.poll; if (!p || !user) return;
    const m = sheet('Quick question', `<p class="hint">${x(p.q)}</p><div class="dlg-list">${(p.opts || []).map((o, i) => `<button class="btn" data-i="${i}">${x(o)}</button>`).join('')}</div>`);
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => { localStorage.setItem('perses_poll_' + p.id, '1'); await sb.from('poll_votes').insert({ poll: p.id, uid: user.id, opt: +b.dataset.i }); m.remove(); toast('Thanks for voting!'); });
  }
  window.openChangelog = () => { localStorage.setItem('perses_log_seen', (cfg.log[0] || {}).id || 0); sheet("What's new", cfg.log.length ? cfg.log.map(c => `<h3>${x(c.title)}</h3><p class="hint">${new Date(c.ts).toLocaleDateString()}</p><p>${x(c.body)}</p>`).join('') : '<p class="hint">Nothing yet. Check back soon.</p>'); };

  window.openRoadmap = async () => {
    const m = sheet('Roadmap', '<p class="hint">Vote for what we build next.</p><div id="rmBox">Loading...</div>');
    const draw = async () => {
      const { data } = await sb.rpc('roadmap_list'), box2 = m.querySelector('#rmBox'); if (!box2) return;
      box2.innerHTML = (data || []).map(r => `<div class="rm"><button class="btn ${r.mine ? 'pri' : ''}" data-id="${r.id}" data-m="${r.mine}">&#9650; ${r.votes}</button><div><b>${x(r.title)}</b> <em class="tg">${x(r.status)}</em><br><small class="hint">${x(r.body)}</small></div></div>`).join('') || '<p class="hint">No ideas listed yet.</p>';
      box2.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
        if (!user) { toast('Log in to vote.'); showAuth('login'); return; }
        if (b.dataset.m === 'true') await sb.from('roadmap_votes').delete().eq('item', +b.dataset.id).eq('uid', user.id); else { await sb.from('roadmap_votes').insert({ item: +b.dataset.id, uid: user.id }); track('feat', 'roadmap_vote'); }
        draw();
      });
    };
    draw();
  };

  window.openSupport = async () => {
    if (!user) { toast('Log in to contact support.'); showAuth('login'); return; }
    const m = sheet('Contact support', `<div class="tabs" id="spT"><button data-t="new" class="on">New message</button><button data-t="mine">My messages</button></div><div id="spB"></div>`);
    const B = m.querySelector('#spB'), tabs = m.querySelectorAll('#spT button');
    const show = t => { tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); t === 'new' ? form() : mine(); };
    tabs.forEach(b => b.onclick = () => show(b.dataset.t));
    const form = () => { B.innerHTML = '<input class="field" id="spS" placeholder="Subject (e.g. Bug, Idea, Question)" maxlength="120"><textarea class="field" id="spM" rows="5" placeholder="Tell us what happened..." maxlength="3000"></textarea><button class="primary" id="spG">Send</button><p class="amsg" id="spR"></p>'; B.querySelector('#spG').onclick = async () => {
      const s = B.querySelector('#spS').value.trim(), t = B.querySelector('#spM').value.trim(); if (!s || !t) { B.querySelector('#spR').textContent = 'Please fill in both fields.'; return; }
      const r = await sb.from('tickets').insert({ uid: user.id, email: user.email, subject: s }).select('id').single();
      if (r.error) { B.querySelector('#spR').textContent = r.error.message; return; }
      await sb.from('ticket_msgs').insert({ ticket: r.data.id, admin: false, body: t }); track('feat', 'support'); toast('Sent. We will reply here.'); show('mine');
    }; };
    const mine = async () => {
      const { data } = await sb.from('tickets').select('id,subject,status,updated').eq('uid', user.id).order('updated', { ascending: false });
      B.innerHTML = (data || []).map(t => `<button class="btn" style="width:100%;text-align:left;margin-bottom:8px" data-t="${t.id}">${x(t.subject)} <em class="tg">${x(t.status)}</em></button>`).join('') || '<p class="hint">No messages yet.</p>';
      B.querySelectorAll('[data-t]').forEach(b => b.onclick = () => thread(+b.dataset.t));
    };
    const thread = async id => {
      const { data } = await sb.from('ticket_msgs').select('admin,body,ts').eq('ticket', id).order('id');
      B.innerHTML = `<button class="link" id="bk">&larr; Back</button>${(data || []).map(r => `<div class="msg ${r.admin ? 'ai' : 'user'}" style="margin:10px 0"><div class="bubble"><div class="body">${x(r.body)}</div></div></div>`).join('')}<textarea class="field" id="rp" rows="3" placeholder="Reply..."></textarea><button class="primary" id="rg">Send reply</button>`;
      B.querySelector('#bk').onclick = mine;
      B.querySelector('#rg').onclick = async () => { const t = B.querySelector('#rp').value.trim(); if (!t) return; await sb.from('ticket_msgs').insert({ ticket: id, admin: false, body: t }); await sb.from('tickets').update({ updated: new Date().toISOString(), status: 'open' }).eq('id', id).eq('uid', user.id); thread(id); };
    };
    form();
  };

  /* ---------- start ---------- */
  let visited = sessionStorage.getItem('perses_visit');
  Perses.onStart(async () => { if (!visited) { visited = 1; sessionStorage.setItem('perses_visit', 1); await track('visit'); } load(); });
  setInterval(() => { if (!document.hidden) track('ping'); }, 120000);
  setInterval(load, 300000);
  const rmcss = el('style', '', '.rm{display:flex;gap:12px;align-items:flex-start;margin:12px 0}.rm .btn{min-width:62px}'); document.head.append(rmcss);
})();
