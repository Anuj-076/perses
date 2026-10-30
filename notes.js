/* Perses notes: pin, highlight and note any message; read-aloud with highlighted words; smart chat titles */
(() => {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sheet = (title, html) => { const m = el('div', 'modal', `<div class="sheet"><button class="x" aria-label="Close">\u2715</button><h2>${x(title)}</h2><div>${html}</div></div>`); m.querySelector('.x').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; document.body.append(m); return m; };
  document.head.append(el('style', '', `
    .msg.pinned .bubble{position:relative}
    .msg.pinned .bubble::before{content:"Pinned";position:absolute;top:-10px;left:8px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--accent);border-radius:99px;padding:1px 9px;z-index:1}
    mark.hl{background:rgba(255,200,0,.4);color:inherit;border-radius:3px;padding:0 1px}
    .nbox{margin-top:8px;padding:8px 12px;border-left:3px solid var(--gold);background:var(--panel2);border-radius:8px;font-size:13px;white-space:pre-wrap;text-align:left}
    .nbox b{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:2px}
    .rw.on{background:rgba(255,90,0,.38);border-radius:3px}`));

  const msgOf = wrap => { const c = cur(); return c ? c.messages[+wrap.dataset.i] : null; };
  const save = () => saveChats();

  /* ---------- highlights ---------- */
  function markText(root, str) {
    if (!str) return false;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('mark.hl,.codebar,.tex,.nbox') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) {
      const i = n.nodeValue.indexOf(str);
      if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + str.length); const mk = document.createElement('mark'); mk.className = 'hl'; r.surroundContents(mk); return true; }
    }
    return false;
  }
  let last = null;
  document.addEventListener('selectionchange', () => {
    const s = getSelection(), t = s ? s.toString().trim() : '';
    if (t.length < 2 || !s.anchorNode) return;
    const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement, wrap = n && n.closest('#messages .msg');
    if (wrap) last = { i: +wrap.dataset.i, t, at: Date.now() };
  });

  /* ---------- decorate messages: pinned tag, note box, highlights, More button ---------- */
  function decorate(wrap) {
    const m = msgOf(wrap); if (!m) return;
    wrap.classList.toggle('pinned', !!m.pin);
    const bub = wrap.querySelector('.bubble'), acts = bub.querySelector('.actions');
    let nb = bub.querySelector('.nbox');
    if (m.note) { if (!nb) { nb = el('div', 'nbox'); acts ? bub.insertBefore(nb, acts) : bub.append(nb); } nb.innerHTML = '<b>Your note</b>'; nb.append(document.createTextNode(m.note)); } else if (nb) nb.remove();
    const body = wrap.querySelector('.body');
    if (m.hl && m.hl.length && !busy && !body.querySelector('mark.hl')) m.hl.forEach(t => markText(body, t));
    if (acts && !acts.querySelector('[data-a=more]')) { const b = el('button', '', 'More'); b.dataset.a = 'more'; acts.append(b); }
  }
  const decorateAll = () => els.messages.querySelectorAll('.msg').forEach(decorate);
  let tm = 0;
  new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { if (!busy) decorateAll(); }, 120); }).observe(els.messages, { childList: true });
  Perses.afterReply.push(() => setTimeout(decorateAll, 60));
  Perses.opened.push(() => setTimeout(decorateAll, 60));

  els.messages.addEventListener('click', e => {
    const b = e.target.closest('[data-a=more]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const wrap = b.closest('.msg'), i = +wrap.dataset.i, m = msgOf(wrap); if (!m) return;
    const items = [
      [m.pin ? 'Unpin message' : 'Pin message', () => { m.pin = !m.pin; save(); decorate(wrap); toast(m.pin ? 'Pinned' : 'Unpinned'); }],
      ['Highlight selected text', () => {
        const l = last && last.i === i && Date.now() - last.at < 20000 ? last : null;
        if (!l) { toast('Select some text in this message first, then press More again.'); return; }
        if (markText(wrap.querySelector('.body'), l.t)) { (m.hl = m.hl || []).push(l.t); save(); } else toast('Select text inside one paragraph.');
      }],
      [m.note ? 'Edit note' : 'Add a note', async () => {
        const v = await dialog({ title: 'Note', text: 'Only you can see this note.', input: true, multiline: true, value: m.note || '', ok: 'Save' });
        if (v !== null) { m.note = v.trim().slice(0, 1000) || undefined; save(); decorate(wrap); }
      }],
      ...(m.hl && m.hl.length ? [['Remove highlights', () => { m.hl = []; save(); wrap.querySelectorAll('mark.hl').forEach(k => k.replaceWith(...k.childNodes)); }]] : []),
      ['Pinned messages & notes', openPinned]
    ];
    (window.popTree || popMenu)(b, items, false);
  }, true);

  function openPinned() {
    const rows = [];
    chats.forEach(c => c.messages.forEach((m, i) => { if (m.pin || m.note || (m.hl && m.hl.length)) rows.push({ c, i, m }); }));
    const m = sheet('Pinned messages & notes', rows.length ? rows.map((r, k) => `<div class="rm" style="align-items:flex-start"><button class="btn" data-k="${k}">Open</button><div><b>${x(r.c.title)}</b><br><small class="hint">${r.m.pin ? 'Pinned ' : ''}${r.m.note ? 'Note ' : ''}${r.m.hl && r.m.hl.length ? r.m.hl.length + ' highlight(s)' : ''}</small><br>${x(String(r.m.content || '[image]').slice(0, 140))}${r.m.note ? `<div class="nbox"><b>Your note</b>${x(r.m.note)}</div>` : ''}</div></div>`).join('') : '<p class="hint">Nothing yet. Use More under any message to pin it, highlight text or add a note.</p>');
    m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const r = rows[+b.dataset.k]; m.remove(); openChat(r.c.id); setTimeout(() => { const t = els.messages.querySelector(`.msg[data-i="${r.i}"]`); if (t) t.scrollIntoView({ block: 'center' }); }, 160); });
  }
  Perses.attach.push(() => ['Pinned messages & notes', openPinned]);

  /* ---------- read-aloud with highlighted words ---------- */
  const SCRIPTS = [[/[\u0400-\u04FF]/, 'ru-RU'], [/[\u0600-\u06FF]/, 'ar-SA'], [/[\u0590-\u05FF]/, 'he-IL'], [/[\u0370-\u03FF]/, 'el-GR'], [/[\u0E00-\u0E7F]/, 'th-TH'], [/[\u3040-\u30FF]/, 'ja-JP'], [/[\uAC00-\uD7AF]/, 'ko-KR'], [/[\u4E00-\u9FFF]/, 'zh-CN']];
  const langOf = t => { for (const [re, l] of SCRIPTS) if (re.test(t)) return l; return localStorage.getItem('perses_vlang') || navigator.language || 'en-US'; };
  const norm = l => String(l || '').toLowerCase().replace('_', '-');
  function pickVoice(lang) {
    const base = norm(lang).slice(0, 2), same = speechSynthesis.getVoices().filter(v => norm(v.lang).startsWith(base)), saved = localStorage.getItem('perses_voice');
    const s = saved && same.find(v => v.name === saved); if (s) return s;
    const sc = v => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google|siri|enhanced|premium/i.test(v.name) ? 2 : 0) + (norm(v.lang) === norm(lang) ? 1 : 0);
    return same.sort((a, b) => sc(b) - sc(a))[0] || null;
  }
  function wrapWords(body) {
    const nodes = [], w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('.codebox,.tex,.nbox,.runout,.actions,.imgs,.typing') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    const spans = []; let text = '';
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { frag.append(document.createTextNode(tok)); text += ' '; }
        else { const sp = document.createElement('span'); sp.className = 'rw'; sp.textContent = tok; frag.append(sp); spans.push({ el: sp, start: text.length }); text += tok; }
      });
      node.replaceWith(frag); text += ' ';
    });
    return { spans, text };
  }
  const unwrap = body => { body.querySelectorAll('span.rw').forEach(s => s.replaceWith(document.createTextNode(s.textContent))); body.normalize(); };
  function chunks(text) {
    const out = []; let i = 0;
    while (i < text.length) {
      let j = Math.min(text.length, i + 200);
      if (j < text.length) { const k = Math.max(text.lastIndexOf('. ', j), text.lastIndexOf('! ', j), text.lastIndexOf('? ', j)); j = k > i + 60 ? k + 1 : (text.lastIndexOf(' ', j) > i ? text.lastIndexOf(' ', j) : j); }
      out.push({ s: i, t: text.slice(i, j) }); i = j;
    }
    return out;
  }
  let rd = null;
  function light(pos) {
    if (!rd) return; const s = rd.spans; let lo = 0, hi = s.length - 1, ans = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (s[mid].start <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    const sp = s[ans].el; if (rd.last === sp) return;
    if (rd.last) rd.last.classList.remove('on'); sp.classList.add('on'); rd.last = sp;
    const r = sp.getBoundingClientRect(), box = els.scroll.getBoundingClientRect();
    if (r.top < box.top + 20 || r.bottom > box.bottom - 120) sp.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function stopRead() {
    if (!rd) { try { speechSynthesis.cancel(); } catch {} return; }
    const r = rd; rd = null; r.stop = true; clearInterval(r.timer); speechSynthesis.cancel(); unwrap(r.body); if (r.btn) r.btn.textContent = 'Listen';
  }
  function startRead(body, btn) {
    if (!('speechSynthesis' in window)) { toast('Read-aloud is not supported on this device.'); return; }
    const info = wrapWords(body);
    if (!info.text.trim()) { unwrap(body); toast('Nothing to read here.'); return; }
    const lang = langOf(info.text), voice = pickVoice(lang), rate = +(localStorage.getItem('perses_rate') || 1), parts = chunks(info.text);
    rd = { body, btn, spans: info.spans, stop: false, timer: 0, last: null, cur: -1 };
    btn.textContent = 'Stop';
    parts.forEach((c, k) => {
      const u = new SpeechSynthesisUtterance(c.t); u.lang = lang; u.rate = rate; if (voice) u.voice = voice;
      let got = false;
      u.onboundary = e => { got = true; if (rd && !rd.stop) light(c.s + (e.charIndex || 0)); };
      u.onstart = () => {
        if (!rd || rd.stop) return; rd.cur = k; clearInterval(rd.timer); light(c.s);
        setTimeout(() => { if (!got && rd && !rd.stop && rd.cur === k) { const t0 = Date.now(), cps = 14 * rate; rd.timer = setInterval(() => light(c.s + Math.min(c.t.length - 1, Math.floor((Date.now() - t0) / 1000 * cps))), 120); } }, 700);
      };
      u.onend = u.onerror = () => { if (rd && !rd.stop && k === parts.length - 1) stopRead(); };
      speechSynthesis.speak(u);
    });
  }
  els.messages.addEventListener('click', e => {
    const b = e.target.closest('[data-a=listen]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const body = b.closest('.msg').querySelector('.body');
    if (rd && rd.body === body) { stopRead(); return; }
    stopRead(); startRead(body, b);
  }, true);

  /* ---------- smart chat titles ---------- */
  Perses.afterReply.push(async chat => {
    if (guest || !user || chat.titled || chat.messages.length !== 2) return;
    const u = chat.messages[0], a = chat.messages[1], first = (String(u.content || '').replace(/^\/\w+[ \t]*/, '') || 'Image chat').slice(0, 40);
    if (chat.title !== first && chat.title !== 'New chat') return;
    chat.titled = true; saveChats();
    const text = String(u.content || '').replace(/^\/\w+\s*/, '').slice(0, 300) + '\n\nAnswer: ' + String(a.content || '').slice(0, 300);
    try {
      const r = await fetch(CONFIG.API_BASE + '/api/title', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ text }) });
      const d = await r.json(); if (d.title) { chat.title = d.title; saveChats(); renderHistory(); }
    } catch {}
  });
})();
