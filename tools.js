/* Perses tools: run code, live HTML preview, image tools */
(() => {
  const ENABLE_BG_REMOVE = true;   // set to false before selling if you do not have the background remover's commercial license
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };

  /* ---- JavaScript runner (sandboxed iframe, cannot touch your account) ---- */
  function runJs(code, out) {
    out.hidden = false; out.textContent = 'Running...';
    const f = mk('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.style.display = 'none';
    const id = Math.random().toString(36).slice(2), lines = [];
    let tm;
    const finish = err => { clearTimeout(tm); removeEventListener('message', on); f.remove(); out.textContent = (lines.join('\n') + (err ? '\nError: ' + err : '')).trim() || '(no output)'; };
    const on = e => {
      if (e.source !== f.contentWindow || !e.data || e.data.id !== id) return;
      if (e.data.t === 'log') lines.push(e.data.m);
      if (e.data.t === 'done') finish(e.data.err);
    };
    addEventListener('message', on);
    tm = setTimeout(() => { lines.push('Stopped: it ran longer than 10 seconds.'); finish(); }, 10000);
    const safe = JSON.stringify(code).replace(/</g, '\\u003c');
    f.srcdoc = '<script>' +
      'const id=' + JSON.stringify(id) + ',send=(t,m,err)=>parent.postMessage({id,t,m,err},"*");' +
      'const fmt=a=>a.map(x=>{try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(" ");' +
      'console.log=console.info=(...a)=>send("log",fmt(a));console.error=console.warn=(...a)=>send("log","! "+fmt(a));' +
      'window.onerror=m=>send("done","",String(m));' +
      '(async()=>{try{await (0,eval)(' + safe + ');send("done")}catch(e){send("done","",String(e))}})();' +
      '<\/script>';
    document.body.append(f);
  }

  /* ---- Python (Pyodide inside a sandboxed iframe) ---- */
  let pyFrame = null, pyReady = null;
  function pyEnsure() {
    if (pyFrame && pyReady) return pyReady;
    pyFrame = mk('iframe'); pyFrame.setAttribute('sandbox', 'allow-scripts'); pyFrame.style.display = 'none';
    const fr = pyFrame;
    pyReady = new Promise((res, rej) => {
      const on = e => { if (e.source === fr.contentWindow && e.data && e.data.t === 'ready') { removeEventListener('message', on); clearTimeout(t); res(); } };
      const t = setTimeout(() => { removeEventListener('message', on); rej(new Error('Could not load Python. Check your internet and try again.')); }, 45000);
      addEventListener('message', on);
    });
    fr.srcdoc = '<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"><\/script><script>' +
      'let py=null,buf=[];' +
      'const ready=loadPyodide().then(p=>{py=p;py.setStdout({batched:s=>buf.push(s)});py.setStderr({batched:s=>buf.push(s)});parent.postMessage({t:"ready"},"*")});' +
      'addEventListener("message",async e=>{const d=e.data||{};if(!d.id)return;await ready;buf=[];let err="";' +
      'try{await py.loadPackagesFromImports(d.code);const r=await py.runPythonAsync(d.code);if(r!==undefined&&r!==null)buf.push(String(r))}catch(x){err=String(x.message||x)}' +
      'parent.postMessage({id:d.id,out:buf.join("\\n"),err},"*")});' +
      '<\/script>';
    document.body.append(fr);
    return pyReady;
  }
  async function runPy(code, out) {
    out.hidden = false; out.textContent = 'Starting Python (the first time takes a few seconds)...';
    try { await pyEnsure(); } catch (e) { pyFrame && pyFrame.remove(); pyFrame = pyReady = null; out.textContent = e.message; return; }
    out.textContent = 'Running...';
    const id = Math.random().toString(36).slice(2), fr = pyFrame;
    const res = await new Promise(r => {
      let tm;
      const on = e => { if (e.source === fr.contentWindow && e.data && e.data.id === id) { clearTimeout(tm); removeEventListener('message', on); r(e.data); } };
      addEventListener('message', on);
      tm = setTimeout(() => { removeEventListener('message', on); fr.remove(); pyFrame = pyReady = null; r({ out: '', err: 'Stopped: it ran longer than 25 seconds.' }); }, 25000);
      fr.contentWindow.postMessage({ id, code }, '*');
    });
    out.textContent = ((res.out || '') + (res.err ? '\n' + res.err : '')).trim() || '(no output)';
  }

  /* ---- HTML live preview ---- */
  let pm = null;
  function preview(box) {
    const msg = box.closest('.body') || document;
    const blocks = [...msg.querySelectorAll('.codebox')].map(b => ({ l: (b.dataset.lang || '').toLowerCase(), c: b.querySelector('code').textContent }));
    let html = (blocks.find(b => b.l === 'html') || {}).c || '';
    const css = blocks.filter(b => b.l === 'css').map(b => b.c).join('\n');
    const js = blocks.filter(b => ['js', 'javascript'].includes(b.l)).map(b => b.c).join('\n');
    let add = '';
    if (css && !/<style/i.test(html)) add += '<style>' + css + '</style>';
    if (js && !/<script/i.test(html)) add += '<script>' + js.replace(/<\/script/gi, '<\\/script') + '<\/script>';
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, add + '</body>') : html + add;
    if (!pm) {
      pm = mk('div', 'modal'); pm.hidden = true;
      pm.innerHTML = '<div class="sheet wide"><button class="x" aria-label="Close">\u2715</button><h2>Live preview</h2><iframe class="prevframe" sandbox="allow-scripts allow-forms allow-modals"></iframe></div>';
      pm.querySelector('.x').onclick = () => { pm.hidden = true; pm.querySelector('iframe').srcdoc = ''; };
      pm.addEventListener('click', e => { if (e.target === pm) pm.querySelector('.x').click(); });
      document.body.append(pm);
    }
    pm.querySelector('iframe').srcdoc = html; pm.hidden = false;
  }

  Perses.enhancers.push(root => {
    root.querySelectorAll('.codebox').forEach(box => {
      if (box.dataset.tools) return; box.dataset.tools = 1;
      const lang = (box.dataset.lang || '').toLowerCase(), copy = box.querySelector('.copy'); if (!copy) return;
      const code = () => box.querySelector('code').textContent;
      let label = null, fn = null;
      if (['js', 'javascript'].includes(lang)) { label = 'Run'; fn = out => runJs(code(), out); }
      else if (['python', 'py'].includes(lang)) { label = 'Run'; fn = out => runPy(code(), out); }
      else if (lang === 'html') { label = 'Preview'; fn = () => preview(box); }
      if (!label) return;
      const g = mk('div', 'grp'); copy.replaceWith(g);
      const b = mk('button', 'runbtn', label); g.append(b, copy);
      const out = mk('div', 'runout'); out.hidden = true; box.append(out);
      b.onclick = () => fn(out);
    });
  });

  /* ---- Image tools: remove background + restyle ---- */
  const blobToUrl = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  const resizeTo = (src, max) => new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height));
      const w = Math.max(64, Math.round(im.width * s / 8) * 8), h = Math.max(64, Math.round(im.height * s / 8) * 8);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.92));
    };
    im.src = src;
  });
  let tm = null, original = null, current = null;
  function toolsModal() {
    if (tm) return tm;
    tm = mk('div', 'modal'); tm.hidden = true;
    tm.innerHTML = '<div class="sheet"><button class="x" aria-label="Close">\u2715</button><h2>Image tools</h2>' +
      '<div class="it-stage"><img class="it-img" alt=""><div class="it-empty">Choose an image to start</div></div>' +
      '<div class="it-row"><button class="btn it-pick">Choose image</button><button class="btn it-bg">Remove background</button></div>' +
      '<label class="lbl">Restyle: turn it into another art style</label>' +
      '<select class="field it-style"><option>anime illustration</option><option>oil painting</option><option>watercolor painting</option><option>pixel art</option><option>cartoon</option><option>pencil sketch</option><option>3D render</option><option>neon cyberpunk</option><option value="">Custom style...</option></select>' +
      '<input class="field it-custom" placeholder="Describe the style, e.g. vintage comic book" hidden>' +
      '<button class="btn pri wide-btn it-restyle">Restyle image</button><p class="amsg it-msg"></p>' +
      '<div class="it-row"><button class="btn it-dl" hidden>Download</button><button class="btn it-use" hidden>Use in chat</button><button class="btn it-undo" hidden>Back to original</button></div>' +
      '<input type="file" accept="image/*" hidden class="it-file"></div>';
    document.body.append(tm);
    const q = s => tm.querySelector(s);
    const msg = (t, c) => { const m = q('.it-msg'); m.textContent = t; m.className = 'amsg it-msg ' + (c || ''); };
    const show = src => {
      current = src; const im = q('.it-img'); im.src = src; im.style.display = 'block'; q('.it-empty').style.display = 'none';
      ['.it-dl', '.it-use'].forEach(s => { q(s).hidden = false; }); q('.it-undo').hidden = src === original;
    };
    tm.show = show;
    const close = () => { tm.hidden = true; };
    q('.x').onclick = close; tm.addEventListener('click', e => { if (e.target === tm) close(); });
    q('.it-pick').onclick = () => q('.it-file').click();
    q('.it-file').onchange = async () => { const f = q('.it-file').files[0]; q('.it-file').value = ''; if (!f) return; original = await fileToDataUrl(f, 1600, 0.92); msg(''); show(original); };
    q('.it-style').onchange = () => { q('.it-custom').hidden = q('.it-style').value !== ''; };
    q('.it-undo').onclick = () => { if (original) show(original); };
    q('.it-dl').onclick = () => { const a = mk('a'); a.href = current; a.download = 'perses-edit.' + (current.startsWith('data:image/png') ? 'png' : 'jpg'); a.click(); };
    q('.it-use').onclick = () => { if (pending.length >= 4) { toast('Max 4 images per message'); return; } pending.push(current); renderPreviews(); close(); toast('Added to your message'); };
    q('.it-bg').onclick = async () => {
      if (!current) { msg('Choose an image first.', 'err'); return; }
      if (!ENABLE_BG_REMOVE) { msg('Background removal is switched off.', 'err'); return; }
      try {
        msg('Loading the background remover. The first time downloads about 40 MB...');
        const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
        const fn = mod.removeBackground || mod.default;
        const blob = await fn(current, { progress: (k, c, t) => { if (t) msg('Working... ' + Math.round(c / t * 100) + '%'); } });
        show(await blobToUrl(blob)); msg('Done. Background removed.', 'ok');
      } catch (e) { msg('Background removal failed: ' + (e.message || e), 'err'); }
    };
    q('.it-restyle').onclick = async () => {
      if (!current) { msg('Choose an image first.', 'err'); return; }
      if (guest) { msg('Please log in to use Restyle.', 'err'); return; }
      const style = (q('.it-style').value || q('.it-custom').value).trim();
      if (!style) { msg('Describe the style you want.', 'err'); return; }
      try {
        msg('Restyling... this can take up to a minute.');
        const small = await resizeTo(current, 512);
        const r = await fetch(CONFIG.API_BASE + '/api/imgtool', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ image: small, prompt: style }) });
        if (!r.ok) throw await apiError(r);
        const d = JSON.parse((await r.text()).trim());
        if (d.error) throw new Error(d.error);
        const { full } = await processImage(d.image, !isPremium());
        show(full); msg('Done. Restyled.', 'ok'); refreshUsage();
      } catch (e) { msg(e.message || 'Restyle failed.', 'err'); }
    };
    return tm;
  }
  function openImageTools(src) {
    const m = toolsModal(); m.hidden = false;
    if (src) { original = src; m.show(src); }
  }
  Perses.attach.push(() => ['Image tools (remove background, restyle)', () => openImageTools()]);
  Perses.imageTools.push((body, src) => {
    const b = mk('button', 'link', 'Edit image'); b.style.fontSize = '13px';
    b.onclick = () => openImageTools(src); body.append(b);
  });
})();
