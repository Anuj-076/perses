/* ====== SETTINGS: edit here ====== */
const CONFIG = {
  // "" = same site (Vercel). If the page is on GitHub Pages or another site,
  // put your Vercel URL here, e.g. "https://perses-xyz.vercel.app"
  API_BASE: "",
    MODELS: [
    { id: "gemini-3.8-flash", label: "Perses Fast", vision: true },
    { id: "gemini-3.1-pro-preview", label: "Perses Pro", vision: true },
    { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Perses Open (free)", vision: false }
  ]
};
/* ================================= */

const $ = s => document.querySelector(s);
const els = {
  app: $('#app'), history: $('#history'), messages: $('#messages'), welcome: $('#welcome'),
  scroll: $('#scroll'), input: $('#input'), send: $('#sendBtn'), previews: $('#previews'),
  file: $('#fileInput'), model: $('#modelSelect')
};

let chats = loadChats();
let currentId = null;
let pending = [];
let busy = false;
let abortCtl = null;

/* ---------- storage ---------- */
function loadChats() { try { return JSON.parse(localStorage.getItem('perses_chats') || '[]'); } catch { return []; } }
function saveChats() {
  const arr = [...chats];
  for (;;) {
    try { localStorage.setItem('perses_chats', JSON.stringify(arr)); return; }
    catch { if (arr.length <= 1) return; arr.pop(); }
  }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cur = () => chats.find(c => c.id === currentId);

/* ---------- ui helpers ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
function md(text) {
  const html = DOMPurify.sanitize(marked.parse(text || '', { gfm: true, breaks: true }));
  return html;
}
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
    bar.append(l, b);
    pre.replaceWith(box); box.append(bar, pre);
  });
}
const nearBottom = () => els.scroll.scrollHeight - els.scroll.scrollTop - els.scroll.clientHeight < 140;
const toBottom = () => { els.scroll.style.scrollBehavior = 'auto'; els.scroll.scrollTop = els.scroll.scrollHeight; };

function autosize() { els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px'; }
function setBusy(b) {
  busy = b;
  $('#sendIcon').style.display = b ? 'none' : ''; $('#stopIcon').style.display = b ? '' : 'none';
  els.send.classList.toggle('stop', b);
}

/* ---------- sidebar ---------- */
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
function deleteChat(id) {
  chats = chats.filter(c => c.id !== id); saveChats();
  if (id === currentId) newChat(); else renderHistory();
}
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

/* ---------- messages ---------- */
function addMsg(m) {
  const wrap = document.createElement('div'); wrap.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
  const av = document.createElement('div'); av.className = 'avatar';
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
  const dl = document.createElement('a'); dl.href = src; dl.download = 'perses-image.png'; dl.target = '_blank';
  dl.textContent = '⬇ Download'; dl.style.cssText = 'font-size:13px;color:var(--accent2)';
  body.append(dl);
}

/* ---------- API ---------- */
function modelFor(hasImages) {
  const sel = CONFIG.MODELS.find(m => m.id === els.model.value) || CONFIG.MODELS[0];
  if (hasImages && !sel.vision) {
    const v = CONFIG.MODELS.find(m => m.vision);
    toast('Switched to ' + v.label + ' to read your image'); return v.id;
  }
  return sel.id;
}
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
async function streamReply(chat) {
  const last = chat.messages[chat.messages.length - 1];
  const model = modelFor(!!last.images?.length);
  const msg = { role: 'assistant', content: '' };
  const ui = addMsg(msg);
  ui.body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
  abortCtl = new AbortController(); setBusy(true);
  let raf = 0;
  const paint = () => { raf = 0; const nb = nearBottom(); ui.body.innerHTML = md(msg.content); enhance(ui.body); if (nb) toBottom(); };
  try {
    const r = await fetch(CONFIG.API_BASE + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: toApi(chat) }), signal: abortCtl.signal
    });
    if (!r.ok) { let e = {}; try { e = await r.json(); } catch {} throw new Error(e.error || 'Request failed (' + r.status + ')'); }
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
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
    if (!msg.content) msg.content = '_No response received. Try again or switch model._';
  } catch (e) {
    if (e.name !== 'AbortError') { ui.body.innerHTML = ''; const s = document.createElement('span'); s.className = 'err'; s.textContent = '⚠ ' + e.message; ui.body.append(s); if (!msg.content) { setBusy(false); ui.wrap.dataset.failed = 1; return; } }
  }
  cancelAnimationFrame(raf); paint(); setBusy(false);
  if (msg.content) { chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory(); }
}
async function makeImage(chat, prompt) {
  const msg = { role: 'assistant', image: '', prompt };
  const ui = addMsg(msg);
  ui.body.innerHTML = '<div class="typing"><i></i><i></i><i></i></div> <span style="color:var(--dim)">Creating image…</span>';
  abortCtl = new AbortController(); setBusy(true);
  try {
    const r = await fetch(CONFIG.API_BASE + '/api/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }), signal: abortCtl.signal
    });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Image request failed');
    msg.image = d.image; showGenImage(ui.body, d.image, prompt);
    chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory();
  } catch (e) {
    if (e.name !== 'AbortError') ui.body.innerHTML = '<span class="err">⚠ ' + e.message.replace(/</g, '&lt;') + '</span>';
  }
  setBusy(false); toBottom();
}

/* ---------- sending ---------- */
const IMG_INTENT = /\b(generate|create|make|draw|paint|design|render|produce)\b.{0,40}\b(image|picture|photo|illustration|logo|wallpaper|artwork|portrait|poster)\b/i;
async function send(textOverride) {
  if (busy) { abortCtl?.abort(); return; }
  const text = (textOverride ?? els.input.value).trim();
  if (!text && !pending.length) return;
  let chat = cur();
  if (!chat) {
    chat = { id: uid(), title: (text || 'Image chat').slice(0, 40), messages: [], updated: Date.now() };
    chats.unshift(chat); currentId = chat.id;
  }
  const user = { role: 'user', content: text, images: pending.slice() };
  chat.messages.push(user); chat.updated = Date.now();
  els.welcome.style.display = 'none'; addMsg(user);
  els.input.value = ''; autosize(); pending = []; renderPreviews(); saveChats(); renderHistory(); toBottom();

  const wantsImg = !user.images.length && (/^\/image\s+/i.test(text) || IMG_INTENT.test(text));
  if (wantsImg) await makeImage(chat, text.replace(/^\/image\s+/i, ''));
  else await streamReply(chat);
}
async function regenerate() {
  const chat = cur(); if (!chat || busy) return;
  const last = chat.messages[chat.messages.length - 1];
  if (last?.role === 'assistant') chat.messages.pop();
  openChat(chat.id);
  const lu = chat.messages[chat.messages.length - 1]; if (!lu) return;
  const wantsImg = !lu.images?.length && (/^\/image\s+/i.test(lu.content) || IMG_INTENT.test(lu.content));
  if (wantsImg) await makeImage(chat, lu.content.replace(/^\/image\s+/i, '')); else await streamReply(chat);
}

/* ---------- images in bar ---------- */
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
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

/* ---------- events ---------- */
CONFIG.MODELS.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.label; els.model.append(o); });
els.model.value = localStorage.getItem('perses_model') || CONFIG.MODELS[0].id;
if (!els.model.value) els.model.value = CONFIG.MODELS[0].id;
els.model.onchange = () => localStorage.setItem('perses_model', els.model.value);

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
  e.preventDefault(); if (ev === 'drop') addFiles([...e.dataTransfer.files]);
}));
document.querySelectorAll('.card').forEach(c => c.onclick = () => send(c.dataset.p));
$('#newChat').onclick = () => { newChat(); els.app.classList.remove('open'); };
$('#menuBtn').onclick = () => els.app.classList.add('open');
$('#closeSide').onclick = $('#overlay').onclick = () => els.app.classList.remove('open');
$('#clearAll').onclick = () => { if (confirm('Delete ALL chats?')) { chats = []; saveChats(); newChat(); } };

els.messages.addEventListener('click', e => {
  const copyBtn = e.target.closest('.copy');
  if (copyBtn) {
    navigator.clipboard.writeText(copyBtn.closest('.codebox').querySelector('code').innerText)
      .then(() => { copyBtn.textContent = 'Copied ✓'; setTimeout(() => copyBtn.textContent = 'Copy', 1600); });
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

renderHistory();
if (chats.length === 0) els.welcome.style.display = '';
