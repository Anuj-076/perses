/* Perses security: devices and login history, cookie preferences, browser extension */
(() => {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sheet = (title, html) => { const m = el('div', 'modal', `<div class="sheet"><button class="x" aria-label="Close">\u2715</button><h2>${x(title)}</h2><div class="sb">${html}</div></div>`); m.querySelector('.x').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; document.body.append(m); return m; };
  const ago = d => { const s = Math.max(0, (Date.now() - new Date(d)) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };

  /* ================= cookie and storage preferences ================= */
  const CK = 'perses_consent', PREF_KEYS = ['perses_theme', 'perses_mode', 'perses_vlang', 'perses_voice', 'perses_rate'];
  const consent = () => { try { return Object.assign({ stats: true, prefs: true }, JSON.parse(localStorage.getItem(CK) || '{}')); } catch { return { stats: true, prefs: true }; } };
  const _set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (this === localStorage && PREF_KEYS.includes(k) && consent().prefs === false) return; return _set.call(this, k, v); };
  const _fetch = window.fetch;
  window.fetch = function (u) { try { if (String(u).includes('/api/track') && consent().stats === false) return Promise.resolve(new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } })); } catch {} return _fetch.apply(this, arguments); };

  function openCookies() {
    const c = consent(), m = sheet('Cookie & storage preferences', `<p class="hint">Perses has no ads and no tracking cookies. Choose what else it may remember on this device.</p>
      <label class="chk"><input type="checkbox" checked disabled><span><b>Essential</b> (always on): keeps you signed in, saves your chats and settings you ask for, and applies daily limits.</span></label>
      <label class="chk"><input type="checkbox" id="ckP" ${c.prefs ? 'checked' : ''}><span><b>Preferences</b>: remember your theme, mode and voice choices.</span></label>
      <label class="chk"><input type="checkbox" id="ckS" ${c.stats ? 'checked' : ''}><span><b>Anonymous statistics</b>: counts visits and which features are used (country and device type only) to improve Perses.</span></label>
      <div class="dlrow"><button class="btn pri" id="ckSave">Save choices</button><button class="btn" id="ckAll">Accept all</button><button class="btn" id="ckMin">Essential only</button></div>`);
    const save = (p, s) => { _set.call(localStorage, CK, JSON.stringify({ prefs: p, stats: s })); if (!p) PREF_KEYS.forEach(k => localStorage.removeItem(k)); _set.call(localStorage, 'perses_cookie', '1'); const b = $('#cookie'); if (b) b.hidden = true; m.remove(); toast('Preferences saved'); };
    m.querySelector('#ckSave').onclick = () => save(m.querySelector('#ckP').checked, m.querySelector('#ckS').checked);
    m.querySelector('#ckAll').onclick = () => save(true, true); m.querySelector('#ckMin').onclick = () => save(false, false);
  }
  window.openCookies = openCookies;
  if ($('#cookieOk') && !$('#cookiePref')) { const b = el('button', 'btn', 'Preferences'); b.id = 'cookiePref'; $('#cookieOk').before(b); b.onclick = openCookies; }
  const disc = $('.disc'); if (disc && !$('#ckLink')) { const b = el('button', 'link', 'Cookie settings'); b.id = 'ckLink'; b.onclick = openCookies; disc.append(document.createTextNode(' \u00B7 '), b); }

  /* ================= devices and login history ================= */
  const DID = () => { let d = localStorage.getItem('perses_did'); if (!d) { d = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12); _set.call(localStorage, 'perses_did', d); } return d; };
  async function sess(body) { const r = await fetch(CONFIG.API_BASE + '/api/session', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ did: DID(), ...body }) }); if (!r.ok) throw await apiError(r); return r.json(); }

  Perses.onStart(async () => {
    if (guest || !user) return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const ls = (session && session.user && session.user.last_sign_in_at) || user.last_sign_in_at, key = 'perses_lastlogin_' + user.id;
      const fresh = !!ls && Date.now() - new Date(ls) < 180000 && localStorage.getItem(key) !== ls;   // a real sign-in just happened on this device
      if (fresh) _set.call(localStorage, key, ls);
      if (fresh || !sessionStorage.getItem('perses_dev_seen')) { sessionStorage.setItem('perses_dev_seen', '1'); await sess({ action: 'ping', login: fresh }); }
    } catch {}
  });
  Perses.onStart(() => {
    if (guest) return; const s = $('#settingsModal .sheet'); if (!s || s.querySelector('#sSec')) return;
    const row = el('div', 'dlrow', '<button class="btn" id="sSec">Security &amp; devices</button><button class="btn" id="sCk">Cookie preferences</button>');
    $('#sSave').before(row);
    $('#sSec').onclick = () => { close('settingsModal'); openSecurity(); }; $('#sCk').onclick = () => { close('settingsModal'); openCookies(); };
  });

  async function openSecurity() {
    if (!user) { toast('Log in first.'); return; }
    const m = sheet('Security & devices', '<p class="hint">Loading...</p>'), box = m.querySelector('.sb');
    const draw = async () => {
      const d = await sess({ action: 'list' }), me = DID();
      box.innerHTML = `<h3>Your devices</h3>${d.devices.map(v => `<div class="rm" style="align-items:center"><div style="flex:1"><b>${x(v.label || 'Device')}</b>${v.did === me ? ' <em class="tg">This device</em>' : ''}<br><small class="hint">${x(v.country || '?')} - last used ${ago(v.last_seen)}</small></div>${v.did === me ? '' : `<button class="btn" data-rm="${x(v.did)}">Remove</button>`}</div>`).join('') || '<p class="hint">No devices yet.</p>'}
        <h3 style="margin-top:14px">Recent sign-ins</h3>${d.history.map(v => `<div class="rm" style="align-items:center"><div style="flex:1">${x(v.device || 'Device')} ${v.new_device ? '<em class="tg">New device</em>' : ''}<br><small class="hint">${x(v.country || '?')} - ${new Date(v.ts).toLocaleString()}</small></div></div>`).join('') || '<p class="hint">No sign-ins recorded yet.</p>'}
        <p class="hint">Removing a device only removes it from this list. To end its session, use the buttons below.</p>
        <div class="dlrow"><button class="btn" id="seO">Log out other devices</button><button class="btn danger" id="seA">Log out everywhere</button><button class="btn" id="seP">Change password</button></div>`;
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { await sess({ action: 'remove', target: b.dataset.rm }); draw(); });
      box.querySelector('#seO').onclick = async () => { if (await uiConfirm('Log out other devices?', 'Every other device will need to sign in again.', 'Log them out')) { const { error } = await sb.auth.signOut({ scope: 'others' }); toast(error ? error.message : 'Other devices were logged out.'); } };
      box.querySelector('#seA').onclick = async () => { if (await uiConfirm('Log out everywhere?', 'This signs you out on every device, including this one. Devices that were already open can keep working for up to an hour.', 'Log out everywhere')) { await sb.auth.signOut({ scope: 'global' }); m.remove(); } };
      box.querySelector('#seP').onclick = () => { m.remove(); openSettings(); };
    };
    try { await draw(); } catch (e) { box.innerHTML = `<p class="amsg err">${x(e.message || 'Could not load.')}</p>`; }
  }
  window.openSecurity = openSecurity;

  /* ================= browser extension (Chrome, Edge, Brave) ================= */
  const SITE = location.origin;
  const BG = `const SITE = "${SITE}";
function pack(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, ""); }
function openPerses(o) { chrome.tabs.create({ url: SITE + "/#ask=" + pack(o) }); }
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "ask", title: "Ask Perses about \\"%s\\"", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "sum", title: "Summarize this page with Perses", contexts: ["page"] });
  });
});
async function pageText(tabId) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => ({ t: document.title, u: location.href, x: (document.body ? document.body.innerText : "").slice(0, 12000) }) });
  return r.result;
}
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ask" && info.selectionText) openPerses({ q: "Explain this text and answer anything it asks:\\n\\n" + info.selectionText.slice(0, 6000) });
  if (info.menuItemId === "sum" && tab && tab.id) {
    try { const p = await pageText(tab.id); openPerses({ q: "Summarize this web page in clear bullet points, then give a one-line takeaway.\\nTitle: " + p.t + "\\nURL: " + p.u + "\\n\\n" + p.x }); } catch (e) {}
  }
});
`;
  const POPUP_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{width:300px;margin:0;padding:14px;font:14px Arial,sans-serif;background:#141414;color:#eee}h3{margin:0 0 10px;font-size:16px}textarea{width:100%;box-sizing:border-box;height:80px;border-radius:8px;border:1px solid #333;background:#1f1f1f;color:#eee;padding:8px;font:inherit}button{width:100%;margin-top:8px;padding:9px;border:0;border-radius:8px;background:#ff5a00;color:#fff;font-weight:600;cursor:pointer}button.s{background:#2a2a2a}</style></head><body><h3>Ask Perses</h3><textarea id="q" placeholder="Ask anything..."></textarea><button id="go">Ask</button><button class="s" id="sum">Summarize this page</button><script src="popup.js"></script></body></html>`;
  const POPUP_JS = `const SITE = "${SITE}";
function pack(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, ""); }
function go(o) { chrome.tabs.create({ url: SITE + "/#ask=" + pack(o) }); window.close(); }
document.getElementById("go").onclick = () => { const q = document.getElementById("q").value.trim(); if (q) go({ q }); };
document.getElementById("sum").onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ t: document.title, u: location.href, x: (document.body ? document.body.innerText : "").slice(0, 12000) }) });
    go({ q: "Summarize this web page in clear bullet points, then give a one-line takeaway.\\nTitle: " + r.result.t + "\\nURL: " + r.result.u + "\\n\\n" + r.result.x });
  } catch (e) { alert("This page cannot be read (browser pages are protected)."); }
};
`;
  const MANIFEST = { manifest_version: 3, name: 'Ask Perses', version: '1.0', description: 'Ask Perses about selected text, or summarize any page.', permissions: ['contextMenus', 'activeTab', 'scripting'], background: { service_worker: 'background.js' }, action: { default_title: 'Perses', default_popup: 'popup.html' } };
  const README = 'Ask Perses browser extension\r\n\r\n1. Unzip this folder.\r\n2. Open chrome://extensions (or edge://extensions).\r\n3. Turn on Developer mode.\r\n4. Click "Load unpacked" and choose the unzipped folder.\r\n\r\nUse: select text, right-click, "Ask Perses". Right-click a page, "Summarize this page with Perses". Or click the toolbar button.\r\n';

  async function downloadExt() {
    try {
      await new Promise((res, rej) => { if (window.JSZip) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the zip tool.')); document.head.append(s); });
      const z = new JSZip(); z.file('manifest.json', JSON.stringify(MANIFEST, null, 2)); z.file('background.js', BG); z.file('popup.html', POPUP_HTML); z.file('popup.js', POPUP_JS); z.file('README.txt', README);
      const blob = await z.generateAsync({ type: 'blob' }), a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'ask-perses-extension.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    } catch (e) { toast(e.message || 'Could not build the extension.'); }
  }
  function openExtension() {
    const m = sheet('Browser extension', `<p class="hint">Ask Perses about any selected text, or summarize the page you are reading. Works in Chrome, Edge and Brave.</p>
      <button class="primary" id="exD">Download extension (.zip)</button>
      <h3 style="margin-top:16px">Install in 4 steps</h3><ol style="margin-left:20px;line-height:1.8"><li>Unzip the downloaded file.</li><li>Open <b>chrome://extensions</b> (Edge: <b>edge://extensions</b>).</li><li>Turn on <b>Developer mode</b>.</li><li>Click <b>Load unpacked</b> and choose the unzipped folder.</li></ol>
      <p class="hint">Then select text on any page, right-click and choose "Ask Perses", or click the toolbar button.</p>`);
    m.querySelector('#exD').onclick = downloadExt;
  }
  Perses.attach.push(() => ['Get the browser extension', openExtension]);

  /* the extension opens Perses with the text in the link; you confirm before anything is sent */
  const readAsk = () => { const m = /^#ask=([\w-]+)$/.exec(location.hash); if (!m) return null; try { let b = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch { return null; } };
  Perses.onStart(() => {
    const o = readAsk(); if (!o || !o.q) return;
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => {
      els.input.value = String(o.q).slice(0, 16000); autosize();
      dialog({ title: 'Send to Perses?', text: 'The browser extension sent this text. Press Send to ask Perses, or Edit first.', ok: 'Send', cancel: 'Edit first' }).then(v => { if (v) send(); else els.input.focus(); });
    }, 700);
  });
})();
