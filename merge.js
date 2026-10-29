/* Perses merge layer: menus with sub-buttons, animations, global (no India-specific) text, age 7+, queue, continue */
(() => {
  const css = `
  .modal:not([hidden]){animation:pFade .2s ease}
  .modal:not([hidden]) .sheet{animation:pPop .32s cubic-bezier(.2,.9,.3,1.15)}
  @keyframes pFade{from{opacity:0}}
  @keyframes pPop{from{opacity:0;transform:translateY(18px) scale(.94)}}
  .pop:not([hidden]){animation:pMenu .17s ease-out;transform-origin:bottom left}
  @keyframes pMenu{from{opacity:0;transform:translateY(6px) scale(.96)}}
  .pop.slide button,.pop.slide .hd{animation:pSlide .2s ease both}
  @keyframes pSlide{from{opacity:0;transform:translateX(14px)}}
  .pop .back{color:var(--dim);font-size:13px;border-bottom:1px solid var(--line);border-radius:9px 9px 0 0;margin-bottom:4px}
  .pop .arr::after{content:"\\203A";float:right;color:var(--dim);font-size:17px;line-height:1}
  button{transition:transform .12s,filter .15s,background .15s,border-color .15s,color .15s,box-shadow .2s}
  .btn:active,.icon-btn:active,.primary:active,.upgrade:active,.mode:active,.card:active,.send:active{transform:scale(.95)}
  .mode.on{box-shadow:0 0 0 3px rgba(255,90,0,.18)}
  .h-item{transition:background .15s,transform .15s}.h-item:hover{transform:translateX(3px)}
  .msg{animation:fade .35s ease}
  #toast{transition:all .35s cubic-bezier(.2,.9,.3,1.3)}
  #themeBtn,#voiceBtn{display:none!important}
  #bannerBox{position:fixed;top:0;left:0;right:0;z-index:72;pointer-events:none}
  .bn{pointer-events:auto;padding:9px 40px 9px 14px;text-align:center;font-size:13.5px;color:#fff;background:linear-gradient(90deg,var(--accent),var(--accent2));position:relative;animation:pDrop .35s ease}
  .bn.warn{background:#c2410c}.bn button{position:absolute;right:10px;top:6px;color:#fff;opacity:.85;font-size:15px}
  @keyframes pDrop{from{transform:translateY(-100%)}}
  #qbar{display:none;padding:0 6px 8px}#qbar.on{display:block}
  .dlg-list{display:flex;flex-direction:column;gap:8px;margin-top:6px}
  .dlg-list .btn{text-align:left}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);

  /* ---------- global text, no country-specific wording; ages 7+ ---------- */
  if (!localStorage.getItem('perses_vlang')) localStorage.setItem('perses_vlang', navigator.language || 'en-US');
  CONFIG.VOICE_LANGS = [[navigator.language || 'en-US', 'Device language (auto)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German'], ['it-IT', 'Italian'], ['pt-BR', 'Portuguese'], ['ru-RU', 'Russian'], ['ar-SA', 'Arabic'], ['tr-TR', 'Turkish'], ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['zh-CN', 'Chinese'], ['id-ID', 'Indonesian']];
  CONFIG.TEMPLATES = CONFIG.TEMPLATES.map(t => /hindi/i.test(t.t) ? { i: 'Translate', t: 'Translate text', d: 'Any language', p: 'Translate the following into [language], keeping the tone natural:\n\n[text]' } : t);
  const fix = s => s.replace(/Hindi and other Indian languages/g, 'every language').replace(/aged 13 and over/g, 'aged 7 and over. Children under 13 should use Perses together with a parent or guardian');
  INFO.about[1] = fix(INFO.about[1]); INFO.legal[1] = fix(INFO.legal[1]);
  window.checkBirthday = bd => { if (!bd) return 'Please choose your birthday.'; const a = ageOf(bd); if (isNaN(a) || a < 0 || a > 120) return 'That birthday does not look right.'; if (a < 7) return 'Perses is for people aged 7 and over.'; return ''; };
  const mem = $('#sMem'); if (mem) mem.placeholder = 'e.g. I am a student. Keep answers short and simple.';

  /* ---------- feature flags (set in the admin dashboard) ---------- */
  window.flagOn = name => {
    const f = ((window.PCFG || {}).flags || {})[name]; if (!f) return true; if (f.on === false) return false;
    const pct = f.pct == null ? 100 : f.pct, id = (user && user.id) || localStorage.getItem('perses_gid') || 'x'; let h = 0;
    for (const c of id + name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 100 < pct;
  };

  /* ---------- menu with sub-buttons ---------- */
  function popTree(anchor, items, up = true) {
    const m = $('#rowMenu');
    const place = () => { const r = anchor.getBoundingClientRect(); m.hidden = false; const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, up ? r.top - h - 8 : Math.min(r.bottom + 4, innerHeight - h - 8)) + 'px'; };
    const render = (list, head, parent) => {
      m.innerHTML = '';
      if (head) { const b = document.createElement('button'); b.className = 'back'; b.textContent = '\u2039  ' + head; b.onclick = e => { e.stopPropagation(); render(...parent); }; m.append(b); }
      list.forEach(([label, fn, danger]) => {
        const b = document.createElement('button'); b.textContent = label; if (danger) b.className = 'danger';
        if (Array.isArray(fn)) { b.classList.add('arr'); b.onclick = e => { e.stopPropagation(); render(fn, label, [list, head, parent]); }; }
        else b.onclick = e => { e.stopPropagation(); m.hidden = true; fn(); };
        m.append(b);
      });
      m.classList.remove('slide'); void m.offsetWidth; if (head) m.classList.add('slide'); place();
    };
    render(items, '', null);
  }
  window.popTree = popTree;

  const grp = l => /photo|upload image|attach document/i.test(l) ? 'Add' : /create an image|image tools|logo|avatar|meme|image to prompt/i.test(l) ? 'Create' : /web search|voice|speaking/i.test(l) ? 'Search & voice' : 'Learn & tools';
  const gate = l => { const k = (window.PCFG || {}).kill || {}; if (/image/i.test(l) && k.images) return false; if (/web search/i.test(l) && k.search) return false; if (/voice/i.test(l) && (k.voice || !flagOn('voice_chat'))) return false; if (/document/i.test(l) && (k.docs || !flagOn('docs'))) return false; if (/image tools/i.test(l) && !flagOn('image_tools')) return false; return true; };
  $('#attachBtn').onclick = e => {
    e.stopPropagation(); const btn = e.currentTarget;
    const flat = [
      ['Take a photo', () => $('#camInput').click()], ['Upload image', () => els.file.click()],
      ['Create an image', () => { imgMode = true; paintChips(); els.input.focus(); }],
      ...(guest ? [] : [['Web search', () => { searchMode = true; paintChips(); els.input.focus(); }]]),
      ...Perses.attach.map(x => typeof x === 'function' ? x() : x).filter(Boolean),
      ['Prompt templates', openTemplates],
      ['Voice language', () => popTree(btn, CONFIG.VOICE_LANGS.map(([c, n]) => [n, () => { localStorage.setItem('perses_vlang', c); toast('Voice language: ' + n); }]), true)]
    ].filter(it => gate(it[0]));
    const g = {}; flat.forEach(it => { (g[grp(it[0])] = g[grp(it[0])] || []).push(it); });
    popTree(btn, ['Add', 'Create', 'Search & voice', 'Learn & tools'].filter(k => g[k]).map(k => [k, g[k]]), true);
  };
  $('#userBtn').onclick = e => {
    e.stopPropagation();
    const ex = Perses.menu.map(x => typeof x === 'function' ? x() : x).filter(Boolean);
    const adm = ex.filter(x => /admin/i.test(x[0])), tour = ex.filter(x => /tour/i.test(x[0])), rest = ex.filter(x => !adm.includes(x) && !tour.includes(x));
    const call = n => () => { if (window[n]) window[n](); else toast('Coming soon'); };
    popTree(e.currentTarget, [
      ['Settings', [['Profile & password', openSettings], ['Memory manager', call('openMemory')], ['Cloud sync', call('openSync')], ['Exam prep setup', call('openExam')]]],
      ['Appearance', [['Switch theme', toggleTheme], ['Custom background', () => { if (!isPremium()) { toast('Custom backgrounds are a Pro & Elite feature.'); openUpgrade(); return; } $('#bgFile').click(); }], ['Remove background', () => { localStorage.removeItem(BGK()); applyBg(); toast('Background removed'); }]]],
      ['Help & info', [['Guide', () => openInfo('guide')], ["What's new", call('openChangelog')], ['Roadmap & votes', call('openRoadmap')], ['Contact support', call('openSupport')], ['Status page', () => window.open('status.html', '_blank')], ['About', () => openInfo('about')], ['Privacy & Terms', () => openInfo('legal')], ...tour]],
      ...adm, ...rest, ['Log out', () => sb.auth.signOut()]
    ], true);
  };

  /* ---------- feedback with engine id (admin leaderboard) ---------- */
  const _f = window.fetch.bind(window); let lastRid = '';
  window.fetch = async (...a) => { const r = await _f(...a); try { if (String(a[0]).includes('/api/chat')) lastRid = r.headers.get('X-Rid') || ''; } catch {} return r; };
  window.rate = async function (i, val) {
    const chat = cur(), m = chat.messages[i]; m.rating = m.rating === val ? 0 : val; saveChats();
    const el = els.messages.querySelector(`.msg[data-i="${i}"]`);
    el.querySelector('[data-a=up]').classList.toggle('on', m.rating === 1); el.querySelector('[data-a=down]').classList.toggle('on', m.rating === -1);
    if (m.rating) { toast('Thanks for the feedback!'); if (user) sb.from('feedback').insert({ user_id: user.id, rating: m.rating, snippet: (m.content || '[image]').slice(0, 300), rid: m.rid || null }).then(() => {}); }
  };
  Perses.bodyExtra.push(chat => { const l = chat.messages[chat.messages.length - 1]; return { tag: (l && l.tag) || '', regen: window.__regen ? 1 : 0 }; });
  const _reg = window.regenerate; window.regenerate = async i => { window.__regen = 1; try { await _reg(i); } finally { window.__regen = 0; } };

  /* ---------- continue a cut-off answer ---------- */
  Perses.afterReply.push((chat, msg) => {
    if (lastRid) { msg.rid = lastRid; saveChats(); }
    const t = (msg.content || '').trim();
    const cut = (t.match(/```/g) || []).length % 2 === 1 || (t.length > 400 && !/[.!?)\]"'`*_\u3002\u0964]$/.test(t));
    if (!cut || msg.image) return;
    const act = els.messages.querySelector('.msg:last-child .actions'); if (!act) return;
    const b = document.createElement('button'); b.textContent = 'Continue'; b.style.color = 'var(--accent)';
    b.onclick = () => { b.remove(); submit('Continue exactly where you stopped. Do not repeat what you already wrote.', [], false); };
    act.append(b);
  });

  /* ---------- message queue ("you're #2") ---------- */
  const Q = [], qb = document.createElement('div'); qb.id = 'qbar'; $('#composer .bar').before(qb);
  const qpaint = () => { qb.classList.toggle('on', !!Q.length); qb.innerHTML = Q.length ? `<span class="chip">${Q.length} message${Q.length > 1 ? 's' : ''} waiting in line</span>` : ''; };
  const _send = window.send;
  window.send = async function (o) {
    if (busy && typeof o !== 'string') { const t = els.input.value.trim(); if (t) { Q.push(t); els.input.value = ''; autosize(); qpaint(); toast(`Queued. You're #${Q.length} in line.`); return; } }
    return _send(o);
  };
  setInterval(() => { if (!busy && Q.length) { const t = Q.shift(); qpaint(); _send(t); } }, 600);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q.length) { Q.length = 0; qpaint(); } });
})();
