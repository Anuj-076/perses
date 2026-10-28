/* Perses onboarding tour: runs once after a new account is set up. Replay it from the account menu. */
(() => {
  const STEPS = [
    { t: 'Welcome to Perses', d: 'A quick 30-second tour. Perses is your AI for help: chat, learn, write, code, solve math, read documents and create images.' },
    { t: 'Pick a mode', d: 'Modes change how Perses answers. Study Focus explains, Code Helper writes code, Math Solver shows steps, Artist makes images and Writer polishes text.', el: '#modes', side: true },
    { t: 'Organize with projects', d: 'Press + to make a project. Each project can have its own instructions, and your chats can live inside it.', el: '#newProject', side: true },
    { t: 'The plus button', d: 'Take a photo, upload an image, create an image, search the web, attach a PDF, Word or Excel file, edit images, start voice chat or open templates.', el: '#attachBtn' },
    { t: 'Slash tags', d: 'Type / in the message box for quick tags: /image, /prompt, /code, /write, /math and /summarize.', el: '#input' },
    { t: 'Talk to Perses', d: 'Use the microphone to dictate, or Voice chat at the top for a hands-free conversation.', el: '#micBtn' },
    { t: 'Your account menu', d: 'Settings, memory, custom background, the guide and more are in this menu.', el: '#userBtn', side: true },
    { t: 'You are ready', d: 'Say hello, or try a suggestion. You can replay this tour any time from your account menu.' }
  ];
  let ov, hl, tip, i = 0;
  const mobile = () => innerWidth <= 820;

  function end() { ov && ov.remove(); hl && hl.remove(); tip && tip.remove(); ov = hl = tip = null; els.app.classList.remove('open'); }
  function show() {
    const s = STEPS[i];
    if (mobile()) els.app.classList.toggle('open', !!s.side);
    setTimeout(() => {
      const el = s.el && $(s.el);
      let r = null;
      if (el && el.offsetParent !== null) { el.scrollIntoView({ block: 'nearest' }); r = el.getBoundingClientRect(); }
      if (r) hl.style.cssText = `display:block;left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`;
      else hl.style.display = 'none';
      tip.innerHTML = `<h4>${s.t}</h4><p>${s.d}</p><div class="row"><span>${i + 1} of ${STEPS.length}</span><button class="btn" id="tSkip">${i === STEPS.length - 1 ? '' : 'Skip'}</button>${i ? '<button class="btn" id="tBack">Back</button>' : ''}<button class="btn pri" id="tNext">${i === STEPS.length - 1 ? 'Finish' : 'Next'}</button></div>`;
      if (i === STEPS.length - 1) $('#tSkip').remove();
      $('#tNext').onclick = () => { if (++i >= STEPS.length) end(); else show(); };
      if ($('#tBack')) $('#tBack').onclick = () => { i--; show(); };
      if ($('#tSkip')) $('#tSkip').onclick = end;
      if (mobile()) tip.style.cssText = 'left:12px;right:12px;bottom:12px;top:auto;transform:none;width:auto';
      else if (r) {
        let left = r.right + 16, top = r.top;
        if (left + 340 > innerWidth) { left = Math.max(12, r.left); top = r.bottom + 16; if (top + 210 > innerHeight) top = Math.max(12, r.top - 226); }
        tip.style.cssText = `left:${left}px;top:${Math.max(12, Math.min(top, innerHeight - 220))}px;transform:none`;
      } else tip.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)';
    }, 280);
  }
  function start() {
    if (ov) return; i = 0;
    ov = document.createElement('div'); ov.className = 'tour-ov';
    hl = document.createElement('div'); hl.className = 'tour-hl';
    tip = document.createElement('div'); tip.className = 'tour-tip';
    document.body.append(ov, hl, tip); show();
  }
  Perses.menu.push(() => user ? ['Replay tour', start] : null);
  Perses.onStart(() => {
    if (guest || !user) return;
    const k = 'perses_tour_' + user.id;
    if (!localStorage.getItem(k)) { localStorage.setItem(k, '1'); setTimeout(start, 1200); }
  });
})();
