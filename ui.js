/* Perses UI polish: per-chat links (?c=...), grouped history, chat title bar, sidebar toggle, quick switcher, accent colors */
(() => {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'ui.css'; document.head.append(css);

  /* ---------- accent color ---------- */
  const ACC = [['Orange', '#ff5a00', '#ff9a3c'], ['Blue', '#2f7cff', '#6aa6ff'], ['Green', '#1f9d6b', '#4cc38a'], ['Purple', '#8a4fff', '#b08cff'], ['Pink', '#e5487f', '#ff86b0'], ['Gold', '#d4a73a', '#f0c35a']];
  const setAccent = (a, b, save = true) => { const r = document.documentElement.style; r.setProperty('--accent', a); r.setProperty('--accent2', b); if (save) localStorage.setItem('perses_accent', a + ',' + b); };
  { const s = (localStorage.getItem('perses_accent') || '').split(','); if (s.length === 2) setAccent(s[0], s[1], false); }
  Perses.menu.push(() => ['Accent color', ACC.map(([n, a, b]) => [n, () => setAccent(a, b)])]);
  Perses.menu.push(() => ['Quick switcher (Ctrl+K)', () => palette()]);

  /* ---------- top bar: sidebar toggle + chat title ---------- */
  const tb = $('#topbar'), sp = tb.querySelector('.spacer');
  const sbt = el('button', 'icon-btn only-desk', '\u2630'); sbt.id = 'sbToggle'; sbt.title = 'Hide or show the sidebar (Ctrl+B)'; sbt.setAttribute('aria-label', 'Toggle sidebar'); tb.prepend(sbt);
  const ct = el('button', 'ctitle empty', 'New chat'); ct.id = 'ctitle'; sp.before(ct);
  const toggleSb = () => { document.body.classList.toggle('sb-off'); localStorage.setItem('perses_sb', document.body.classList.contains('sb-off') ? '0' : '1'); };
  if (localStorage.getItem('perses_sb') === '0') document.body.classList.add('sb-off');
  sbt.onclick = toggleSb;
  ct.onclick = () => { const c = cur(); if (c) renameChat(c); };
  function paintTitle() {
    const c = cur(); ct.textContent = c ? c.title : 'New chat'; ct.title = c ? 'Click to rename' : ''; ct.classList.toggle('empty', !c);
    document.title = c ? c.title + ' - Perses' : 'Perses \u2014 Your AI for Help';
  }

  /* ---------- history: date groups ---------- */
  const bucket = t => { const n = new Date(), a = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), d = 864e5; return t >= a ? 'Today' : t >= a - d ? 'Yesterday' : t >= a - 7 * d ? 'Previous 7 days' : t >= a - 30 * d ? 'Previous 30 days' : 'Older'; };
  function group() {
    let last = '';
    $('#history').querySelectorAll('.h-item').forEach(row => {
      const c = chats.find(z => z.id === row.dataset.cid); if (!c) return;
      const g = c.pinned ? 'Pinned' : bucket(c.updated || 0);
      if (g !== last) { last = g; row.before(el('div', 'hgroup', g)); }
    });
  }
  const _cr = window.chatRow; window.chatRow = function (c) { const r = _cr(c); r.dataset.cid = c.id; return r; };
  $('#chatSearch').oninput = () => window.renderHistory();

  /* ---------- every chat gets its own link: /?c=k3x9a1q7m2zt ---------- */
  const rnd = n => { const a = 'abcdefghijklmnopqrstuvwxyz0123456789', b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map(v => a[v % 36]).join(''); };
  const slugOf = c => { if (!c.slug) { c.slug = rnd(12); saveChats(); } return c.slug; };
  const findBy = s => s && chats.find(z => z.slug === s || z.id === s);
  const Q0 = new URLSearchParams(location.search).get('c');
  let resolved = !Q0 || !!SHARE_ID, popping = false;
  function sync() {
    if (!resolved || popping || SHARE_ID) return;
    const c = cur(), want = c ? slugOf(c) : '', u = new URL(location.href), have = u.searchParams.get('c') || '';
    if (want === have) return;
    want ? u.searchParams.set('c', want) : u.searchParams.delete('c');
    history.pushState(null, '', u);
  }
  function strip() { const u = new URL(location.href); u.searchParams.delete('c'); history.replaceState(null, '', u); }
  function tryResolve() {
    if (resolved) return;
    const c = findBy(Q0);
    if (c) { resolved = true; openChat(c.id); return; }
    if (!guest) { resolved = true; strip(); toast('That chat is not on this device. Turn on cloud sync to open your chats anywhere.'); }
  }
  Perses.onStart(() => { tryResolve(); if (!resolved) setTimeout(() => { if (!resolved) { resolved = true; strip(); } }, 3500); });
  addEventListener('popstate', () => {
    if (!resolved) return;
    const c = findBy(new URL(location.href).searchParams.get('c') || ''); popping = true;
    try { c ? openChat(c.id) : newChat(); } finally { popping = false; }
  });

  const _rh = window.renderHistory; window.renderHistory = function () { _rh(); group(); paintTitle(); sync(); };
  Perses.opened.push(() => { paintTitle(); sync(); });

  /* ---------- greeting ---------- */
  function greet() {
    const h = new Date().getHours(), w = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const t = $('#welcome h1'), s = $('#wHello'); if (!t || !s) return;
    if (!guest && profile) { t.textContent = w + ', ' + dispName(); s.textContent = 'What can I help you with today?'; }
    else { t.textContent = 'Welcome To Perses'; s.textContent = 'Your AI for Help'; }
  }
  const _pu = window.paintUser; window.paintUser = function () { _pu(); greet(); };
  Perses.onStart(greet);

  /* ---------- scroll-to-bottom button ---------- */
  const toBot = el('button', '', '\u2193'); toBot.id = 'toBot'; toBot.setAttribute('aria-label', 'Scroll to latest'); $('#main').append(toBot);
  els.scroll.addEventListener('scroll', () => toBot.classList.toggle('on', els.scroll.scrollHeight - els.scroll.scrollTop - els.scroll.clientHeight > 320), { passive: true });
  toBot.onclick = () => { els.scroll.style.scrollBehavior = 'smooth'; els.scroll.scrollTop = els.scroll.scrollHeight; };

  /* ---------- quick switcher (Ctrl/Cmd + K) ---------- */
  function palette() {
    document.querySelectorAll('.pal-m').forEach(n => n.remove());
    const m = el('div', 'modal pal-m', '<div class="sheet pal"><input class="field" id="pq" placeholder="Search chats or type a command..." autocomplete="off"><div id="pl"></div><p class="hint pal-h">Up and Down to move, Enter to open, Esc to close</p></div>');
    document.body.append(m);
    const acts = [['New chat', () => newChat()], ['Switch theme', toggleTheme], ['Settings', () => (user ? openSettings() : showAuth('login'))], ['Upgrade plans', () => openUpgrade()], ['Guide', () => openInfo('guide')], ['Privacy & Terms', () => openInfo('legal')]];
    let items = [], sel = 0;
    const q = m.querySelector('#pq'), pl = m.querySelector('#pl'), close = () => m.remove();
    const paint = () => { pl.innerHTML = items.length ? items.map((it, i) => `<button class="pi ${i === sel ? 'on' : ''}" data-i="${i}">${x(it[0])}</button>`).join('') : '<div class="empty">Nothing found</div>'; };
    const build = () => {
      const s = q.value.trim().toLowerCase();
      const a = acts.filter(z => !s || z[0].toLowerCase().includes(s));
      const c = [...chats].sort((p, r) => (r.updated || 0) - (p.updated || 0)).filter(z => !s || z.title.toLowerCase().includes(s)).slice(0, 12).map(z => ['Chat: ' + z.title, () => openChat(z.id)]);
      items = [...a, ...c]; sel = 0; paint();
    };
    const run = i => { const it = items[i]; if (!it) return; close(); it[1](); };
    q.oninput = build; build(); q.focus();
    q.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      else if (e.key === 'Escape') close();
    };
    pl.onclick = e => { const b = e.target.closest('.pi'); if (b) run(+b.dataset.i); };
    m.onclick = e => { if (e.target === m) close(); };
  }
  addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase(), tg = e.target.tagName || '';
    if (mod && k === 'k') { e.preventDefault(); palette(); }
    else if (mod && k === 'b') { e.preventDefault(); toggleSb(); }
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tg) && !e.target.isContentEditable && !mod) { e.preventDefault(); els.input.focus(); }
  });

  window.renderHistory();
})();
