/* Perses voice: hands-free conversation and the most natural browser voice available */
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let on = false, rec = null, ui = null, lastReply = '', token = 0;
  const vlang = () => localStorage.getItem('perses_vlang') || 'en-IN';
  const rate = () => +(localStorage.getItem('perses_rate') || 1);

  const SCRIPTS = [[/[\u0900-\u097F]/, 'hi-IN'], [/[\u0980-\u09FF]/, 'bn-IN'], [/[\u0B80-\u0BFF]/, 'ta-IN'], [/[\u0C00-\u0C7F]/, 'te-IN'], [/[\u0A80-\u0AFF]/, 'gu-IN'], [/[\u0A00-\u0A7F]/, 'pa-IN'], [/[\u0C80-\u0CFF]/, 'kn-IN'], [/[\u0D00-\u0D7F]/, 'ml-IN'], [/[\u0600-\u06FF]/, 'ur-IN']];
  const langOf = t => { for (const [re, l] of SCRIPTS) if (re.test(t)) return l; return vlang(); };
  const norm = l => String(l || '').toLowerCase().replace('_', '-');

  function pick(lang) {
    const all = speechSynthesis.getVoices(), base = norm(lang).slice(0, 2);
    const same = all.filter(v => norm(v.lang).startsWith(base));
    const saved = localStorage.getItem('perses_voice');
    const s = saved && same.find(v => v.name === saved); if (s) return s;
    const score = v => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google|siri|enhanced|premium/i.test(v.name) ? 2 : 0) + (norm(v.lang) === norm(lang) ? 1 : 0);
    return same.sort((a, b) => score(b) - score(a))[0] || null;
  }
  function clean(t) {
    return t.replace(/```[\s\S]*?```/g, ' code block. ').replace(/`[^`]*`/g, '').replace(/\$\$[\s\S]*?\$\$/g, ' formula ').replace(/\$[^$\n]+\$/g, ' formula ')
      .replace(/https?:\/\/\S+/g, '').replace(/[*#_>|~]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s+/g, ' ').trim();
  }
  function speak(text, done) {
    if (!('speechSynthesis' in window)) { done && done(); return; }
    speechSynthesis.cancel();
    const lang = langOf(text), voice = pick(lang);
    const parts = clean(text).match(/[^.!?\u0964\n]+[.!?\u0964]*/g) || [];
    if (!parts.length) { done && done(); return; }
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim()); u.lang = lang; u.rate = rate(); if (voice) u.voice = voice;
      if (i === parts.length - 1) { u.onend = () => done && done(); u.onerror = () => done && done(); }
      speechSynthesis.speak(u);
    });
  }
  window.listen = text => { if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; } speak(text); };
  window.perses_speak = speak;

  function setState(s, text) {
    if (!ui) return;
    ui.className = 'voice-ov ' + s;
    ui.querySelector('#vStatus').textContent = { listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking... (tap the circle to interrupt)' }[s] || '';
    if (text !== undefined) ui.querySelector('#vText').textContent = text;
  }
  function showUi() {
    ui = document.createElement('div'); ui.className = 'voice-ov';
    ui.innerHTML = '<div class="orb"><span class="glow"></span><span class="ring r3"></span><span class="ring r2"></span><span class="ring r1"></span><img alt="Perses"></div><div id="vStatus"></div><div id="vText"></div><div class="vh">Speak naturally. Perses answers out loud.</div><button class="btn" id="vEnd">End voice chat</button>';
    ui.querySelector('img').src = CONFIG.LOGO_URL;
    ui.querySelector('#vEnd').onclick = stop;
    ui.querySelector('.orb').onclick = () => { if (speechSynthesis.speaking) { token++; speechSynthesis.cancel(); listenOnce(); } };
    document.body.append(ui);
  }
  function listenOnce() {
    if (!on) return;
    setState('listening', '');
    rec = new SR(); rec.lang = vlang(); rec.interimResults = true; rec.continuous = false;
    let finalT = '', got = false;
    rec.onresult = e => {
      let t = ''; for (const r of e.results) t += r[0].transcript;
      if (ui) ui.querySelector('#vText').textContent = t;
      if (e.results[e.results.length - 1].isFinal) { finalT = t; got = true; }
    };
    rec.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { toast('Please allow microphone access.'); stop(); } };
    rec.onend = () => { rec = null; if (!on) return; if (got && finalT.trim()) ask(finalT.trim()); else setTimeout(listenOnce, 350); };
    try { rec.start(); } catch { setTimeout(listenOnce, 600); }
  }
  async function ask(text) {
    setState('thinking', text); lastReply = '';
    await send(text);
    if (!on) return;
    if (!lastReply) { toast('Voice chat stopped.'); stop(); return; }
    setState('speaking', lastReply.slice(0, 160));
    const t = ++token;
    speak(lastReply, () => { if (on && t === token) listenOnce(); });
  }
  function start() {
    if (!SR) { toast('Voice chat needs Chrome, Edge or Safari.'); return; }
    if (busy) { toast('Wait for the current reply to finish.'); return; }
    on = true; showUi(); listenOnce();
  }
  function stop() { on = false; token++; try { rec && rec.abort(); } catch {} rec = null; speechSynthesis.cancel(); if (ui) { ui.remove(); ui = null; } }

  Perses.afterReply.push((chat, msg) => { if (on) lastReply = msg.content; });
  Perses.bodyExtra.push(() => on ? { voice: true } : {});

  function voiceMenu(anchor) {
    const lang = vlang(), base = norm(lang).slice(0, 2);
    const list = speechSynthesis.getVoices().filter(v => norm(v.lang).startsWith(base)).slice(0, 14);
    if (!list.length) { toast('No voices found for this language on your device.'); return; }
    popMenu(anchor, list.map(v => [v.name, () => { localStorage.setItem('perses_voice', v.name); speak('Hello, I am Perses.'); toast('Voice: ' + v.name); }]), true);
  }
  function speedMenu(anchor) {
    popMenu(anchor, [['Slow', 0.8], ['Normal', 1], ['Fast', 1.2], ['Very fast', 1.45]].map(([n, v]) => [n, () => { localStorage.setItem('perses_rate', v); speak('This is how fast I speak.'); }]), true);
  }
  Perses.attach.push(() => ['Voice chat (talk back and forth)', start]);
  Perses.attach.push(() => ['Choose speaking voice', () => voiceMenu($('#attachBtn'))]);
  Perses.attach.push(() => ['Speaking speed', () => speedMenu($('#attachBtn'))]);
  Perses.onStart(() => {
    if ($('#voiceBtn')) return;
    const b = document.createElement('button'); b.id = 'voiceBtn'; b.className = 'btn'; b.textContent = 'Voice chat'; b.onclick = start;
    $('#themeBtn').before(b);
  });
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};
})();
