/* ============================ SETTINGS ============================ */
const C = window.PERSES_CONFIG || {};
const CONFIG = {
  API_BASE: "",
  SUPABASE_URL: C.SUPABASE_URL, SUPABASE_ANON_KEY: C.SUPABASE_ANON_KEY,
  LOGO_URL: C.LOGO_URL, LOGO_NOBG: C.LOGO_NOBG,
  CONTACT_EMAIL: C.CONTACT_EMAIL || 'your-email@example.com',
  CHECKOUT: C.CHECKOUT || {},
  ADMINS: (C.ADMINS || []).map(x => x.toLowerCase()), OWNER_EMAIL: (C.OWNER_EMAIL || '').toLowerCase(),
  LIMITS: { free: { msgs: 100, imgs: 3 }, pro: { msgs: 1000, imgs: 15 }, elite: { msgs: 5000, imgs: 40 } },
  PLANS: [
    { id: 'free', name: 'Perses (Free)', price: '$0', per: '', tag: 'Great for getting started.',
      pros: ['100 messages per day', '3 AI images per day', 'Up to 3 projects', 'Read PDF, Word and Excel files', 'Code runner, live preview and voice chat', 'Share chats by link', 'Voice input, camera and web search'],
      cons: ['Small "Perses" watermark on images', 'Standard speed, slower when busy', 'No folder colors or custom background'] },
    { id: 'pro', name: 'Perses Pro', price: '$5.99', per: ' / month', tag: 'For everyday power users.', badge: 'Most popular',
      pros: ['1,000 messages per day', '15 AI images per day', 'Up to 20 projects with folder colors', 'No watermark on images', 'Faster, smarter replies', 'Custom background from your gallery', 'Everything in Free'],
      cons: ['Daily fair-use limits still apply'] },
    { id: 'elite', name: 'Perses Elite', price: '$10.99', per: ' / month', tag: 'The complete Perses experience.', badge: 'Best value',
      pros: ['5,000 messages per day', '40 AI images per day', 'Up to 100 projects with folder colors', 'No watermark on images', 'Deep-thinking mode for hard questions', 'Top priority, least waiting', 'Custom background from your gallery', 'Early access to new features', 'Everything in Pro'],
      cons: ['Fair-use limits apply to prevent abuse'] }
  ],
  TEMPLATES: [
    { i: 'Resume', t: 'Resume writer', d: 'Build a strong resume', p: 'Write a professional resume for me. My name: [name]. Target job: [job]. My experience and skills: [details].' },
    { i: 'Letter', t: 'Cover letter', d: 'Tailored to a job', p: 'Write a cover letter for the position of [job] at [company]. About me: [short background].' },
    { i: 'Email', t: 'Email draft', d: 'Polite and clear', p: 'Write a professional email to [person] about [topic]. Tone: [formal / friendly]. Keep it short.' },
    { i: 'Simple', t: "Explain like I'm 10", d: 'Simple explanations', p: "Explain [topic] like I'm 10 years old, with a fun example." },
    { i: 'Summary', t: 'Summarize text', d: 'Short and clear', p: '/summarize [paste text]' },
    { i: 'Study', t: 'Study plan', d: 'Plan your prep', p: 'Make a 7-day study plan for [subject/exam]. I can study [hours] hours a day. My weak topics: [topics].' },
    { i: 'Code', t: 'Fix my code', d: 'Find the bug', p: '/code Find and fix the bug in this [language] code, and explain what was wrong:\n\n[paste code]' },
    { i: 'Hindi', t: 'Translate to Hindi', d: 'Natural translation', p: 'Translate the following to natural, simple Hindi:\n\n[text]' },
    { i: 'Social', t: 'Social media post', d: 'Catchy captions', p: 'Write 3 catchy Instagram captions with hashtags about [topic]. Tone: [fun / professional].' },
    { i: 'Interview', t: 'Interview practice', d: 'Mock interview', p: 'Act as an interviewer for a [job] role. Ask me one question at a time and give feedback on my answers.' },
    { i: 'Prompt', t: 'Make me a prompt', d: 'Prompt generator', p: '/prompt [describe what you want an AI to do]' },
    { i: 'Math', t: 'Solve step by step', d: 'Math with formulas', p: '/math [problem]' }
  ],
  VOICE_LANGS: [['en-IN', 'English (India)'], ['hi-IN', 'Hindi'], ['en-US', 'English (US)'], ['bn-IN', 'Bengali'], ['ta-IN', 'Tamil'], ['te-IN', 'Telugu'], ['mr-IN', 'Marathi'], ['gu-IN', 'Gujarati'], ['pa-IN', 'Punjabi'], ['kn-IN', 'Kannada'], ['ml-IN', 'Malayalam'], ['ur-IN', 'Urdu']]
};
const MODES_UI = [
  { id: 'default', name: 'General' }, { id: 'study', name: 'Study Focus' }, { id: 'code', name: 'Code Helper' },
  { id: 'math', name: 'Math Solver' }, { id: 'artist', name: 'Artist' }, { id: 'writer', name: 'Writer' }
];
/* Slash tags: type /code, /write ... at the start of a message */
const TAGS = {
  prompt: { mode: 'default', tpl: t => `Write a detailed, ready-to-use AI prompt for the task below. Include the role, context, constraints, output format and, if helpful, a short example. Output ONLY the prompt inside one code block, then one short line on how to use it.\n\nTask: ${t}` },
  code: { mode: 'code', tpl: t => t },
  write: { mode: 'writer', tpl: t => t },
  math: { mode: 'math', tpl: t => t },
  summarize: { mode: 'default', tpl: t => t ? `Summarize the following in clear bullet points, then give a one-line takeaway:\n\n${t}` : 'Summarize the document I shared (if there is none, ask me to paste the text or attach a file): key points first, then a one-line takeaway.', optional: true }
};
const TAG_LIST = [['image', 'Create a picture'], ['prompt', 'Write a ready-to-use AI prompt'], ['code', 'Write or fix code'], ['write', 'Polished writing'], ['math', 'Solve step by step'], ['summarize', 'Summarize text or a document']];
const INFO = {
  about: ['About Perses', `<p><b>Perses - Your AI for Help.</b> Chat, learn, write, code, solve math, read documents, understand images, create images, and talk to it in English, Hindi and more.</p>
    <h3>Who made it?</h3><p>Perses was created by its founder, <b>Anuj Jha</b>, and was established on <b>26 October 2026</b>.</p>
    <h3>What can it do?</h3><ul><li>Answer questions and explain topics step by step</li><li>Write and fix code, run Python and JavaScript, preview web pages</li><li>Solve math with formulas</li><li>Read PDF, Word and Excel files</li><li>Read and describe your photos, create and restyle images</li><li>Search the web with sources</li><li>Voice input, voice chat, Hindi and other Indian languages</li><li>Modes, projects, pinned chats, share links and automatic memory</li></ul>
    <h3>What does it cost?</h3><p>Free (100 messages and 3 images a day), Pro ($5.99/month) and Elite ($10.99/month). Yearly plans save 10%. New accounts can try Pro free for 3 days.</p>
    <p><small>Contact: \${EMAIL}</small></p>`],
  guide: ['Guide', `<h3>Slash tags</h3><p>Type <b>/</b> at the start of a message and pick one:</p>
    <ul><li><b>/image</b> a cozy cabin at sunrise: create a picture</li><li><b>/prompt</b> write a cold email: get a ready-to-use AI prompt</li><li><b>/code</b> a Python function to reverse a list: code with explanation</li><li><b>/write</b> a farewell speech for my teacher: polished writing</li><li><b>/math</b> solve 2x^2 - 5x + 2 = 0: step by step with formulas</li><li><b>/summarize</b> your text or attached document: short summary</li></ul>
    <h3>Modes</h3><p>Pick a mode in the sidebar: General, Study Focus, Code Helper, Math Solver, Artist, Writer. Each one changes how Perses answers.</p>
    <h3>The + button</h3><p>Take a photo, upload an image, create an image, turn on web search, attach a PDF/Word/Excel file, use image tools, start voice chat, or open prompt templates.</p>
    <h3>Code boxes</h3><p>Every code box has a Copy button. JavaScript and Python boxes have Run, and HTML boxes have Preview.</p>
    <h3>Organize</h3><p>Use the three dots on a chat to pin, rename, move to a project, share a link or export. On any answer, tap Branch to start a new chat from that point.</p>
    <h3>Memory</h3><p>Say "remember that I prefer short answers" and Perses will keep it. Automatic memory can also learn your preferences. Edit or turn it off in Settings.</p>`],
  privacy: ['Privacy Policy', `<p><small>Last updated: 28 October 2026</small></p>
    <h3>What we collect</h3><ul><li>Account details: email, username, your name, birthday, optional profile photo</li><li>The messages, images and documents you send, so Perses can reply</li><li>Usage counts (to apply daily limits) and thumbs up/down ratings</li><li>A short memory of your preferences (you control it in Settings)</li><li>Chats you choose to share by link (text only), stored until you stop sharing</li></ul>
    <h3>How it is used</h3><p>Your messages and documents are sent to our servers and to third-party AI service providers only to create replies and images. Your chat history, projects and folders are stored in your own browser. We do not sell your personal data.</p>
    <h3>Your choices</h3><p>You can edit your details in Settings, turn off automatic memory, delete chats any time, and delete your whole account from Settings (we email you a code to confirm). Questions: \${EMAIL}</p>
    <h3>Age</h3><p>Perses is for people aged 13 and over.</p>`],
  terms: ['Terms of Use', `<p><small>Last updated: 28 October 2026</small></p>
    <ul><li>Use Perses lawfully. Do not use it to harm, harass, deceive or break the law.</li><li>AI can be wrong. Check important information, and do not rely on Perses for medical, legal or financial decisions.</li><li>Code you run from a Run button executes in a sandbox on your device. Review code before running it.</li><li>Daily limits apply to each plan. We may change features, limits and prices, and may suspend accounts that abuse the service.</li><li>Paid plans renew until cancelled. Refund rules will be shown at checkout. The free Pro trial is one per account.</li><li>You are responsible for the content you submit and for chats you share by link.</li><li>The service is provided "as is" without guarantees.</li></ul>
    <p>Questions: \${EMAIL}</p>`]
};
/* ================================================================== */

const $ = s => document.querySelector(s);
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const RANK = { free: 0, pro: 1, elite: 2 };
const PLAN_NAME = { free: 'Perses Free', pro: 'Perses Pro', elite: 'Perses Elite' };
const PROJECT_LIMIT = { free: 3, pro: 20, elite: 100 };
const PCOLORS = [['#ff5a00', 'Orange'], ['#e5484d', 'Red'], ['#f5b700', 'Yellow'], ['#30a46c', 'Green'], ['#0091ff', 'Blue'], ['#8e4ec6', 'Purple']];
const SHARE_ID = new URLSearchParams(location.search).get('s');

/* Plugin hooks: extra files (docs.js, voice.js ...) plug in here */
const Perses = {
  attach: [], menu: [], afterReply: [], bodyExtra: [], enhancers: [], starters: [], opened: [], imageTools: [], started: false,
  onStart(fn) { this.starters.push(fn); if (this.started) { try { fn(); } catch (e) { console.error(e); } } },
  fire(list, ...a) { list.forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }
};

let user = null, profile = null, booted = null, guest = true, guestStarted = false;
let chats = [], projects = [], activeProject = null, currentId = null, pending = [], busy = false, abortCtl = null, authMode = 'login';
let mode = localStorage.getItem('perses_mode') || 'default', imgMode = false, searchMode = false, tagOpen = false;

const els = { app: $('#app'), history: $('#history'), messages: $('#messages'), welcome: $('#welcome'), scroll: $('#scroll'), input: $('#input'), send: $('#sendBtn'), previews: $('#previews'), file: $('#fileInput') };
function plan() {
  if (guest) return 'free';
  const p = profile?.plan || 'free';
  if (p !== 'free' && profile?.plan_expires && new Date(profile.plan_expires) < new Date()) return 'free';
  return p;
}
const isPremium = () => !guest && plan() !== 'free';
const dispName = () => profile?.display_name || profile?.username || 'Guest';

document.querySelectorAll('[data-logo]').forEach(i => { i.src = CONFIG.LOGO_URL; i.onerror = () => { i.style.visibility = 'hidden'; }; });

/* ---------------- helpers ---------------- */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Markdown + math ($...$, $$...$$, \(...\), \[...\]) */
function md(text) {
  const maths = [];
  const stash = (m, d) => { maths.push([m.trim(), d]); return `@@M${maths.length - 1}@@`; };
  const parts = String(text || '').split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  const src = parts.map((p, i) => i % 2 ? p : p
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => stash(m, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => stash(m, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => stash(m, false))
    .replace(/(^|[^\\$\w])\$(?!\s)([^$\n]+?)\$(?![\w$])/g, (s, pre, m) => /\s$/.test(m) ? s : pre + stash(m, false))
  ).join('');
  let html = DOMPurify.sanitize(marked.parse(src, { gfm: true, breaks: true }));
  html = html.replace(/@@M(\d+)@@/g, (_, i) => { const [m, d] = maths[+i]; return `<span class="tex" data-d="${d ? 1 : 0}" data-t="${esc(m)}"></span>`; });
  return html;
}
function enhance(root) {
  root.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  root.querySelectorAll('.tex').forEach(el => {
    if (el.dataset.done) return; el.dataset.done = 1;
    try { katex.render(el.dataset.t, el, { displayMode: el.dataset.d === '1', throwOnError: false }); } catch { el.textContent = el.dataset.t; }
  });
  root.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('codebox')) return;
    const code = pre.querySelector('code'); if (!code) return;
    const lang = (code.className.match(/language-(\S+)/) || [])[1] || 'code';
    try { hljs.highlightElement(code); } catch {}
    const box = document.createElement('div'); box.className = 'codebox'; box.dataset.lang = lang;
    const bar = document.createElement('div'); bar.className = 'codebar';
    const l = document.createElement('span'); l.textContent = lang;
    const b = document.createElement('button'); b.className = 'copy'; b.textContent = 'Copy';
    bar.append(l, b); pre.replaceWith(box); box.append(bar, pre);
  });
  Perses.fire(Perses.enhancers, root);
}
const nearBottom = () => els.scroll.scrollHeight - els.scroll.scrollTop - els.scroll.clientHeight < 140;
const toBottom = () => { els.scroll.style.scrollBehavior = 'auto'; els.scroll.scrollTop = els.scroll.scrollHeight; };
function autosize() { els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px'; }
function setBusy(b) { busy = b; $('#sendIcon').style.display = b ? 'none' : ''; $('#stopIcon').style.display = b ? '' : 'none'; els.send.classList.toggle('stop', b); }
function screen(name) {
  if (SHARE_ID && name === 'app') name = 'shareView';
  ['auth', 'nameScreen', 'resetScreen', 'shareView'].forEach(id => { $('#' + id).hidden = id !== name; });
  $('#app').hidden = name !== 'app';
}
const open = id => { $('#' + id).hidden = false; };
const close = id => { $('#' + id).hidden = true; };

/* ---- in-app pop-up dialogs ---- */
function dialog({ title, text = '', input = false, multiline = false, value = '', ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise(res => {
    const d = $('#dlg'), f = $('#dlgField'), ta = $('#dlgArea'), okb = $('#dlgOk'), cb = $('#dlgCancel');
    $('#dlgTitle').textContent = title; $('#dlgText').textContent = text; $('#dlgText').hidden = !text;
    f.hidden = !(input && !multiline); ta.hidden = !(input && multiline);
    const fld = multiline ? ta : f; fld.value = value;
    okb.textContent = ok; cb.textContent = cancel; cb.hidden = !cancel; okb.classList.toggle('danger', danger);
    d.hidden = false; setTimeout(() => (input ? fld : okb).focus(), 40);
    const done = v => { d.hidden = true; okb.onclick = cb.onclick = d.onclick = d.onkeydown = null; res(v); };
    okb.onclick = () => done(input ? fld.value : true);
    cb.onclick = () => done(null);
    d.onclick = e => { if (e.target === d) done(null); };
    d.onkeydown = e => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter' && input && !multiline) { e.preventDefault(); done(fld.value); }
    };
  });
}
const uiConfirm = (title, text, ok = 'Delete') => dialog({ title, text, ok, danger: true }).then(v => v === true);
const uiPrompt = (title, value, ok = 'Save') => dialog({ title, input: true, value, ok });

/* ---- small floating menu ---- */
function popMenu(anchor, items, up = false) {
  const m = $('#rowMenu'); m.innerHTML = '';
  items.forEach(([label, fn, danger]) => {
    const b = document.createElement('button'); b.textContent = label; if (danger) b.className = 'danger';
    b.onclick = e => { e.stopPropagation(); m.hidden = true; fn(); }; m.append(b);
  });
  const r = anchor.getBoundingClientRect(); m.hidden = false;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  m.style.top = Math.max(8, up ? r.top - h - 8 : Math.min(r.bottom + 4, innerHeight - h - 8)) + 'px';
}
document.addEventListener('click', () => { $('#rowMenu').hidden = true; });

/* modals */
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => close(b.dataset.close));
document.querySelectorAll('.modal:not(#dlg)').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal:not(#dlg)').forEach(m => { m.hidden = true; }); });
function openInfo(k) { $('#infoTitle').textContent = INFO[k][0]; $('#infoBody').innerHTML = INFO[k][1].replaceAll('${EMAIL}', esc(CONFIG.CONTACT_EMAIL)); open('infoModal'); }
document.querySelectorAll('[data-info]').forEach(b => b.onclick = () => openInfo(b.dataset.info));

/* cookie notice (sits over the chat) */
if (!localStorage.getItem('perses_cookie')) $('#cookie').hidden = false;
$('#cookieOk').onclick = () => { localStorage.setItem('perses_cookie', '1'); $('#cookie').hidden = true; };

/* ---------------- theme ---------------- */
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('perses_theme', t); $('#themeBtn').textContent = t === 'dark' ? 'Light mode' : 'Dark mode'; }
const toggleTheme = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
$('#themeBtn').onclick = toggleTheme;

/* ---------------- login / sign up ---------------- */
function authMsg(text, type = '') { const m = $('#authMsg'); m.textContent = text; m.className = 'amsg ' + type; }
function friendly(msg = '') {
  if (/not confirmed/i.test(msg)) return 'Please verify your email first. Check your inbox (and spam) for the Verify button.';
  if (/invalid login/i.test(msg)) return 'Wrong email or password.';
  if (/rate limit/i.test(msg)) return 'Too many emails sent. Please wait a few minutes and try again.';
  return msg;
}
function setAuthMode(m) {
  authMode = m;
  document.querySelectorAll('#authTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('#authBtn').textContent = m === 'login' ? 'Log in' : 'Create account';
  $('#authTitle').textContent = m === 'login' ? 'Welcome back' : 'Create your account';
  $('#pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('#authForm').hidden = false; $('#forgot').hidden = m !== 'login'; authMsg('');
}
document.querySelectorAll('#authTabs button').forEach(b => b.onclick = () => setAuthMode(b.dataset.m));
const showAuth = m => { setAuthMode(m); screen('auth'); };
$('#loginSide').onclick = () => { els.app.classList.remove('open'); showAuth('login'); };
$('#loginTop').onclick = () => showAuth('login');
$('#authClose').onclick = () => screen('app');

$('#authForm').onsubmit = async e => {
  e.preventDefault(); authMsg(''); $('#authBtn').disabled = true;
  const email = $('#email').value.trim(), password = $('#pass').value;
  try {
    if (authMode === 'signup') {
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      $('#authForm').hidden = true; $('#forgot').hidden = true;
      authMsg(`We sent a verification email to ${email}. Click the Verify button inside it. Then you'll set up your profile. (Check spam if you don't see it.)`, 'ok');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) { authMsg(friendly(err.message), 'err'); }
  $('#authBtn').disabled = false;
};
$('#googleBtn').onclick = async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) authMsg(friendly(error.message), 'err');
};
$('#forgot').onclick = async () => {
  const email = $('#email').value.trim();
  if (!email) return authMsg('Type your email above first.', 'err');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  error ? authMsg(friendly(error.message), 'err') : authMsg('If that email has an account, a reset link is on its way.', 'ok');
};
$('#resetForm').onsubmit = async e => {
  e.preventDefault();
  const { error } = await sb.auth.updateUser({ password: $('#newpass').value });
  if (error) { $('#resetMsg').textContent = error.message; $('#resetMsg').className = 'amsg err'; return; }
  booted = null; const { data: { session } } = await sb.auth.getSession(); if (session) boot(session);
};

/* ---------------- onboarding ---------------- */
const ageOf = b => { const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); const m = n.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--; return a; };
function checkBirthday(bd) {
  if (!bd) return 'Please choose your birthday.';
  const a = ageOf(bd);
  if (isNaN(a) || a < 0 || a > 120) return 'That birthday does not look right.';
  if (a < 13) return 'Perses is for people aged 13 and over.';
  return '';
}
let nameTimer;
function watchUsername(inputEl, hintEl) {
  inputEl.oninput = () => {
    clearTimeout(nameTimer); const v = inputEl.value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(v)) { hintEl.textContent = '3-20 letters, numbers or _ only'; hintEl.className = 'uhint'; return; }
    hintEl.textContent = 'Checking...'; hintEl.className = 'uhint';
    nameTimer = setTimeout(async () => {
      const { data } = await sb.rpc('username_available', { p_name: v });
      if (inputEl.value.trim() !== v) return;
      hintEl.textContent = data ? 'Available' : 'Already taken'; hintEl.className = 'uhint ' + (data ? 'ok' : 'bad');
    }, 400);
  };
}
watchUsername($('#uname'), $('#unameHint'));
$('#nameForm').onsubmit = async e => {
  e.preventDefault();
  const username = $('#uname').value.trim(), display_name = $('#dname').value.trim(), birthday = $('#bday').value, m = $('#nameMsg');
  m.className = 'amsg err';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) { m.textContent = 'Username: 3-20 letters, numbers or _ only.'; return; }
  if (!display_name) { m.textContent = 'Please enter your name.'; return; }
  const bErr = checkBirthday(birthday); if (bErr) { m.textContent = bErr; return; }
  const { error } = await sb.from('profiles').update({ username, display_name, birthday }).eq('id', user.id);
  if (error) { m.textContent = error.code === '23505' ? 'That username is already taken. Try another.' : error.message; return; }
  Object.assign(profile, { username, display_name, birthday }); startApp();
};
$('#logoutName').onclick = () => sb.auth.signOut();

/* ---------------- session handling ---------------- */
async function loadProfile() {
  for (let i = 0; i < 4; i++) {
    const { data } = await sb.from('profiles').select('username,plan,display_name,birthday,avatar,memory,plan_expires,trial_used').eq('id', user.id).maybeSingle();
    if (data) { profile = data; return data; }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}
async function boot(session) {
  if (booted === session.user.id) return;
  booted = session.user.id; user = session.user;
  const p = await loadProfile();
  if (!p) { booted = null; showAuth('login'); authMsg('Could not load your profile. Did you run the SQL setup in Supabase?', 'err'); return; }
  if (!p.username || !p.display_name || !p.birthday) {
    $('#uname').value = p.username || ''; $('#dname').value = p.display_name || ''; $('#bday').value = p.birthday || '';
    screen('nameScreen'); return;
  }
  startApp();
}
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') { screen('resetScreen'); return; }
  if (ev === 'SIGNED_OUT') { booted = null; user = null; profile = null; setAuthMode('login'); startGuest(true); return; }
  if (ev === 'INITIAL_SESSION' && !session) { startGuest(); return; }
  if (session && ['SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED'].includes(ev)) setTimeout(() => boot(session), 0);
});

function resetUi() { chats = loadChats(); projects = loadProjects(); activeProject = null; currentId = null; els.messages.innerHTML = ''; }
function startApp() {
  guest = false; guestStarted = true; document.body.classList.remove('guest'); screen('app'); resetUi();
  paintUser(); paintPlan(); applyBg(); refreshUsage(); renderModes(); newChat(); fx.start(); birthdayCheck();
  Perses.started = true; Perses.fire(Perses.starters);
}
function startGuest(force) {
  if (guestStarted && guest && !force) return;
  guestStarted = true; guest = true; user = null; profile = null;
  document.body.classList.add('guest'); document.body.classList.remove('has-bg'); screen('app'); resetUi();
  paintUser(); renderModes(); $('#usage').textContent = 'Guest trial: sign up free for 100 messages a day'; newChat(); fx.start();
  Perses.started = true; Perses.fire(Perses.starters);
}
function paintUser() {
  const a = $('#uAva');
  if (profile?.avatar) { a.style.backgroundImage = `url("${profile.avatar}")`; a.textContent = ''; }
  else { a.style.backgroundImage = ''; a.textContent = (dispName()[0] || 'P').toUpperCase(); }
  $('#uName').textContent = dispName();
  $('#wHello').textContent = profile ? `Hello, ${dispName()}. Your AI for Help` : 'Your AI for Help';
}
function paintPlan() { $('#uPlan').textContent = PLAN_NAME[plan()]; $('#upgradeSide').hidden = $('#upgradeTop').hidden = plan() === 'elite'; }
window.addEventListener('focus', async () => {
  if (!user || !profile) return;
  const { data } = await sb.from('profiles').select('plan,plan_expires').eq('id', user.id).maybeSingle();
  if (data && (data.plan !== profile.plan || data.plan_expires !== profile.plan_expires)) { Object.assign(profile, data); paintPlan(); applyBg(); refreshUsage(); renderHistory(); }
});
async function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (user) { const { data: { session } } = await sb.auth.getSession(); h.Authorization = 'Bearer ' + (session?.access_token || ''); }
  else {
    let g = localStorage.getItem('perses_gid');
    if (!g) { g = crypto.randomUUID ? crypto.randomUUID() : uid() + uid() + uid(); localStorage.setItem('perses_gid', g); }
    h['X-Guest-Id'] = g;
  }
  return h;
}
async function refreshUsage() {
  if (guest) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('usage').select('kind,n').eq('day', day);
    const u = { msgs: 0, imgs: 0 }; (data || []).forEach(r => { u[r.kind] = r.n; });
    const L = CONFIG.LIMITS[plan()];
    $('#usage').textContent = `${u.msgs}/${L.msgs} messages, ${u.imgs}/${L.imgs} images today`;
  } catch {}
}
function confetti() {
  const col = ['#ff5a00', '#ff9a3c', '#f5b700', '#30a46c', '#0091ff', '#8e4ec6'];
  for (let i = 0; i < 50; i++) {
    const s = document.createElement('span'); s.className = 'conf';
    s.style.cssText = `left:${Math.random() * 100}vw;width:${6 + Math.random() * 7}px;height:${10 + Math.random() * 10}px;background:${col[i % 6]};animation-delay:${Math.random() * 1.5}s;border-radius:2px`;
    document.body.append(s); setTimeout(() => s.remove(), 5500);
  }
}
function birthdayCheck() {
  if (!profile?.birthday) return;
  const b = profile.birthday.split('-'), n = new Date();
  if (+b[1] !== n.getMonth() + 1 || +b[2] !== n.getDate()) return;
  const k = 'perses_bday_' + user.id + n.getFullYear(); if (localStorage.getItem(k)) return; localStorage.setItem(k, 1);
  confetti(); dialog({ title: `Happy Birthday, ${dispName()}!`, text: 'Wishing you an amazing year ahead. With love, Perses', ok: 'Thank you!', cancel: '' });
}

/* ---------------- storage (per account, on this device) ---------------- */
const CK = () => 'perses_chats_' + (user ? user.id : 'guest');
const PK = () => 'perses_projects_' + (user ? user.id : 'guest');
function loadChats() { try { return JSON.parse(localStorage.getItem(CK()) || '[]'); } catch { return []; } }
function loadProjects() { try { return JSON.parse(localStorage.getItem(PK()) || '[]'); } catch { return []; } }
function saveProjects() { try { localStorage.setItem(PK(), JSON.stringify(projects)); } catch {} }
function saveChats() {
  const arr = [...chats];
  for (;;) {
    try { localStorage.setItem(CK(), JSON.stringify(arr, (k, v) => (k === 'full' ? undefined : v))); return; }
    catch { if (arr.length <= 1) return; arr.pop(); }
  }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cur = () => chats.find(c => c.id === currentId);

/* ---------------- modes ---------------- */
function renderModes() {
  const box = $('#modes'); box.innerHTML = '';
  MODES_UI.forEach(m => {
    const b = document.createElement('button'); b.className = 'mode' + (m.id === mode ? ' on' : ''); b.textContent = m.name;
    b.onclick = () => pickMode(m.id); box.append(b);
  });
}
function pickMode(id) {
  mode = id; localStorage.setItem('perses_mode', id);
  const c = cur(); if (c) { c.mode = id; saveChats(); }
  imgMode = id === 'artist'; paintChips(); renderModes();
  toast(MODES_UI.find(m => m.id === id).name + ' mode on');
}

/* ---------------- projects ---------------- */
const pcolor = p => (isPremium() && p.color) ? p.color : 'var(--accent)';
async function newProject() {
  const lim = PROJECT_LIMIT[plan()];
  if (projects.length >= lim) { toast(`Your plan allows ${lim} projects.`); guest ? showAuth('signup') : openUpgrade(); return; }
  const n = await uiPrompt('New project', '', 'Create');
  if (!n || !n.trim()) return;
  projects.push({ id: uid(), name: n.trim().slice(0, 40), color: null, instr: '', open: true }); saveProjects(); renderHistory();
}
$('#newProject').onclick = newProject;
function projectMenu(p, anchor) {
  popMenu(anchor, [
    ['Rename', async () => { const n = await uiPrompt('Rename project', p.name); if (n && n.trim()) { p.name = n.trim().slice(0, 40); saveProjects(); renderHistory(); } }],
    ['Instructions', async () => {
      const v = await dialog({ title: 'Project instructions', text: 'Perses follows these in every chat inside this project.', input: true, multiline: true, value: p.instr || '', ok: 'Save' });
      if (v !== null) { p.instr = v.trim().slice(0, 1500); saveProjects(); toast('Instructions saved'); }
    }],
    ['Folder color' + (isPremium() ? '' : ' (Pro)'), () => {
      if (!isPremium()) { toast('Folder colors are a Pro & Elite feature.'); guest ? showAuth('signup') : openUpgrade(); return; }
      popMenu(anchor, PCOLORS.map(([c, n]) => [n, () => { p.color = c; saveProjects(); renderHistory(); }]));
    }],
    ['Delete project', async () => {
      if (!(await uiConfirm('Delete this project?', 'Its chats are kept and moved to Recent Chats.'))) return;
      chats.forEach(c => { if (c.project === p.id) c.project = null; });
      projects = projects.filter(x => x.id !== p.id); if (activeProject === p.id) activeProject = null;
      saveProjects(); saveChats(); renderHistory();
    }, true]
  ]);
}

/* ---------------- sidebar: chats ---------------- */
function chatRow(c) {
  const row = document.createElement('div'); row.className = 'h-item' + (c.id === currentId ? ' active' : '');
  const t = document.createElement('button'); t.className = 'h-title'; t.textContent = (c.pinned ? '[Pinned] ' : '') + c.title;
  t.onclick = () => { openChat(c.id); els.app.classList.remove('open'); };
  const d = document.createElement('button'); d.className = 'h-more'; d.textContent = '\u22EF'; d.title = 'More';
  d.onclick = e => {
    e.stopPropagation();
    popMenu(d, [
      [c.pinned ? 'Unpin' : 'Pin to top', () => { c.pinned = !c.pinned; saveChats(); renderHistory(); }],
      ['Rename', () => renameChat(c)],
      ['Move to project...', () => moveMenu(c, d)],
      ['Share link', () => shareChat(c)],
      ...(c.shareId ? [['Stop sharing', () => unshareChat(c)]] : []),
      ['Export as PDF', () => exportPdf(c)],
      ['Export as Markdown', () => exportMd(c)],
      ['Delete', () => deleteChat(c), true]
    ]);
  };
  row.append(t, d); return row;
}
function moveMenu(c, anchor) {
  if (!projects.length) { toast('Create a project first with the + next to PROJECTS.'); return; }
  const items = projects.map(p => [(c.project === p.id ? 'Selected: ' : '') + p.name, () => { c.project = p.id; p.open = true; saveChats(); saveProjects(); renderHistory(); toast('Moved to ' + p.name); }]);
  items.push(['No project', () => { c.project = null; saveChats(); renderHistory(); }]);
  popMenu(anchor, items);
}
function renderHistory() {
  const q = $('#chatSearch').value.trim().toLowerCase();
  const match = c => !q || c.title.toLowerCase().includes(q) || c.messages.some(m => (m.content || '').toLowerCase().includes(q));
  const sorted = [...chats].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);

  const pb = $('#projects'); pb.innerHTML = '';
  projects.forEach(p => {
    const list = sorted.filter(c => c.project === p.id && match(c));
    if (q && !list.length) return;
    const isOpen = q ? true : p.open !== false;
    const box = document.createElement('div'); box.className = 'proj'; box.style.setProperty('--pc', pcolor(p));
    const head = document.createElement('div'); head.className = 'p-head';
    const t = document.createElement('button'); t.className = 'p-title';
    t.innerHTML = `<span class="p-dot"></span><span class="n"></span><small>${list.length}</small><small>${isOpen ? '\u25BE' : '\u25B8'}</small>`;
    t.querySelector('.n').textContent = p.name;
    t.onclick = () => { p.open = !isOpen; saveProjects(); renderHistory(); };
    const plus = document.createElement('button'); plus.className = 'h-more'; plus.textContent = '+'; plus.title = 'New chat in this project';
    plus.onclick = e => { e.stopPropagation(); newChat(p.id); els.app.classList.remove('open'); };
    const more = document.createElement('button'); more.className = 'h-more'; more.textContent = '\u22EF'; more.title = 'Project options';
    more.onclick = e => { e.stopPropagation(); projectMenu(p, more); };
    head.append(t, plus, more); box.append(head);
    if (isOpen) {
      const body = document.createElement('div'); body.className = 'p-body';
      list.forEach(c => body.append(chatRow(c)));
      if (!list.length) { const em = document.createElement('div'); em.className = 'empty'; em.textContent = 'No chats yet'; body.append(em); }
      box.append(body);
    }
    pb.append(box);
  });

  els.history.innerHTML = '';
  const rec = sorted.filter(c => !c.project && match(c));
  if (!rec.length) els.history.innerHTML = `<div class="empty">${q ? 'No chats found' : 'No chats yet'}</div>`;
  rec.forEach(c => els.history.append(chatRow(c)));
}
$('#chatSearch').oninput = renderHistory;
async function deleteChat(c) {
  if (!(await uiConfirm('Delete this chat?', 'This will permanently remove the chat from this device.'))) return;
  chats = chats.filter(x => x.id !== c.id); saveChats(); if (c.id === currentId) newChat(); else renderHistory();
}
async function renameChat(c) {
  const v = await uiPrompt('Rename chat', c.title);
  if (v && v.trim()) { c.title = v.trim().slice(0, 60); saveChats(); renderHistory(); }
}
function exportMd(c) {
  const t = c.messages.map(m => `**${m.role === 'user' ? 'You' : 'Perses'}:**\n\n${m.image ? '[image]' : m.content}`).join('\n\n---\n\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`# ${c.title}\n\n${t}`], { type: 'text/markdown' }));
  a.download = (c.title || 'chat').replace(/[^\w\-]+/g, '_') + '.md'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportPdf(c) {
  const w = window.open('', '_blank'); if (!w) { toast('Please allow pop-ups to export'); return; }
  const plain = h => h.replace(/<span class="tex"[^>]*data-t="([^"]*)"[^>]*><\/span>/g, '$1');
  const rows = c.messages.map(m => `<div class="${m.role === 'user' ? 'u' : 'a'}"><b>${m.role === 'user' ? 'You' : 'Perses'}</b>${m.image ? `<p><img src="${m.image}"></p>` : plain(md(m.content))}</div>`).join('');
  w.document.write(`<!doctype html><title>${esc(c.title)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:30px auto;padding:0 16px;line-height:1.55}.u{background:#f1f1f1;padding:8px 12px;border-radius:10px;margin:14px 0}.a{margin:14px 0}h1{font-size:22px}pre{background:#f6f6f6;padding:10px;white-space:pre-wrap}img{max-width:100%}</style><h1>${esc(c.title)}</h1><p><small>Exported from Perses</small></p>${rows}`);
  w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500);
}
function newChat(pid = null) {
  if (busy) abortCtl?.abort();
  activeProject = pid; currentId = null; els.messages.innerHTML = ''; els.welcome.style.display = '';
  pending = []; renderPreviews(); renderHistory(); els.input.focus(); Perses.fire(Perses.opened);
}
function openChat(id) {
  if (busy) abortCtl?.abort();
  currentId = id; const c = cur(); activeProject = c.project || null;
  if (c.mode) { mode = c.mode; renderModes(); }
  els.messages.innerHTML = ''; els.welcome.style.display = c.messages.length ? 'none' : '';
  c.messages.forEach((m, i) => addMsg(m, i)); renderHistory(); toBottom(); Perses.fire(Perses.opened);
}
$('#newChat').onclick = () => { newChat(); els.app.classList.remove('open'); };

/* ---------------- share by link ---------------- */
async function shareChat(c) {
  if (guest) { showAuth('signup'); toast('Log in to share chats.'); return; }
  const go = await dialog({ title: 'Share this chat?', text: 'Anyone with the link can read this chat (text only, images are not included). You can stop sharing any time.', ok: 'Create link' });
  if (!go) return;
  const data = { messages: c.messages.map(m => ({ role: m.role, content: m.image ? '[image]' : String(m.content || '') })) };
  if (JSON.stringify(data).length > 500000) { toast('This chat is too long to share.'); return; }
  let id = c.shareId, err = null;
  if (id) {
    const r = await sb.from('shared_chats').update({ title: c.title.slice(0, 120), data }).eq('id', id).select('id');
    if (r.error) err = r.error; else if (!r.data?.length) id = null;
  }
  if (!id && !err) {
    const r = await sb.from('shared_chats').insert({ owner: user.id, title: c.title.slice(0, 120), data }).select('id').single();
    err = r.error; id = r.data?.id;
  }
  if (err || !id) { toast('Could not create the link: ' + (err?.message || 'unknown error')); return; }
  c.shareId = id; saveChats();
  const link = location.origin + location.pathname + '?s=' + id;
  try { await navigator.clipboard.writeText(link); } catch {}
  dialog({ title: 'Link ready', text: 'Copied to your clipboard. Anyone with this link can read the chat.', input: true, value: link, ok: 'Done', cancel: '' });
}
async function unshareChat(c) {
  await sb.from('shared_chats').delete().eq('id', c.shareId);
  c.shareId = null; saveChats(); toast('Sharing stopped');
}
async function loadShared(id) {
  screen('shareView');
  const { data, error } = await sb.rpc('get_shared', { p_id: id });
  const row = Array.isArray(data) ? data[0] : data;
  const box = $('#shareBody'); box.innerHTML = '';
  if (error || !row) { $('#shareTitle').textContent = 'Chat not found'; box.innerHTML = '<p class="hint">This link is invalid, or the owner stopped sharing it.</p>'; return; }
  document.title = row.title + ' - Perses'; $('#shareTitle').textContent = row.title;
  (row.data?.messages || []).forEach(m => {
    const w = document.createElement('div'); w.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
    const av = document.createElement('img'); av.className = 'avatar'; av.src = CONFIG.LOGO_NOBG; av.alt = '';
    const b = document.createElement('div'); b.className = 'bubble'; const body = document.createElement('div'); body.className = 'body';
    if (m.role === 'user') body.textContent = m.content; else { body.innerHTML = md(m.content); enhance(body); }
    b.append(body); w.append(av, b); box.append(w);
  });
}
$('#shareOpen').onclick = () => { location.href = location.pathname; };

/* ---------------- branch ---------------- */
function branchFrom(i) {
  const chat = cur(); if (!chat || busy) return;
  const copy = JSON.parse(JSON.stringify(chat.messages.slice(0, i + 1), (k, v) => (k === 'full' ? undefined : v)));
  const b = { id: uid(), title: 'Branch: ' + chat.title.replace(/^Branch:\s*/, '').slice(0, 32), mode: chat.mode, project: chat.project || null, messages: copy, updated: Date.now(), branchOf: chat.id };
  chats.unshift(b); saveChats(); openChat(b.id); toast('Branched. Continue from here.');
}

/* ---------------- messages ---------------- */
function addMsg(m, i) {
  const wrap = document.createElement('div'); wrap.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai'); wrap.dataset.i = i;
  const av = document.createElement('img'); av.className = 'avatar'; av.src = CONFIG.LOGO_NOBG; av.alt = '';
  const bub = document.createElement('div'); bub.className = 'bubble';
  const imgs = document.createElement('div'); imgs.className = 'imgs';
  const body = document.createElement('div'); body.className = 'body';
  bub.append(imgs, body); wrap.append(av, bub);
  (m.images || []).forEach(src => { const im = new Image(); im.src = src; imgs.append(im); });
  if (m.role === 'user') body.textContent = m.content;
  else if (m.image) showGenImage(body, m.image, m.prompt);
  else { body.innerHTML = md(m.content); enhance(body); }
  const act = document.createElement('div'); act.className = 'actions';
  if (m.role === 'assistant') {
    act.innerHTML = `<button data-a="copy">Copy</button><button data-a="regen">Redo</button>${m.image ? '' : '<button data-a="listen">Listen</button>'}<button data-a="up" class="${m.rating === 1 ? 'on' : ''}">Good</button><button data-a="down" class="${m.rating === -1 ? 'on' : ''}">Bad</button><button data-a="branch" title="Start a new chat from here">Branch</button>`;
  } else act.innerHTML = '<button data-a="edit">Edit</button><button data-a="copy">Copy</button>';
  bub.append(act); els.messages.append(wrap);
  return { wrap, body, bub };
}
function showGenImage(body, src, prompt) {
  body.innerHTML = '';
  const img = document.createElement('img'); img.className = 'gen-img'; img.alt = prompt || 'Generated image';
  img.onerror = () => { body.innerHTML = '<span class="err">Image failed to load. Try again.</span>'; };
  img.src = src; body.append(img);
  const dl = document.createElement('a'); dl.href = src; dl.download = 'perses-image.' + (src.startsWith('data:image/png') ? 'png' : 'jpg'); dl.target = '_blank'; dl.rel = 'noopener';
  dl.textContent = 'Download'; dl.style.cssText = 'font-size:13px;color:var(--accent);margin-right:14px'; body.append(dl);
  Perses.fire(Perses.imageTools, body, src);
}
function showErr(body, text, btn) {
  body.innerHTML = ''; const s = document.createElement('span'); s.className = 'err'; s.textContent = 'Error: ' + text; body.append(s);
  if (btn) { const b = document.createElement('button'); b.className = 'mini'; b.textContent = btn[0]; b.onclick = btn[1]; body.append(document.createElement('br'), b); }
}
function startEdit(wrap) {
  if (busy) { toast('Wait for the reply to finish, or press Stop.'); return; }
  const i = +wrap.dataset.i, chat = cur(), m = chat.messages[i], body = wrap.querySelector('.body');
  body.innerHTML = ''; body.style.background = 'none'; body.style.padding = '0';
  const ta = document.createElement('textarea'); ta.className = 'editbox'; ta.value = m.content;
  const row = document.createElement('div'); row.className = 'editrow';
  const c = document.createElement('button'); c.className = 'btn'; c.textContent = 'Cancel'; c.onclick = () => openChat(chat.id);
  const s = document.createElement('button'); s.className = 'btn pri'; s.textContent = 'Save & send';
  s.onclick = async () => {
    const t = ta.value.trim(); if (!t && !m.images?.length) return;
    chat.messages = chat.messages.slice(0, i); saveChats(); openChat(chat.id);
    await submit(t, m.images, m.kind === 'image');
  };
  row.append(c, s); body.append(ta, row); ta.focus();
}
async function rate(i, val) {
  const chat = cur(), m = chat.messages[i]; m.rating = m.rating === val ? 0 : val; saveChats();
  const el = els.messages.querySelector(`.msg[data-i="${i}"]`);
  el.querySelector('[data-a=up]').classList.toggle('on', m.rating === 1); el.querySelector('[data-a=down]').classList.toggle('on', m.rating === -1);
  if (m.rating) { toast('Thanks for the feedback!'); if (user) sb.from('feedback').insert({ user_id: user.id, rating: m.rating, snippet: (m.content || '[image]').slice(0, 300) }).then(() => {}); }
}
function listen(text) {
  if (!('speechSynthesis' in window)) { toast('Read-aloud is not supported on this device.'); return; }
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, ' code block ').replace(/[*#_`>$]/g, ''));
  u.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : (localStorage.getItem('perses_vlang') || 'en-IN'); speechSynthesis.speak(u);
}

/* ---------------- talking to the server ---------------- */
function parseTag(text) {
  const m = /^\/([a-z]+)\b[ \t]*([\s\S]*)$/i.exec(text);
  const k = m && m[1].toLowerCase();
  return k && TAGS[k] ? { k, rest: m[2].trim() } : null;
}
function toApi(chat) {
  const msgs = chat.messages.slice(-20);
  return msgs.map((m, i) => {
    const recent = i >= msgs.length - 6;
    if (m.role === 'assistant') return { role: 'assistant', content: m.image ? `[Generated an image for: ${m.prompt}]` : (m.content || ' ') };
    let text = m.content || '';
    if (m.tag && TAGS[m.tag]) text = TAGS[m.tag].tpl(text.replace(/^\/\w+[ \t]*/, ''));
    if (m.images?.length && recent && m.kind !== 'image')
      return { role: 'user', content: [{ type: 'text', text: text || 'Describe this image.' }, ...m.images.map(u => ({ type: 'image_url', image_url: { url: u } }))] };
    return { role: 'user', content: text || '(image)' };
  });
}
function buildBody(chat, search) {
  const last = chat.messages[chat.messages.length - 1];
  const body = { messages: toApi(chat), mode: (last?.tag && TAGS[last.tag]?.mode) || chat.mode || mode, search: !!search, context: '' };
  const p = projects.find(x => x.id === chat.project);
  if (p && p.instr) body.context += `PROJECT "${p.name}" INSTRUCTIONS (follow them): ${p.instr}`;
  Perses.bodyExtra.forEach(f => {
    try { const x = f(chat) || {}; if (x.context) body.context += (body.context ? '\n\n' : '') + x.context; for (const k in x) if (k !== 'context') body[k] = x[k]; } catch {}
  });
  return body;
}
async function apiError(r) {
  let e = {}; try { e = await r.json(); } catch {}
  const err = new Error(e.error || 'Request failed (' + r.status + ')'); err.code = e.code; return err;
}
async function handleFail(e, body) {
  if (e.code === 'auth') { await sb.auth.signOut(); return; }
  if (e.code === 'guest_limit') {
    showErr(body, e.message, ['Sign up free', () => showAuth('signup')]);
    dialog({ title: 'Free trial finished', text: 'Sign up free to keep chatting. You get 100 messages and 3 images every day.', ok: 'Sign up free', cancel: 'Maybe later' }).then(v => { if (v) showAuth('signup'); });
    return;
  }
  showErr(body, e.message, e.code === 'limit' ? ['See plans', openUpgrade] : null);
}
async function streamReply(chat, search) {
  const msg = { role: 'assistant', content: '' };
  const ui = addMsg(msg, chat.messages.length);
  ui.body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
  abortCtl = new AbortController(); setBusy(true);
  let raf = 0, failed = false;
  const paint = () => { raf = 0; const nb = nearBottom(); ui.body.innerHTML = md(msg.content); enhance(ui.body); if (nb) toBottom(); };
  try {
    const r = await fetch(CONFIG.API_BASE + '/api/chat', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(buildBody(chat, search)), signal: abortCtl.signal });
    if (!r.ok) throw await apiError(r);
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) {
        const s = ln.trim(); if (!s.startsWith('data:')) continue;
        const data = s.slice(5).trim(); if (data === '[DONE]') continue;
        try { const d = JSON.parse(data).choices?.[0]?.delta?.content; if (d) { msg.content += d; if (!raf) raf = requestAnimationFrame(paint); } } catch {}
      }
    }
    if (!msg.content) msg.content = '_No response received. Please try again._';
  } catch (e) {
    if (e.name !== 'AbortError') { await handleFail(e, ui.body); failed = !msg.content; }
  }
  cancelAnimationFrame(raf); setBusy(false);
  if (failed) { ui.bub.querySelector('.actions')?.remove(); return; }
  paint();
  if (msg.content) {
    chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory(); refreshUsage();
    Perses.fire(Perses.afterReply, chat, msg);
  }
}

/* image: watermark (free/guest) + a lighter copy for saving */
function processImage(src, watermark) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      if (watermark) {
        const fs = Math.max(18, Math.round(img.width * 0.035)), pad = fs * 0.7;
        x.font = `600 ${fs}px Inter, Arial, sans-serif`; x.textAlign = 'right'; x.textBaseline = 'bottom';
        x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = fs * 0.25; x.fillStyle = 'rgba(255,255,255,.9)';
        x.fillText('Perses', c.width - pad, c.height - pad);
      }
      const full = watermark ? c.toDataURL('image/jpeg', 0.94) : src;
      const s = Math.min(1, 1280 / Math.max(c.width, c.height));
      const c2 = document.createElement('canvas'); c2.width = Math.round(c.width * s); c2.height = Math.round(c.height * s);
      c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height);
      res({ full, small: c2.toDataURL('image/jpeg', 0.84) });
    };
    img.onerror = () => res({ full: src, small: src });
    img.src = src;
  });
}
async function makeImage(chat, prompt, imgs) {
  const msg = { role: 'assistant', image: '', prompt };
  const ui = addMsg(msg, chat.messages.length);
  ui.body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div> <span style="color:var(--dim)">Creating your image... this can take up to a minute</span>';
  abortCtl = new AbortController(); setBusy(true);
  try {
    const r = await fetch(CONFIG.API_BASE + '/api/image', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ prompt, images: imgs || [] }), signal: abortCtl.signal });
    if (!r.ok) throw await apiError(r);
    let d; try { d = JSON.parse((await r.text()).trim()); } catch { throw new Error('Image service sent an unexpected reply. Please try again.'); }
    if (d.error) throw new Error(d.error);
    const { full, small } = await processImage(d.image, !isPremium());
    msg.image = small; msg.full = full; showGenImage(ui.body, full, prompt);
    chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory(); refreshUsage();
  } catch (e) {
    if (e.name !== 'AbortError') { await handleFail(e, ui.body); ui.bub.querySelector('.actions')?.remove(); }
  }
  setBusy(false); toBottom();
}

/* ---------------- sending ---------------- */
const IMG_INTENT = /\b(generate|create|make|draw|paint|design|render|produce)\b.{0,40}\b(image|picture|photo|illustration|logo|wallpaper|artwork|portrait|poster)\b/i;
async function saveMemory(note) {
  if (!profile) return;
  const m = ((profile.memory || '') + '\n' + note.trim()).trim().slice(-1800);
  profile.memory = m; await sb.from('profiles').update({ memory: m }).eq('id', user.id); toast('Saved to memory');
}
async function submit(text, images, forceImage) {
  images = images || [];
  const tg = parseTag(text);
  let chat = cur();
  if (!chat) {
    chat = { id: uid(), title: (text.replace(/^\/\w+[ \t]*/, '') || 'Image chat').slice(0, 40) || 'New chat', mode, project: activeProject, messages: [], updated: Date.now() };
    chats.unshift(chat); currentId = chat.id;
  }
  const slash = /^\/image\s+/i.test(text);
  const wantImg = forceImage || slash || imgMode || (!images.length && !tg && IMG_INTENT.test(text));
  const u = { role: 'user', content: text, images, kind: wantImg ? 'image' : 'chat' };
  if (tg && !wantImg) u.tag = tg.k;
  chat.messages.push(u); chat.updated = Date.now();
  els.welcome.style.display = 'none'; addMsg(u, chat.messages.length - 1);
  saveChats(); renderHistory(); toBottom();
  const rm = /^\s*(?:please\s+)?remember(?:\s+that)?[:,]?\s+(.{3,300})/i.exec(text); if (rm) saveMemory(rm[1]);
  const useSearch = searchMode;
  if (mode !== 'artist') imgMode = false; searchMode = false; paintChips();
  if (wantImg) await makeImage(chat, text.replace(/^\/image\s+/i, ''), u.images);
  else await streamReply(chat, useSearch);
}
async function send(override) {
  if (busy) { abortCtl?.abort(); return; }
  const text = (typeof override === 'string' ? override : els.input.value).trim();
  if (!text && !pending.length) return;
  const tg = parseTag(text);
  if (tg && !tg.rest && !TAGS[tg.k].optional && !pending.length) { toast(`Add a description after /${tg.k}, e.g. /${tg.k} ...`); return; }
  const imgs = pending.slice();
  els.input.value = ''; autosize(); pending = []; renderPreviews(); $('#rowMenu').hidden = true;
  await submit(text, imgs, false);
}
async function regenerate(i) {
  const chat = cur(); if (!chat || busy) return;
  chat.messages = chat.messages.slice(0, i); saveChats(); openChat(chat.id);
  const lu = chat.messages[chat.messages.length - 1]; if (!lu) return;
  if (lu.kind === 'image') await makeImage(chat, lu.content.replace(/^\/image\s+/i, ''), lu.images); else await streamReply(chat, false);
}

/* ---------------- images, camera, voice ---------------- */
function fileToDataUrl(file, max = 1024, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => rej(new Error('Could not read image')); img.src = url;
  });
}
function squareAvatar(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => rej(new Error('Could not read image')); img.src = url;
  });
}
async function addFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (pending.length >= 4) { toast('Max 4 images per message'); break; }
    try { pending.push(await fileToDataUrl(f)); } catch (e) { toast(e.message); }
  }
  renderPreviews();
}
function renderPreviews() {
  els.previews.innerHTML = '';
  pending.forEach((src, i) => {
    const d = document.createElement('div'); d.className = 'pv'; const im = new Image(); im.src = src;
    const x = document.createElement('button'); x.textContent = '\u2715'; x.onclick = () => { pending.splice(i, 1); renderPreviews(); };
    d.append(im, x); els.previews.append(d);
  });
}
function paintChips() {
  const c = $('#chips'); c.innerHTML = '';
  [[imgMode, 'Create image', () => { imgMode = false; }], [searchMode, 'Web search', () => { searchMode = false; }]].forEach(([on, label, off]) => {
    if (!on) return; const b = document.createElement('button'); b.className = 'chip'; b.textContent = label + ' \u2715'; b.onclick = () => { off(); paintChips(); }; c.append(b);
  });
  els.input.placeholder = imgMode ? 'Describe the image you want...' : 'Message Perses...  (type / for tags)';
}
$('#attachBtn').onclick = e => {
  e.stopPropagation(); const btn = e.currentTarget;
  const extra = Perses.attach.map(x => typeof x === 'function' ? x() : x).filter(Boolean);
  popMenu(btn, [
    ['Take a photo', () => $('#camInput').click()],
    ['Upload image', () => els.file.click()],
    ['Create an image', () => { imgMode = true; paintChips(); els.input.focus(); }],
    ...(guest ? [] : [['Web search', () => { searchMode = true; paintChips(); els.input.focus(); }]]),
    ...extra,
    ['Prompt templates', openTemplates],
    ['Voice language', () => popMenu(btn, CONFIG.VOICE_LANGS.map(([c, n]) => [n, () => { localStorage.setItem('perses_vlang', c); toast('Voice language: ' + n); }]), true)]
  ], true);
};
els.file.onchange = () => { addFiles([...els.file.files]); els.file.value = ''; };
$('#camInput').onchange = () => { addFiles([...$('#camInput').files]); $('#camInput').value = ''; };

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
if (!SR) $('#micBtn').hidden = true;
$('#micBtn').onclick = () => {
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = localStorage.getItem('perses_vlang') || 'en-IN'; rec.interimResults = true; rec.continuous = false;
  const base = els.input.value;
  rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; els.input.value = (base ? base + ' ' : '') + t; autosize(); };
  rec.onend = () => { rec = null; $('#micBtn').classList.remove('on'); };
  rec.onerror = ev => { toast(ev.error === 'not-allowed' ? 'Please allow microphone access.' : 'Voice error: ' + ev.error); };
  try { rec.start(); $('#micBtn').classList.add('on'); } catch { rec = null; }
};

/* slash-tag suggestions: type "/" */
function tagHint() {
  const m = /^\/([a-z]*)$/i.exec(els.input.value);
  const items = m ? TAG_LIST.filter(t => t[0].startsWith(m[1].toLowerCase())).map(([k, d]) => [`/${k} - ${d}`, () => { els.input.value = '/' + k + ' '; autosize(); els.input.focus(); }]) : [];
  if (!items.length) { if (tagOpen) { $('#rowMenu').hidden = true; tagOpen = false; } return; }
  popMenu($('.bar'), items, true); tagOpen = true;
}

/* ---------------- templates + gallery ---------------- */
function openTemplates() {
  const box = $('#tplBox'); box.innerHTML = '';
  CONFIG.TEMPLATES.forEach(t => {
    const b = document.createElement('button'); b.className = 'tpl'; b.innerHTML = `<em class="tg">${esc(t.i)}</em><b>${esc(t.t)}</b><small>${esc(t.d)}</small>`;
    b.onclick = () => { close('templatesModal'); els.input.value = t.p; autosize(); els.input.focus(); els.app.classList.remove('open'); };
    box.append(b);
  });
  open('templatesModal');
}
$('#moreTpl').onclick = openTemplates;
$('#galleryBtn').onclick = () => {
  const box = $('#galleryBox'); box.innerHTML = '';
  const imgs = chats.flatMap(c => c.messages.filter(m => m.image).map(m => m.image)).reverse();
  if (!imgs.length) box.innerHTML = '<p class="hint">No images yet. Use "Create an image" in the + menu.</p>';
  imgs.forEach(src => { const i = new Image(); i.src = src; box.append(i); });
  els.app.classList.remove('open'); open('galleryModal');
};

/* ---------------- upgrade ---------------- */
function renderPlans() {
  const box = $('#plansBox'); box.innerHTML = '';
  CONFIG.PLANS.forEach(p => {
    const d = document.createElement('div'); d.className = 'plan ' + p.id;
    d.innerHTML = `${p.badge ? `<span class="badge">${p.badge}</span>` : ''}<h3>${p.name}</h3><div class="price">${p.price}<small>${p.per}</small></div><p class="tag">${p.tag}</p><ul>${p.pros.map(x => `<li class="y">${x}</li>`).join('')}${p.cons.map(x => `<li class="n">${x}</li>`).join('')}</ul>`;
    const b = document.createElement('button'); b.className = 'primary';
    if (p.id === plan()) { b.textContent = 'Your current plan'; b.disabled = true; }
    else if (RANK[p.id] < RANK[plan()]) { b.textContent = 'Included in your plan'; b.disabled = true; }
    else { b.textContent = 'Get ' + p.name.replace('Perses ', ''); b.onclick = () => choose(p.id); }
    d.append(b); box.append(d);
  });
}
function choose(id) {
  const c = CONFIG.CHECKOUT[id], url = typeof c === 'string' ? c : c && c.month;
  if (url) window.open(url, '_blank', 'noopener'); else toast('Payments are not switched on yet. Coming very soon!');
}
function openUpgrade() { if (guest) { showAuth('signup'); return; } renderPlans(); open('upgradeModal'); }
$('#upgradeSide').onclick = $('#upgradeTop').onclick = () => openUpgrade();

/* ---------------- settings, user menu, background ---------------- */
const BGK = () => 'perses_bg_' + user.id;
function applyBg() {
  const d = user && localStorage.getItem(BGK()), m = $('#main');
  if (d && isPremium()) { m.style.setProperty('--bg-img', `url("${d}")`); document.body.classList.add('has-bg'); }
  else { m.style.removeProperty('--bg-img'); document.body.classList.remove('has-bg'); }
}
let tmpAvatar = null;
function paintSettingsAvatar() {
  const a = $('#sAvatar');
  if (tmpAvatar) { a.style.backgroundImage = `url("${tmpAvatar}")`; a.textContent = ''; } else { a.style.backgroundImage = ''; a.textContent = (($('#sName').value || dispName())[0] || 'P').toUpperCase(); }
}
function openSettings() {
  tmpAvatar = profile.avatar || null;
  $('#sName').value = profile.display_name || ''; $('#sUser').value = profile.username || ''; $('#sBday').value = profile.birthday || '';
  $('#sMem').value = profile.memory || ''; $('#sPass').value = $('#sPass2').value = ''; $('#sMsg').textContent = '';
  $('#sAge').textContent = profile.birthday ? `(you are ${ageOf(profile.birthday)})` : '';
  paintSettingsAvatar(); open('settingsModal');
}
$('#sAvBtn').onclick = () => $('#avFile').click();
$('#sAvRm').onclick = () => { tmpAvatar = null; paintSettingsAvatar(); };
$('#avFile').onchange = async () => {
  const f = $('#avFile').files[0]; $('#avFile').value = ''; if (!f) return;
  try { tmpAvatar = await squareAvatar(f); paintSettingsAvatar(); } catch (e) { toast(e.message); }
};
$('#sBday').onchange = () => { $('#sAge').textContent = $('#sBday').value ? `(you are ${ageOf($('#sBday').value)})` : ''; };
function sMsg(t, type) { const m = $('#sMsg'); m.textContent = t; m.className = 'amsg ' + type; }
$('#sSave').onclick = async () => {
  const username = $('#sUser').value.trim(), display_name = $('#sName').value.trim(), birthday = $('#sBday').value, memory = $('#sMem').value.trim().slice(0, 1800);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return sMsg('Username: 3-20 letters, numbers or _ only.', 'err');
  if (!display_name) return sMsg('Please enter your name.', 'err');
  const bErr = checkBirthday(birthday); if (bErr) return sMsg(bErr, 'err');
  const upd = { username, display_name, birthday, avatar: tmpAvatar, memory };
  const { error } = await sb.from('profiles').update(upd).eq('id', user.id);
  if (error) return sMsg(error.code === '23505' ? 'That username is already taken.' : error.message, 'err');
  Object.assign(profile, upd); paintUser(); toast('Saved'); close('settingsModal');
};
$('#sPassBtn').onclick = async () => {
  const a = $('#sPass').value, b = $('#sPass2').value;
  if (a.length < 8) return sMsg('Password must be at least 8 characters.', 'err');
  if (a !== b) return sMsg('The two passwords do not match.', 'err');
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) return sMsg(error.message, 'err');
  $('#sPass').value = $('#sPass2').value = ''; sMsg('Password updated', 'ok');
};
$('#userBtn').onclick = e => {
  e.stopPropagation();
  const extra = Perses.menu.map(x => typeof x === 'function' ? x() : x).filter(Boolean);
  popMenu(e.currentTarget, [
    ['Settings', openSettings],
    ['Custom background', () => { if (!isPremium()) { toast('Custom backgrounds are a Pro & Elite feature.'); openUpgrade(); return; } $('#bgFile').click(); }],
    ['Remove background', () => { localStorage.removeItem(BGK()); applyBg(); toast('Background removed'); }],
    ['Switch theme', toggleTheme],
    ['Guide', () => openInfo('guide')],
    ['About', () => openInfo('about')], ['Privacy', () => openInfo('privacy')], ['Terms', () => openInfo('terms')],
    ...extra,
    ['Log out', () => sb.auth.signOut()]
  ], true);
};
$('#bgFile').onchange = async () => {
  const f = $('#bgFile').files[0]; $('#bgFile').value = ''; if (!f) return;
  try { const d = await fileToDataUrl(f, 1600, 0.72); localStorage.setItem(BGK(), d); applyBg(); toast('Background set'); }
  catch { toast('That image is too big for this device. Try a smaller one.'); }
};

/* ---------------- floating embers ---------------- */
const fx = (() => {
  const c = $('#fx'), x = c.getContext('2d'); let w = 0, h = 0, P = [], on = false;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() {
    w = c.width = c.offsetWidth; h = c.height = c.offsetHeight;
    P = Array.from({ length: Math.min(55, Math.max(15, Math.floor(w / 22))) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + .4, v: Math.random() * .4 + .12, a: Math.random() * .5 + .15, p: Math.random() * 6 }));
  }
  function tick() {
    if (!on) return; x.clearRect(0, 0, w, h);
    for (const q of P) {
      q.y -= q.v; q.p += .01; q.x += Math.sin(q.p) * .3; if (q.y < -6) { q.y = h + 6; q.x = Math.random() * w; }
      x.beginPath(); x.arc(q.x, q.y, q.r, 0, 6.283); x.fillStyle = `rgba(255,${100 + Math.floor(q.a * 100)},30,${q.a})`; x.fill();
    }
    requestAnimationFrame(tick);
  }
  return { start() { if (calm) return; size(); if (!on) { on = true; tick(); } }, stop() { on = false; }, resize() { if (on) size(); } };
})();
window.addEventListener('resize', () => fx.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) fx.stop(); else if (!$('#app').hidden) fx.start(); });

/* ---------------- events ---------------- */
els.send.onclick = () => send();
els.input.addEventListener('input', () => { autosize(); tagHint(); });
els.input.addEventListener('keydown', e => {
  const touch = matchMedia('(pointer:coarse)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !touch) { e.preventDefault(); send(); }
});
els.input.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith('image/'));
  if (f.length) { e.preventDefault(); addFiles(f); }
});
['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' && !$('#app').hidden) addFiles([...e.dataTransfer.files]); }));
document.querySelectorAll('.card').forEach(c => c.onclick = () => send(c.dataset.p));
$('#menuBtn').onclick = () => els.app.classList.add('open');
$('#closeSide').onclick = $('#overlay').onclick = () => els.app.classList.remove('open');

els.messages.addEventListener('click', e => {
  const cb = e.target.closest('.copy');
  if (cb) {
    navigator.clipboard.writeText(cb.closest('.codebox').querySelector('code').innerText).then(() => { cb.textContent = 'Copied'; setTimeout(() => cb.textContent = 'Copy', 1600); });
    return;
  }
  const a = e.target.closest('[data-a]');
  if (a) {
    const wrap = a.closest('.msg'), i = +wrap.dataset.i, act = a.dataset.a;
    if (act === 'copy') navigator.clipboard.writeText(wrap.querySelector('.body').innerText).then(() => toast('Copied'));
    else if (act === 'regen') regenerate(i);
    else if (act === 'edit') startEdit(wrap);
    else if (act === 'up') rate(i, 1);
    else if (act === 'down') rate(i, -1);
    else if (act === 'branch') branchFrom(i);
    else if (act === 'listen') listen(wrap.querySelector('.body').innerText);
    return;
  }
  const img = e.target.closest('.imgs img, .gen-img');
  if (img) { const lb = document.createElement('div'); lb.className = 'lightbox'; const big = new Image(); big.src = img.src; lb.append(big); lb.onclick = () => lb.remove(); document.body.append(lb); }
});
$('#galleryBox').addEventListener('click', e => {
  if (e.target.tagName === 'IMG') { const lb = document.createElement('div'); lb.className = 'lightbox'; const big = new Image(); big.src = e.target.src; lb.append(big); lb.onclick = () => lb.remove(); document.body.append(lb); }
});

/* ---------------- start ---------------- */
startGuest();   /* show the chat right away; the login check below may switch to your account */
const AUTHQ = new URLSearchParams(location.search).get('auth');
if (AUTHQ === 'login' || AUTHQ === 'signup') showAuth(AUTHQ);
if (['#privacy', '#terms', '#about', '#guide'].includes(location.hash)) openInfo(location.hash.slice(1));
if (SHARE_ID) loadShared(SHARE_ID);

/* extra feature files. Missing files are simply skipped. */
['tools', 'docs', 'voice', 'memory', 'billing', 'account', 'tour'].forEach(n => {
  const s = document.createElement('script'); s.src = n + '.js'; s.async = false; s.onerror = () => s.remove(); document.body.append(s);
});
