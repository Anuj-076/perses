/* Perses lab: cloud sync (opt-in), memory manager, selection toolbar, exam prep, studio helpers */
(() => {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sheet = (title, html) => { const m = el('div', 'modal', `<div class="sheet"><button class="x" aria-label="Close">\u2715</button><h2>${x(title)}</h2><div>${html}</div></div>`); m.querySelector('.x').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; document.body.append(m); return m; };

  /* ===== cloud sync ===== */
  const SK = () => 'perses_sync_' + (user && user.id), on = () => user && localStorage.getItem(SK()) === '1';
  const slim = c => JSON.parse(JSON.stringify(c, (k, v) => (k === 'images' || k === 'image' || k === 'full') ? undefined : v));
  async function push() {
    if (!on()) return; const rows = chats.map(c => ({ uid: user.id, cid: c.id, data: slim(c), updated_at: new Date(c.updated || Date.now()).toISOString() }));
    for (let i = 0; i < rows.length; i += 20) await sb.from('chat_sync').upsert(rows.slice(i, i + 20), { onConflict: 'uid,cid' });
  }
  async function pull() {
    if (!on()) return 0; const { data } = await sb.from('chat_sync').select('cid,data,updated_at').eq('uid', user.id); let n = 0;
    (data || []).forEach(r => { const mine = chats.find(c => c.id === r.cid), t = new Date(r.updated_at).getTime(); if (!mine) { chats.push({ ...r.data, updated: t }); n++; } else if ((mine.updated || 0) < t) { const keep = mine.messages.map(m => m.images || m.image ? m : null); Object.assign(mine, r.data, { updated: t }); n++; } });
    if (n) { saveChats(); renderHistory(); } return n;
  }
  let tm = 0; Perses.afterReply.push(() => { if (on()) { clearTimeout(tm); tm = setTimeout(push, 4000); } });
  Perses.onStart(() => { if (on()) pull().then(n => n && toast(`Synced ${n} chat${n > 1 ? 's' : ''} from the cloud`)); });
  const _del = window.deleteChat; window.deleteChat = async c => { await _del(c); if (on() && !chats.some(z => z.id === c.id)) sb.from('chat_sync').delete().eq('uid', user.id).eq('cid', c.id).then(() => {}); };
  window.openSync = () => {
    if (!user) { toast('Log in to use cloud sync.'); showAuth('login'); return; }
    const m = sheet('Cloud sync', `<p class="hint">Keep your chats on all your devices. Only chat <b>text</b> is stored on our servers (images are not). It is off until you turn it on.</p><label class="chk"><input type="checkbox" id="syOn" ${on() ? 'checked' : ''}><span>Turn on cloud sync for this account</span></label><button class="btn wide-btn" id="syNow">Sync now</button><button class="btn wide-btn" id="syDel" style="margin-top:8px">Delete my cloud copy</button><p class="amsg" id="syMsg"></p>`);
    const say = t => { m.querySelector('#syMsg').textContent = t; m.querySelector('#syMsg').className = 'amsg ok'; };
    m.querySelector('#syOn').onchange = async e => { localStorage.setItem(SK(), e.target.checked ? '1' : '0'); if (e.target.checked) { await pull(); await push(); track('feat', 'sync'); say('Sync is on.'); } else say('Sync is off. Your cloud copy is kept until you delete it.'); };
    m.querySelector('#syNow').onclick = async () => { if (!on()) { say('Turn sync on first.'); return; } const n = await pull(); await push(); say(`Done. ${n} chat(s) came from the cloud.`); };
    m.querySelector('#syDel').onclick = async () => { if (await uiConfirm('Delete cloud copy?', 'This removes your synced chats from our servers. Chats on your devices stay.', 'Delete')) { await sb.from('chat_sync').delete().eq('uid', user.id); say('Cloud copy deleted.'); } };
  };

  /* ===== memory manager ===== */
  window.openMemory = () => {
    if (!user) { toast('Log in to manage memory.'); showAuth('login'); return; }
    const m = sheet('What Perses knows about me', '<p class="hint">These are the things Perses remembers. Delete any you do not want kept.</p><div id="mmL"></div><input class="field" id="mmN" placeholder="Add something to remember..." maxlength="200"><button class="btn wide-btn" id="mmA">Add</button>');
    const items = () => (profile.memory || '').split('\n').map(s => s.replace(/^[-\u2022]\s*/, '').trim()).filter(Boolean);
    const save = async arr => { const t = arr.map(s => '- ' + s).join('\n').slice(0, 1800); profile.memory = t; await sb.from('profiles').update({ memory: t }).eq('id', user.id); draw(); };
    const draw = () => { const a = items(); m.querySelector('#mmL').innerHTML = a.map((s, i) => `<div class="rm" style="align-items:center"><button class="btn" data-i="${i}" title="Delete">\u2715</button><span>${x(s)}</span></div>`).join('') || '<p class="hint">Nothing stored yet.</p>'; m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const z = items(); z.splice(+b.dataset.i, 1); save(z); }); };
    m.querySelector('#mmA').onclick = () => { const v = m.querySelector('#mmN').value.trim(); if (v) { m.querySelector('#mmN').value = ''; save([...items(), v]); } };
    draw();
  };

  /* ===== exam prep (the user sets the exam and the question style) ===== */
  if (!MODES_UI.some(z => z.id === 'exam')) { MODES_UI.push({ id: 'exam', name: 'Exam Prep' }); renderModes(); }
  const EK = 'perses_exam', exam = () => { try { return JSON.parse(localStorage.getItem(EK) || 'null'); } catch { return null; } };
  window.openExam = async () => {
    const e = exam() || {}, m = sheet('Exam prep setup', `<p class="hint">Tell Perses which exam you are practicing for and how its questions look. It will quiz you in exactly that style.</p><label class="lbl">Exam or subject</label><input class="field" id="exN" value="${x(e.name || '')}" placeholder="e.g. SAT Math, IELTS Writing, Bar exam, GRE Verbal"><label class="lbl">Question style</label><textarea class="field" id="exS" rows="3" placeholder="e.g. 4-option multiple choice, one point each; or 2 essay prompts of 250 words">${x(e.style || '')}</textarea><label class="lbl">Difficulty</label><input class="field" id="exD" value="${x(e.level || '')}" placeholder="e.g. easy, medium, hard, like the real exam"><button class="primary" id="exG">Save and start</button>`);
    m.querySelector('#exG').onclick = () => { const v = { name: m.querySelector('#exN').value.trim(), style: m.querySelector('#exS').value.trim(), level: m.querySelector('#exD').value.trim() }; if (!v.name) { toast('Enter the exam or subject.'); return; } localStorage.setItem(EK, JSON.stringify(v)); m.remove(); if (mode !== 'exam') pickMode('exam'); els.input.value = 'Start with the first practice question.'; autosize(); els.input.focus(); };
  };
  Perses.bodyExtra.push(chat => { const e = exam(); return (chat.mode || mode) === 'exam' && e ? { context: `EXAM PREP SETTINGS: Exam: ${e.name}. Question style: ${e.style || 'as in the real exam'}. Difficulty: ${e.level || 'like the real exam'}.` } : {}; });
  const _pm = window.pickMode; window.pickMode = id => { _pm(id); if (id === 'exam' && !exam()) openExam(); };

  /* ===== studio helpers in the + menu ===== */
  Perses.attach.push(() => ['Homework photo (step by step)', () => { els.input.value = '/math Solve the problem in the attached photo step by step. Show every formula you use.'; autosize(); $('#camInput').click(); }]);
  Perses.attach.push(() => ['Image to prompt', () => { els.input.value = 'Look at the attached image and write one detailed prompt that could recreate it in an AI image generator (subject, style, lighting, colors, composition).'; autosize(); els.file.click(); }]);
  Perses.attach.push(() => ['Exam prep setup', openExam]);
  const studio = async (title, hint, pre) => { const v = await dialog({ title, text: hint, input: true, ok: 'Create' }); if (v && v.trim()) submit('/image ' + pre + v.trim(), [], true); };
  Perses.attach.push(() => ['Logo maker', () => studio('Logo maker', 'Brand name and style, e.g. "Nova Coffee, minimal, green"', 'logo design, flat vector, clean, centered on a plain background: ')]);
  Perses.attach.push(() => ['Avatar maker', () => studio('Avatar maker', 'Describe your avatar, e.g. "friendly fox with glasses"', 'cartoon profile avatar portrait, centered, soft lighting: ')]);
  Perses.attach.push(() => ['Meme maker', () => studio('Meme maker', 'Describe the meme, e.g. "cat staring at a laptop at 3am"', 'meme image, bold funny composition, high contrast: ')]);

  /* ===== floating toolbar on selected text ===== */
  const bar = el('div', 'pop', ''); bar.id = 'selBar'; bar.hidden = true; bar.style.cssText = 'display:flex;gap:2px;min-width:0;padding:4px;z-index:96'; document.body.append(bar);
  const ACTS = [['Rewrite', t => `Rewrite this text so it is clearer and better written:\n\n"${t}"`], ['Shorten', t => `Make this text much shorter while keeping the meaning:\n\n"${t}"`], ['Fix grammar', t => `Fix the grammar and spelling of this text and show only the corrected version:\n\n"${t}"`], ['Translate', async t => { const l = await dialog({ title: 'Translate to which language?', input: true, value: 'English', ok: 'Translate' }); return l && l.trim() ? `Translate this text into ${l.trim()}:\n\n"${t}"` : null; }], ['Explain', t => `Explain this text in simple words:\n\n"${t}"`]];
  let selText = '';
  bar.innerHTML = ACTS.map((a, i) => `<button data-i="${i}" style="padding:7px 10px;font-size:13px;border-radius:8px;white-space:nowrap">${a[0]}</button>`).join('');
  bar.onmousedown = e => e.preventDefault();
  bar.onclick = async e => { const b = e.target.closest('[data-i]'); if (!b) return; const t = selText; bar.hidden = true; const p = await ACTS[+b.dataset.i][1](t); if (p) { track('feat', 'toolbar'); submit(p, [], false); } };
  const hide = () => { bar.hidden = true; };
  document.addEventListener('selectionchange', () => {
    clearTimeout(hide.t); hide.t = setTimeout(() => {
      const s = window.getSelection(), t = s ? s.toString().trim() : '';
      if (document.activeElement === els.input && els.input.selectionEnd - els.input.selectionStart > 3) { selText = els.input.value.slice(els.input.selectionStart, els.input.selectionEnd).trim(); const r = els.input.getBoundingClientRect(); place(r.left + 20, r.top - 46); return; }
      if (t.length < 4 || !s.anchorNode) return hide();
      const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
      if (!n || !n.closest('#messages .body, #shareBody')) return hide();
      selText = t; const r = s.getRangeAt(0).getBoundingClientRect(); place(r.left, r.top - 46);
    }, 250);
  });
  function place(l, t) { bar.hidden = false; const w = bar.offsetWidth; bar.style.left = Math.max(8, Math.min(l, innerWidth - w - 8)) + 'px'; bar.style.top = Math.max(8, t) + 'px'; }
  document.addEventListener('scroll', hide, true);
})();
