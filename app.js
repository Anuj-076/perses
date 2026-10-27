/* ============================ SETTINGS ============================ */
const CONFIG = {
  API_BASE: "",                                   // keep "" when the site is on Vercel
  SUPABASE_URL: "https://cmtougdkugmkgwifzqut.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_EAjcrfX1Rq-UVED3SEA_BQ_qohQR-SM",   // the PUBLISHABLE / anon key only!
  LOGO_URL: "https://i.ibb.co/BVj29ptv/AI-logo.png",
  CHECKOUT: { pro: "", elite: "" },               // payment links go here later
  LIMITS: { free: { msgs: 20, imgs: 3 }, pro: { msgs: 200, imgs: 30 }, elite: { msgs: 1000, imgs: 100 } }, // keep same as api/_lib.js
  PLANS: [
    { id: 'free', name: 'Perses (Free)', price: '$0', per: '', tag: 'Great for trying Perses out.',
      pros: ['20 messages per day', '3 AI images per day', 'Reads and explains your images', 'Code boxes with copy button', 'Chat history and dark / light mode'],
      cons: ['Lower daily limits', 'Standard speed, can be slower when busy', 'No custom background'] },
    { id: 'pro', name: 'Perses Pro', price: '$5.99', per: ' / month', tag: 'For everyday power users.', badge: 'Most popular',
      pros: ['200 messages per day', '30 AI images per day', 'Faster, smarter replies', 'Priority over free users', 'Custom background from your gallery', 'Everything in Free'],
      cons: ['Daily fair-use limits still apply'] },
    { id: 'elite', name: 'Perses Elite', price: '$10.99', per: ' / month', tag: 'The complete Perses experience.', badge: 'Best value',
      pros: ['1000 messages per day', '100 AI images per day', 'Deep-thinking mode for hard questions', 'Top priority, least waiting', 'Custom background from your gallery', 'Early access to new features', 'Everything in Pro'],
      cons: ['Fair-use limits apply to prevent abuse'] }
  ]
};
/* ================================================================== */

const $ = s => document.querySelector(s);
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const RANK = { free: 0, pro: 1, elite: 2 };
const PLAN_NAME = { free: 'Perses Free', pro: 'Perses Pro', elite: 'Perses Elite' };

let user = null, profile = null, booted = null;
let chats = [], currentId = null, pending = [], busy = false, abortCtl = null, authMode = 'login';

const els = { app: $('#app'), history: $('#history'), messages: $('#messages'), welcome: $('#welcome'), scroll: $('#scroll'), input: $('#input'), send: $('#sendBtn'), previews: $('#previews'), file: $('#fileInput') };
const plan = () => profile?.plan || 'free';
const isPremium = () => plan() !== 'free';

/* ---------------- logo everywhere ---------------- */
document.querySelectorAll('[data-logo]').forEach(i => { i.src = CONFIG.LOGO_URL; i.onerror = () => { i.style.visibility = 'hidden'; }; });

/* ---------------- helpers ---------------- */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
const md = text => DOMPurify.sanitize(marked.parse(text || '', { gfm: true, breaks: true }));
function enhance(root) {
  root.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  root.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('codebox')) return;
    const code = pre.querySelector('code'); if (!code) return;
    const lang = (code.className.match(/language-(\S+)/) || [])[1] || 'code';
    try { hljs.highlightElement(code); } catch {}
    const box = document.createElement('div'); box.className = 'codebox';
    const bar = document.createElement('div'); bar.className = 'codebar';
    const l = document.createElement('span'); l.textContent = lang;
    const b = document.createElement('button'); b.className = 'copy'; b.textContent = 'Copy';
    bar.append(l, b); pre.replaceWith(box); box.append(bar, pre);
  });
}
const nearBottom = () => els.scroll.scrollHeight - els.scroll.scrollTop - els.scroll.clientHeight < 140;
const toBottom = () => { els.scroll.style.scrollBehavior = 'auto'; els.scroll.scrollTop = els.scroll.scrollHeight; };
function autosize() { els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px'; }
function setBusy(b) { busy = b; $('#sendIcon').style.display = b ? 'none' : ''; $('#stopIcon').style.display = b ? '' : 'none'; els.send.classList.toggle('stop', b); }
function screen(name) {
  ['auth', 'nameScreen', 'resetScreen'].forEach(id => { $('#' + id).hidden = id !== name; });
  $('#app').hidden = name !== 'app';
}

/* ---------------- theme ---------------- */
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('perses_theme', t); $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙'; }
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
function setMode(m) {
  authMode = m;
  document.querySelectorAll('#authTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('#authBtn').textContent = m === 'login' ? 'Log in' : 'Create account';
  $('#authTitle').textContent = m === 'login' ? 'Welcome back' : 'Create your account';
  $('#pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('#authForm').hidden = false; $('#forgot').hidden = m !== 'login'; authMsg('');
}
document.querySelectorAll('#authTabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));

$('#authForm').onsubmit = async e => {
  e.preventDefault(); authMsg(''); $('#authBtn').disabled = true;
  const email = $('#email').value.trim(), password = $('#pass').value;
  try {
    if (authMode === 'signup') {
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      $('#authForm').hidden = true; $('#forgot').hidden = true;
      authMsg(`We sent a verification email to ${email}. Click the Verify button inside it. Then you'll choose your username. (Check spam if you don't see it.)`, 'ok');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) { authMsg(friendly(err.message), 'err'); }
  $('#authBtn').disabled = false;
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

/* ---------------- username ---------------- */
$('#nameForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#uname').value.trim(), m = $('#nameMsg');
  m.className = 'amsg err';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { m.textContent = 'Use 3–20 letters, numbers or _ only.'; return; }
  const { error } = await sb.from('profiles').update({ username: name }).eq('id', user.id);
  if (error) { m.textContent = error.code === '23505' ? 'That username is taken. Try another.' : error.message; return; }
  profile.username = name; startApp();
};
$('#logoutName').onclick = () => sb.auth.signOut();

/* ---------------- session handling ---------------- */
async function loadProfile() {
  for (let i = 0; i < 4; i++) {
    const { data } = await sb.from('profiles').select('username,plan').eq('id', user.id).maybeSingle();
    if (data) { profile = data; return data; }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}
async function boot(session) {
  if (booted === session.user.id) return;
  booted = session.user.id; user = session.user;
  const p = await loadProfile();
  if (!p) { booted = null; screen('auth'); setMode('login'); authMsg('Could not load your profile. Did you run the SQL setup in Supabase?', 'err'); return; }
  if (!p.username) { screen('nameScreen'); return; }
  startApp();
}
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') { screen('resetScreen'); return; }
  if (ev === 'SIGNED_OUT') { booted = null; user = null; profile = null; chats = []; currentId = null; els.messages.innerHTML = ''; screen('auth'); setMode('login'); return; }
  if (ev === 'INITIAL_SESSION' && !session) { screen('auth'); setMode('login'); return; }
  if (session && ['SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED'].includes(ev)) setTimeout(() => boot(session), 0);
});

function startApp() {
  screen('app');
  chats = loadChats(); currentId = null;
  $('#uName').textContent = profile.username; $('#uAva').textContent = profile.username[0].toUpperCase();
  $('#wHello').textContent = `Hello, ${profile.username} // Quantum AI Cognitive Node`;
  paintPlan(); applyBg(); refreshUsage(); newChat(); fx.start();
}
function paintPlan() { $('#uPlan').textContent = PLAN_NAME[plan()]; $('#upgradeSide').hidden = plan() === 'elite'; $('#upgradeTop').hidden = plan() === 'elite'; }
window.addEventListener('focus', async () => {
  if (!user || !profile) return;
  const { data } = await sb.from('profiles').select('username,plan').eq('id', user.id).maybeSingle();
  if (data && data.plan !== profile.plan) { profile = data; paintPlan(); applyBg(); refreshUsage(); }
});
async function authHeaders() {
  const { data: { session } } = await sb.auth.getSession();
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') };
}
async function refreshUsage() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('usage').select('kind,n').eq('day', day);
    const u = { msgs: 0, imgs: 0 }; (data || []).forEach(r => { u[r.kind] = r.n; });
    const L = CONFIG.LIMITS[plan()];
    $('#usage').textContent = `${u.msgs}/${L.msgs} messages · ${u.imgs}/${L.imgs} images today`;
  } catch {}
}

/* ---------------- chat storage (per account, on this device) ---------------- */
const CK = () => 'perses_chats_' + user.id;
function loadChats() { try { return JSON.parse(localStorage.getItem(CK()) || '[]'); } catch { return []; } }
function saveChats() {
  const arr = [...chats];
  for (;;) { try { localStorage.setItem(CK(), JSON.stringify(arr)); return; } catch { if (arr.length <= 1) return; arr.pop(); } }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cur = () => chats.find(c => c.id === currentId);

/* ---------------- sidebar ---------------- */
function renderHistory() {
  els.history.innerHTML = '';
  [...chats].sort((a, b) => b.updated - a.updated).forEach(c => {
    const row = document.createElement('div'); row.className = 'h-item' + (c.id === currentId ? ' active' : '');
    const t = document.createElement('button'); t.className = 'h-title'; t.textContent = c.title;
    t.onclick = () => { openChat(c.id); els.app.classList.remove('open'); };
    const d = document.createElement('button'); d.className = 'h-del'; d.textContent = '🗑'; d.title = 'Delete';
    d.onclick = e => { e.stopPropagation(); if (confirm('Delete this chat?')) deleteChat(c.id); };
    row.append(t, d); els.history.append(row);
  });
}
function deleteChat(id) { chats = chats.filter(c => c.id !== id); saveChats(); if (id === currentId) newChat(); else renderHistory(); }
function newChat() {
  if (busy) abortCtl?.abort();
  currentId = null; els.messages.innerHTML = ''; els.welcome.style.display = '';
  pending = []; renderPreviews(); renderHistory(); els.input.focus();
}
function openChat(id) {
  if (busy) abortCtl?.abort();
  currentId = id; const c = cur();
  els.messages.innerHTML = ''; els.welcome.style.display = c.messages.length ? 'none' : '';
  c.messages.forEach(m => addMsg(m)); renderHistory(); toBottom();
}

/* ---------------- messages ---------------- */
function addMsg(m) {
  const wrap = document.createElement('div'); wrap.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
  const av = document.createElement('img'); av.className = 'avatar'; av.src = CONFIG.LOGO_URL; av.alt = '';
  const bub = document.createElement('div'); bub.className = 'bubble';
  const imgs = document.createElement('div'); imgs.className = 'imgs';
  const body = document.createElement('div'); body.className = 'body';
  bub.append(imgs, body); wrap.append(av, bub);
  (m.images || []).forEach(src => { const i = new Image(); i.src = src; imgs.append(i); });
  if (m.role === 'user') body.textContent = m.content;
  else if (m.image) showGenImage(body, m.image, m.prompt);
  else { body.innerHTML = md(m.content); enhance(body); }
  if (m.role === 'assistant') {
    const act = document.createElement('div'); act.className = 'actions';
    act.innerHTML = '<button data-a="copy">Copy</button><button data-a="regen">Regenerate</button>';
    bub.append(act);
  }
  els.messages.append(wrap);
  return { wrap, body, bub };
}
function showGenImage(body, src, prompt) {
  body.innerHTML = '';
  const img = document.createElement('img'); img.className = 'gen-img'; img.alt = prompt || 'Generated image';
  img.onerror = () => { body.innerHTML = '<span class="err">Image failed to load. Try again.</span>'; };
  img.src = src; body.append(img);
  const dl = document.createElement('a'); dl.href = src; dl.download = 'perses-image.png'; dl.target = '_blank'; dl.rel = 'noopener';
  dl.textContent = '⬇ Download'; dl.style.cssText = 'font-size:13px;color:var(--accent)'; body.append(dl);
}
function showErr(body, text, upgrade) {
  body.innerHTML = '';
  const s = document.createElement('span'); s.className = 'err'; s.textContent = '⚠ ' + text; body.append(s);
  if (upgrade) { const b = document.createElement('button'); b.className = 'mini'; b.textContent = '⚡ See plans'; b.onclick = openUpgrade; body.append(document.createElement('br'), b); }
}

/* ---------------- talking to the server ---------------- */
function toApi(chat) {
  const msgs = chat.messages.slice(-20);
  return msgs.map((m, i) => {
    const recent = i >= msgs.length - 6;
    if (m.role === 'assistant') return { role: 'assistant', content: m.image ? `[Generated an image for: ${m.prompt}]` : (m.content || ' ') };
    if (m.images?.length && recent)
      return { role: 'user', content: [{ type: 'text', text: m.content || 'Describe this image.' }, ...m.images.map(u => ({ type: 'image_url', image_url: { url: u } }))] };
    return { role: 'user', content: m.content || '(image)' };
  });
}
async function apiError(r) {
  let e = {}; try { e = await r.json(); } catch {}
  const err = new Error(e.error || 'Request failed (' + r.status + ')'); err.code = e.code; return err;
}
async function handleFail(e, body) {
  if (e.code === 'auth') { await sb.auth.signOut(); return; }
  showErr(body, e.message, e.code === 'limit');
}
async function streamReply(chat) {
  const msg = { role: 'assistant', content: '' };
  const ui = addMsg(msg);
  ui.body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
  abortCtl = new AbortController(); setBusy(true);
  let raf = 0, failed = false;
  const paint = () => { raf = 0; const nb = nearBottom(); ui.body.innerHTML = md(msg.content); enhance(ui.body); if (nb) toBottom(); };
  try {
    const r = await fetch(CONFIG.API_BASE + '/api/chat', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ messages: toApi(chat) }), signal: abortCtl.signal });
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
  if (msg.content) { chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory(); refreshUsage(); }
}
async function makeImage(chat, prompt) {
  const msg = { role: 'assistant', image: '', prompt };
  const ui = addMsg(msg);
  ui.body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div> <span style="color:var(--dim)">Creating image…</span>';
  abortCtl = new AbortController(); setBusy(true);
  try {
    const r = await fetch(CONFIG.API_BASE + '/api/image', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ prompt }), signal: abortCtl.signal });
    if (!r.ok) throw await apiError(r);
    const d = await r.json();
    msg.image = d.image; showGenImage(ui.body, d.image, prompt);
    chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory(); refreshUsage();
  } catch (e) {
    if (e.name !== 'AbortError') { await handleFail(e, ui.body); ui.bub.querySelector('.actions')?.remove(); }
  }
  setBusy(false); toBottom();
}

/* ---------------- sending ---------------- */
const IMG_INTENT = /\b(generate|create|make|draw|paint|design|render|produce)\b.{0,40}\b(image|picture|photo|illustration|logo|wallpaper|artwork|portrait|poster)\b/i;
const wantsImage = m => !m.images?.length && (/^\/image\s+/i.test(m.content) || IMG_INTENT.test(m.content));
async function send(textOverride) {
  if (busy) { abortCtl?.abort(); return; }
  const text = (typeof textOverride === 'string' ? textOverride : els.input.value).trim();
  if (!text && !pending.length) return;
  let chat = cur();
  if (!chat) { chat = { id: uid(), title: (text || 'Image chat').slice(0, 40), messages: [], updated: Date.now() }; chats.unshift(chat); currentId = chat.id; }
  const u = { role: 'user', content: text, images: pending.slice() };
  chat.messages.push(u); chat.updated = Date.now();
  els.welcome.style.display = 'none'; addMsg(u);
  els.input.value = ''; autosize(); pending = []; renderPreviews(); saveChats(); renderHistory(); toBottom();
  if (wantsImage(u)) await makeImage(chat, text.replace(/^\/image\s+/i, '')); else await streamReply(chat);
}
async function regenerate() {
  const chat = cur(); if (!chat || busy) return;
  if (chat.messages[chat.messages.length - 1]?.role === 'assistant') chat.messages.pop();
  openChat(chat.id);
  const lu = chat.messages[chat.messages.length - 1]; if (!lu) return;
  if (wantsImage(lu)) await makeImage(chat, lu.content.replace(/^\/image\s+/i, '')); else await streamReply(chat);
}

/* ---------------- images in the message bar ---------------- */
function fileToDataUrl(file, max = 1024, q = .82) {
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
    const d = document.createElement('div'); d.className = 'pv';
    const im = new Image(); im.src = src;
    const x = document.createElement('button'); x.textContent = '✕'; x.onclick = () => { pending.splice(i, 1); renderPreviews(); };
    d.append(im, x); els.previews.append(d);
  });
}

/* ---------------- upgrade popup ---------------- */
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
  const url = CONFIG.CHECKOUT[id];
  if (url) window.open(url, '_blank', 'noopener'); else toast('Payments are not switched on yet. Coming very soon!');
}
function openUpgrade() { renderPlans(); $('#upgradeModal').hidden = false; }
const closeUpgrade = () => { $('#upgradeModal').hidden = true; };
$('#upgradeSide').onclick = $('#upgradeTop').onclick = openUpgrade;
$('#closeUpgrade').onclick = closeUpgrade;
$('#upgradeModal').addEventListener('click', e => { if (e.target.id === 'upgradeModal') closeUpgrade(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeUpgrade(); });

/* ---------------- user menu + custom background ---------------- */
const BGK = () => 'perses_bg_' + user.id;
function applyBg() {
  const d = localStorage.getItem(BGK()), m = $('#main');
  if (d && isPremium()) { m.style.setProperty('--bg-img', `url("${d}")`); document.body.classList.add('has-bg'); }
  else { m.style.removeProperty('--bg-img'); document.body.classList.remove('has-bg'); }
}
$('#userBtn').onclick = e => { e.stopPropagation(); $('#userMenu').hidden = !$('#userMenu').hidden; };
document.addEventListener('click', () => { $('#userMenu').hidden = true; });
$('#mTheme').onclick = toggleTheme;
$('#mLogout').onclick = () => sb.auth.signOut();
$('#mBg').onclick = () => {
  if (!isPremium()) { toast('Custom backgrounds are a Pro & Elite feature.'); openUpgrade(); return; }
  $('#bgFile').click();
};
$('#mBgRemove').onclick = () => { localStorage.removeItem(BGK()); applyBg(); toast('Background removed'); };
$('#bgFile').onchange = async () => {
  const f = $('#bgFile').files[0]; $('#bgFile').value = ''; if (!f) return;
  try { const d = await fileToDataUrl(f, 1600, .72); localStorage.setItem(BGK(), d); applyBg(); toast('Background set ✨'); }
  catch { toast('That image is too big for this device. Try a smaller one.'); }
};

/* ---------------- floating embers (background graphics) ---------------- */
const fx = (() => {
  const c = $('#fx'), x = c.getContext('2d'); let w = 0, h = 0, P = [], on = false;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() {
    w = c.width = c.offsetWidth; h = c.height = c.offsetHeight;
    P = Array.from({ length: Math.min(55, Math.max(15, Math.floor(w / 22))) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + .4, v: Math.random() * .4 + .12, a: Math.random() * .5 + .15, p: Math.random() * 6 }));
  }
  function tick() {
    if (!on) return;
    x.clearRect(0, 0, w, h);
    for (const q of P) {
      q.y -= q.v; q.p += .01; q.x += Math.sin(q.p) * .3;
      if (q.y < -6) { q.y = h + 6; q.x = Math.random() * w; }
      x.beginPath(); x.arc(q.x, q.y, q.r, 0, 6.283); x.fillStyle = `rgba(255,${100 + Math.floor(q.a * 100)},30,${q.a})`; x.fill();
    }
    requestAnimationFrame(tick);
  }
  return { start() { if (calm) return; size(); if (!on) { on = true; tick(); } }, stop() { on = false; }, resize() { if (on) size(); } };
})();
window.addEventListener('resize', () => fx.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) fx.stop(); else if (user && !$('#app').hidden) fx.start(); });

/* ---------------- events ---------------- */
els.send.onclick = () => send();
els.input.addEventListener('input', autosize);
els.input.addEventListener('keydown', e => {
  const touch = matchMedia('(pointer:coarse)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !touch) { e.preventDefault(); send(); }
});
$('#attachBtn').onclick = () => els.file.click();
els.file.onchange = () => { addFiles([...els.file.files]); els.file.value = ''; };
els.input.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith('image/'));
  if (f.length) { e.preventDefault(); addFiles(f); }
});
['dragover', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  e.preventDefault(); if (ev === 'drop' && user && !$('#app').hidden) addFiles([...e.dataTransfer.files]);
}));
document.querySelectorAll('.card').forEach(c => c.onclick = () => send(c.dataset.p));
$('#newChat').onclick = () => { newChat(); els.app.classList.remove('open'); };
$('#menuBtn').onclick = () => els.app.classList.add('open');
$('#closeSide').onclick = $('#overlay').onclick = () => els.app.classList.remove('open');

els.messages.addEventListener('click', e => {
  const cb = e.target.closest('.copy');
  if (cb) {
    navigator.clipboard.writeText(cb.closest('.codebox').querySelector('code').innerText)
      .then(() => { cb.textContent = 'Copied ✓'; setTimeout(() => cb.textContent = 'Copy', 1600); });
    return;
  }
  const a = e.target.closest('[data-a]');
  if (a) {
    if (a.dataset.a === 'copy') navigator.clipboard.writeText(a.closest('.bubble').querySelector('.body').innerText).then(() => toast('Copied'));
    if (a.dataset.a === 'regen') regenerate();
    return;
  }
  const img = e.target.closest('.imgs img, .gen-img');
  if (img) {
    const lb = document.createElement('div'); lb.className = 'lightbox';
    const big = new Image(); big.src = img.src; lb.append(big); lb.onclick = () => lb.remove(); document.body.append(lb);
  }
});
