/* Perses sources: attached sources, OCR, GitHub explainer, Data Lab (CSV/Excel), audio transcription, deep research */
(() => {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sheet = (title, html, wide) => { const m = el('div', 'modal', `<div class="sheet ${wide ? 'wide' : ''}"><button class="x" aria-label="Close">\u2715</button><h2>${x(title)}</h2><div class="sb">${html}</div></div>`); m.querySelector('.x').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; document.body.append(m); return m; };
  document.head.append(el('style', '', `
    .tw{overflow:auto;max-height:230px;border:1px solid var(--line);border-radius:10px}
    .tw table{border-collapse:collapse;width:100%;font-size:12.5px}.tw th,.tw td{padding:5px 9px;border-bottom:1px solid var(--line);white-space:nowrap;text-align:left}
    .tw th{position:sticky;top:0;background:var(--panel2);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)}
    .dlrow{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:10px 0}.dlrow>div{display:flex;flex-direction:column;gap:3px}.dlrow label{margin:0;font-size:12px;color:var(--dim)}
    .dlrow .field{margin:0;width:auto}.dlcv{position:relative;height:320px;margin:8px 0}.sugg{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
    .tbox{width:100%;min-height:220px}.prog{height:8px;border-radius:5px;background:var(--panel2);overflow:hidden;margin:8px 0}
    .prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .3s}.rec{color:#fff!important;background:#e5484d!important;border-color:#e5484d!important}`));
  const libs = {};
  const lib = (u, test) => libs[u] || (libs[u] = new Promise((res, rej) => { if (test()) return res(); const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = () => { delete libs[u]; rej(new Error('Could not load a helper library. Check your internet connection.')); }; document.head.append(s); }));
  const XL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', CJ = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = accept => new Promise(res => { const i = el('input'); i.type = 'file'; i.accept = accept; i.hidden = true; document.body.append(i); i.onchange = () => { const f = i.files[0]; i.remove(); res(f || null); }; i.click(); });

  /* ---------- ask the AI and get the full text back ---------- */
  window.PersesAsk = async (prompt, context) => {
    const r = await fetch(CONFIG.API_BASE + '/api/chat', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], mode: 'default', search: false, context: context || '' }) });
    if (!r.ok) throw await apiError(r);
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', out = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
      const ls = buf.split('\n'); buf = ls.pop();
      for (const l of ls) { const s = l.trim(); if (!s.startsWith('data:')) continue; const d = s.slice(5).trim(); if (d === '[DONE]') continue; try { out += JSON.parse(d).choices?.[0]?.delta?.content || ''; } catch {} }
    }
    return out.trim();
  };

  /* ---------- attached sources (repos, spreadsheets, transcripts) ---------- */
  const CX = new Map(); let pendingCx = [];
  const KEY = id => 'perses_ctx_' + (user ? user.id : 'guest') + '_' + id;
  const cxList = id => { if (!CX.has(id)) { let a = []; try { a = JSON.parse(localStorage.getItem(KEY(id)) || '[]'); } catch {} CX.set(id, a); } return CX.get(id); };
  const cxSave = id => { try { localStorage.setItem(KEY(id), JSON.stringify(CX.get(id) || [])); } catch { toast('Storage is full. This source will not be remembered after you reload.'); } };
  window.addContext = (name, text) => { pendingCx.push({ name, text: String(text).slice(0, 120000) }); paintCx(); };
  Perses.bodyExtra.push(chat => {
    if (pendingCx.length) { cxList(chat.id).push(...pendingCx); pendingCx = []; cxSave(chat.id); paintCx(); }
    const l = cxList(chat.id); if (!l.length) return {};
    let ctx = 'DOCUMENTS ATTACHED BY THE USER (use them to answer, and mention the source name when you quote):', left = 250000;
    for (const d of l) { const t = d.text.slice(0, left); left -= t.length; ctx += `\n\n=== ${d.name} ===\n${t}`; if (left <= 0) break; }
    return { context: ctx };
  });
  let cxBox = null;
  function paintCx() {
    if (!cxBox) { cxBox = el('div'); cxBox.id = 'ctxChips'; cxBox.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding:0 6px'; $('#previews').before(cxBox); }
    cxBox.innerHTML = ''; const chat = cur();
    [...(chat ? cxList(chat.id).map((d, i) => ({ d, i, p: false })) : []), ...pendingCx.map((d, i) => ({ d, i, p: true }))].forEach(({ d, i, p }) => {
      const c = el('div', 'dchip', '<b></b><small></small><button title="Remove" aria-label="Remove">\u2715</button>');
      c.querySelector('b').textContent = d.name; c.querySelector('small').textContent = Math.round(d.text.length / 1000) + 'k chars';
      c.querySelector('button').onclick = () => { if (p) pendingCx.splice(i, 1); else { cxList(chat.id).splice(i, 1); cxSave(chat.id); } paintCx(); };
      cxBox.append(c);
    });
  }
  Perses.opened.push(paintCx); Perses.onStart(paintCx);

  /* ---------- OCR ---------- */
  Perses.attach.push(() => ['Extract text from a photo (OCR)', async () => {
    const f = await pick('image/*'); if (!f) return;
    try { const d = await fileToDataUrl(f, 1800, 0.9); await submit('Extract ALL the text from the attached image exactly as written. Keep the original layout and line breaks. Output only the text in one code block. If there is no text, say so.', [d], false); } catch (e) { toast(e.message || 'Could not read that image.'); }
  }]);

  /* ---------- GitHub repo explainer ---------- */
  const parseRepo = s => { s = String(s).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, ''); const m = /^github\.com\/([\w.-]+)\/([\w.-]+)/i.exec(s) || /^([\w.-]+)\/([\w.-]+)$/.exec(s); return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null; };
  async function gh(url) {
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 403 || r.status === 429) throw new Error('GitHub rate limit reached. Try again in a few minutes.');
    if (r.status === 404) throw new Error('Repository not found. It must be public.');
    if (!r.ok) throw new Error('GitHub error ' + r.status); return r.json();
  }
  async function loadRepo(spec) {
    const p = parseRepo(spec); if (!p) throw new Error('Paste a GitHub link like github.com/owner/repo');
    const { owner, repo } = p, info = await gh(`https://api.github.com/repos/${owner}/${repo}`), br = info.default_branch;
    const tree = await gh(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(br)}?recursive=1`);
    const skip = /(^|\/)(node_modules|dist|build|vendor|\.git|__pycache__|\.next|coverage)\/|\.(png|jpe?g|gif|svg|ico|webp|pdf|zip|gz|woff2?|ttf|mp[34]|lock|map)$|\.min\.js$|package-lock\.json$/i;
    const files = (tree.tree || []).filter(t => t.type === 'blob' && !skip.test(t.path));
    const listing = files.slice(0, 500).map(f => f.path).join('\n') + (files.length > 500 ? `\n... and ${files.length - 500} more files` : '');
    const score = pth => { const l = pth.toLowerCase(); let s = 0; if (/^readme/.test(l)) s += 100; if (/(^|\/)(package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|composer\.json|gemfile|dockerfile|docker-compose\.ya?ml|vercel\.json|tsconfig\.json)$/.test(l)) s += 60; if (/(^|\/)(main|index|app|server|cli|manage)\.\w+$/.test(l)) s += 40; if (/(^|\/)(src|app|lib|api|routes|pages)\//.test(l)) s += 10; return s - l.split('/').length * 3; };
    const picks = files.filter(f => (f.size || 0) < 60000).sort((a, b) => score(b.path) - score(a.path)).slice(0, 14);
    let text = `Repository: ${owner}/${repo}\nDescription: ${info.description || '-'}\nMain language: ${info.language || '-'}\nStars: ${info.stargazers_count}\nBranch: ${br}\n\nFILE TREE:\n${listing}\n`;
    const out = await Promise.all(picks.map(async f => { try { const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/${f.path.split('/').map(encodeURIComponent).join('/')}`); return r.ok ? { p: f.path, t: (await r.text()).slice(0, 9000) } : null; } catch { return null; } }));
    out.filter(Boolean).forEach(o => { text += `\n=== FILE: ${o.p} ===\n${o.t}\n`; });
    return { name: `${owner}/${repo}`, text };
  }
  async function repoFlow(spec) {
    try {
      toast('Reading the repository...'); const r = await loadRepo(spec); addContext('GitHub: ' + r.name, r.text);
      await submit(`Explain this GitHub repository (${r.name}): what it does, the tech stack, how the code is organized, how the main parts work together, how to run it, and what to read first. Use headings and short bullet points.`, [], false);
    } catch (e) { toast(e.message || 'Could not read that repository.'); }
  }
  Perses.attach.push(() => ['Explain a GitHub repo', async () => { const v = await dialog({ title: 'Explain a GitHub repo', text: 'Paste a public repository link.', input: true, value: 'github.com/', ok: 'Explain' }); if (v && v.trim()) repoFlow(v.trim()); }]);

  /* ---------- Data Lab ---------- */
  const toNum = v => typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%\s]/g, ''));
  const fm = n => (n == null || !isFinite(n)) ? '-' : (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : (+n.toFixed(2)).toString());
  const PAL = ['#ff5a00', '#ff9a3c', '#d4a73a', '#30a46c', '#0091ff', '#8e4ec6', '#e5484d', '#888888'];
  function profileCols(rows) {
    const keys = [...new Set(rows.slice(0, 500).flatMap(r => Object.keys(r)))];
    return keys.map(k => {
      const vals = rows.map(r => r[k]).filter(v => v !== null && v !== undefined && v !== ''), nums = vals.map(toNum).filter(Number.isFinite), isNum = vals.length > 0 && nums.length / vals.length > 0.85;
      const c = { name: k, filled: vals.length, missing: rows.length - vals.length, type: isNum ? 'number' : 'text' };
      if (isNum && nums.length) { const s = [...nums].sort((a, b) => a - b); c.min = s[0]; c.max = s[s.length - 1]; c.mean = nums.reduce((a, b) => a + b, 0) / nums.length; c.median = s[Math.floor(s.length / 2)]; c.sum = nums.reduce((a, b) => a + b, 0); }
      else { const cnt = new Map(); vals.forEach(v => cnt.set(String(v), (cnt.get(String(v)) || 0) + 1)); c.unique = cnt.size; c.top = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${String(v).slice(0, 24)} (${n})`).join(', '); }
      return c;
    });
  }
  function buildData(rows, s) {
    if (s.type === 'histogram') {
      const v = rows.map(r => toNum(r[s.y])).filter(Number.isFinite); if (!v.length) return null;
      const mn = Math.min(...v), mx = Math.max(...v), n = 10, w = (mx - mn) / n || 1, bins = Array(n).fill(0);
      v.forEach(a => { bins[Math.min(n - 1, Math.floor((a - mn) / w))]++; });
      return { labels: bins.map((_, i) => `${fm(mn + i * w)} to ${fm(mn + (i + 1) * w)}`), data: bins };
    }
    if (s.type === 'scatter') { const pts = rows.map(r => ({ x: toNum(r[s.x]), y: toNum(r[s.y]) })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 3000); return pts.length ? { points: pts } : null; }
    const g = new Map();
    rows.forEach(r => { const k = String(r[s.x] ?? '(blank)'), v = s.agg === 'count' ? 1 : toNum(r[s.y]); if (s.agg !== 'count' && !Number.isFinite(v)) return; const o = g.get(k) || { n: 0, s: 0, mn: Infinity, mx: -Infinity }; o.n++; o.s += v; o.mn = Math.min(o.mn, v); o.mx = Math.max(o.mx, v); g.set(k, o); });
    let arr = [...g].map(([k, o]) => ({ k, v: s.agg === 'count' ? o.n : s.agg === 'avg' ? o.s / o.n : s.agg === 'min' ? o.mn : s.agg === 'max' ? o.mx : o.s }));
    if (!arr.length) return null; if (s.type !== 'line') arr.sort((a, b) => b.v - a.v); arr = arr.slice(0, s.top || 20);
    return { labels: arr.map(a => a.k), data: arr.map(a => +a.v.toFixed(4)) };
  }
  async function openLab(file) {
    try {
      toast('Reading ' + file.name + '...'); await lib(XL, () => window.XLSX); await lib(CJ, () => window.Chart);
      Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--dim');
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true }); labModal(file.name, wb);
    } catch (e) { toast(e.message || 'Could not read that file.'); }
  }
  function labModal(name, wb) {
    const lab = { rows: [], cols: [], chart: null, last: null, spec: null, sheet: wb.SheetNames[0] };
    const m = sheet('Data Lab', '<div id="dlTop"></div>', true), q = s => m.querySelector(s);
    const load = () => {
      lab.rows = XLSX.utils.sheet_to_json(wb.Sheets[lab.sheet], { defval: null }).slice(0, 50000);
      lab.rows.forEach(r => { for (const k in r) if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0, 10); });
      lab.cols = profileCols(lab.rows); paint();
    };
    const summary = () => lab.cols.map(c => c.type === 'number' ? `${c.name}: number, min ${fm(c.min)}, max ${fm(c.max)}, mean ${fm(c.mean)}, ${c.missing} missing` : `${c.name}: text, ${c.unique} unique values, top: ${c.top}, ${c.missing} missing`).join('\n');
    function paint() {
      const nums = lab.cols.filter(c => c.type === 'number'), opt = (a, sel) => a.map(c => `<option ${c.name === sel ? 'selected' : ''}>${x(c.name)}</option>`).join(''), head = lab.cols.slice(0, 12);
      q('#dlTop').innerHTML = `
      <div class="dlrow" style="align-items:center"><b>${x(name)}</b><small class="hint">${lab.rows.length.toLocaleString()} rows, ${lab.cols.length} columns</small>${wb.SheetNames.length > 1 ? `<select id="dlSh" class="field">${wb.SheetNames.map(s => `<option ${s === lab.sheet ? 'selected' : ''}>${x(s)}</option>`).join('')}</select>` : ''}</div>
      <h3>Columns</h3><div class="tw"><table><tr><th>Name</th><th>Type</th><th>Filled</th><th>Details</th></tr>${lab.cols.map(c => `<tr><td>${x(c.name)}</td><td>${c.type}</td><td>${c.filled}</td><td>${c.type === 'number' ? `min ${fm(c.min)}, max ${fm(c.max)}, average ${fm(c.mean)}, total ${fm(c.sum)}` : `${c.unique} unique. Most common: ${x(c.top)}`}</td></tr>`).join('')}</table></div>
      <h3 style="margin-top:12px">First rows</h3><div class="tw"><table><tr>${head.map(c => `<th>${x(c.name)}</th>`).join('')}</tr>${lab.rows.slice(0, 12).map(r => `<tr>${head.map(c => `<td>${x(r[c.name] ?? '')}</td>`).join('')}</tr>`).join('')}</table></div>
      <h3 style="margin-top:12px">Chart</h3>
      <div class="dlrow"><div><label>Type</label><select id="dlT" class="field">${['bar', 'line', 'pie', 'doughnut', 'scatter', 'histogram'].map(t => `<option>${t}</option>`).join('')}</select></div><div><label>X (group by)</label><select id="dlX" class="field">${opt(lab.cols)}</select></div><div><label>Y (a number column)</label><select id="dlY" class="field">${opt(nums)}</select></div><div><label>Calculate</label><select id="dlA" class="field">${['sum', 'avg', 'count', 'min', 'max'].map(t => `<option>${t}</option>`).join('')}</select></div><div><label>Top</label><input id="dlN" type="number" class="field" value="15" style="width:70px"></div><button class="btn pri" id="dlD">Draw</button></div>
      <div class="dlcv"><canvas id="dlC"></canvas></div>
      <div class="dlrow"><button class="btn" id="dlP">Download chart (PNG)</button><button class="btn" id="dlS">Download chart data (CSV)</button><button class="btn" id="dlE">Download all data (Excel)</button></div>
      <h3>Ask Perses</h3><div class="dlrow"><button class="btn" id="dlI">Suggest charts (AI)</button><button class="btn pri" id="dlA2">Analyze in the chat</button></div><div class="sugg" id="dlSg"></div>`;
      if (q('#dlSh')) q('#dlSh').onchange = e => { lab.sheet = e.target.value; load(); };
      q('#dlD').onclick = () => draw({ type: q('#dlT').value, x: q('#dlX').value, y: q('#dlY').value, agg: q('#dlA').value, top: +q('#dlN').value || 15 });
      q('#dlP').onclick = () => { if (!lab.chart) return toast('Draw a chart first.'); const a = el('a'); a.href = lab.chart.toBase64Image(); a.download = 'perses-chart.png'; a.click(); };
      q('#dlS').onclick = () => {
        if (!lab.last || !lab.spec) return toast('Draw a chart first.'); const d = lab.last, s = lab.spec;
        const rows = d.points ? d.points.map(p => ({ [s.x]: p.x, [s.y]: p.y })) : d.labels.map((l, i) => ({ [s.type === 'histogram' ? 'range' : s.x]: l, value: d.data[i] }));
        const a = el('a'); a.href = URL.createObjectURL(new Blob([XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows))], { type: 'text/csv' })); a.download = 'perses-chart-data.csv'; a.click();
      };
      q('#dlE').onclick = () => { const b = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(b, XLSX.utils.json_to_sheet(lab.rows), 'Data'); XLSX.writeFile(b, 'perses-data.xlsx'); };
      q('#dlI').onclick = async () => {
        q('#dlSg').innerHTML = '<small class="hint">Thinking...</small>';
        try {
          const sample = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(lab.rows.slice(0, 8)));
          const out = await PersesAsk(`You are a data analyst. Columns:\n${summary()}\n\nFirst rows:\n${sample}\n\nSuggest 4 useful charts. Reply with ONLY a JSON array, each item {"title":"...","type":"bar|line|pie|doughnut|scatter|histogram","x":"column name","y":"numeric column name","agg":"sum|avg|count|min|max"}. Use ONLY the exact column names above. For histogram use only y. For scatter use two numeric columns.`);
          const names = lab.cols.map(c => c.name), list = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0]).filter(s => s && names.includes(s.y || s.x));
          q('#dlSg').innerHTML = list.length ? '' : '<small class="hint">No ideas came back. Try again.</small>';
          list.forEach(s => { const b = el('button', 'btn', x(s.title || (s.type + ' of ' + s.y))); b.onclick = () => { s.top = 15; if (q('#dlT')) { q('#dlT').value = s.type; if (s.x) q('#dlX').value = s.x; if (s.y) q('#dlY').value = s.y; q('#dlA').value = s.agg || 'sum'; } draw(s); }; q('#dlSg').append(b); });
        } catch (e) { q('#dlSg').innerHTML = `<small class="err">${x(e.message || 'Could not get ideas.')}</small>`; }
      };
      q('#dlA2').onclick = () => {
        const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(lab.rows.slice(0, 150))).slice(0, 60000);
        addContext('Spreadsheet: ' + name, `File: ${name}, sheet ${lab.sheet}, ${lab.rows.length} rows.\n\nCOLUMNS:\n${summary()}\n\nFIRST ${Math.min(150, lab.rows.length)} ROWS (CSV):\n${csv}`);
        m.remove(); submit('Analyze the attached spreadsheet: explain what the data is, the key insights, anything unusual, and what to look at next. Use tables where helpful.', [], false);
      };
    }
    function draw(s) {
      const d = buildData(lab.rows, s); if (!d) { toast('Choose a number column for Y (and a column for X).'); return; }
      if (lab.chart) lab.chart.destroy(); const t = s.type === 'histogram' ? 'bar' : s.type, pie = t === 'pie' || t === 'doughnut';
      lab.chart = new Chart(q('#dlC'), { type: t, data: t === 'scatter' ? { datasets: [{ label: `${s.y} vs ${s.x}`, data: d.points, backgroundColor: '#ff5a00' }] } : { labels: d.labels, datasets: [{ label: s.title || (s.type === 'histogram' ? 'Count of ' + s.y : `${s.agg} of ${s.y || s.x}`), data: d.data, backgroundColor: pie ? d.labels.map((_, i) => PAL[i % PAL.length]) : '#ff5a00', borderColor: '#ff5a00', tension: .3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: pie } } } });
      lab.last = d; lab.spec = s;
    }
    load();
  }
  Perses.attach.push(() => ['Analyze a spreadsheet (charts)', async () => { const f = await pick('.csv,.tsv,.xlsx,.xls'); if (f) openLab(f); }]);

  /* ---------- audio transcription and meeting minutes ---------- */
  const wav = f32 => {
    const n = f32.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
    return new Blob([b], { type: 'audio/wav' });
  };
  async function toWavChunks(ab) {
    const AC = window.AudioContext || window.webkitAudioContext; let ctx; try { ctx = new AC({ sampleRate: 16000 }); } catch { ctx = new AC(); }
    let buf; try { buf = await ctx.decodeAudioData(ab.slice(0)); } catch { throw new Error('This file could not be read. Try mp3, m4a, wav or webm.'); } try { ctx.close(); } catch {}
    const ch = buf.numberOfChannels, len = buf.length, mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
    let data = mono; if (buf.sampleRate !== 16000) { const ratio = buf.sampleRate / 16000, n = Math.floor(len / ratio); data = new Float32Array(n); for (let i = 0; i < n; i++) data[i] = mono[Math.floor(i * ratio)]; }
    const per = 16000 * 60, out = []; for (let s = 0; s < data.length; s += per) { const part = data.subarray(s, Math.min(data.length, s + per)); if (part.length > 8000) out.push(wav(part)); }
    return out;
  }
  async function transcribeChunk(blob) {
    for (let t = 0; ; t++) {
      const h = await authHeaders(); h['Content-Type'] = 'audio/wav';
      const r = await fetch(CONFIG.API_BASE + '/api/transcribe', { method: 'POST', headers: h, body: blob });
      if (r.ok) return (await r.json()).text || '';
      const e = await apiError(r);
      if (e.code === 'limit' || ![429, 503].includes(r.status) || t >= 2) throw e;
      await sleep(4000 * (t + 1));
    }
  }
  async function transcribeAll(chunks, onProg) {
    const out = new Array(chunks.length); let next = 0, done = 0;
    const worker = async () => { while (next < chunks.length) { const i = next++; out[i] = await transcribeChunk(chunks[i]); onProg(++done, chunks.length); } };
    await Promise.all([worker(), worker()]); return out.join(' ').replace(/\s+/g, ' ').trim();
  }
  function openTranscribe() {
    if (guest) { toast('Log in to transcribe audio.'); showAuth('signup'); return; }
    const m = sheet('Transcribe audio or meetings', `<p class="hint">Turn a recording into text, then get meeting minutes or a summary. Works with most audio and video files up to about 30 minutes. Files are converted on your device first.</p>
      <div class="dlrow"><button class="btn pri" id="trF">Choose audio or video file</button><button class="btn" id="trR">Record now</button></div>
      <div class="prog"><i id="trP"></i></div><small class="hint" id="trS"></small>
      <textarea id="trT" class="field tbox" placeholder="Your transcript appears here. You can edit it."></textarea>
      <div class="dlrow"><button class="btn pri" id="trM">Meeting minutes</button><button class="btn" id="trU">Summary</button><button class="btn" id="trQ">Ask questions in chat</button><button class="btn" id="trC">Copy</button><button class="btn" id="trD">Download .txt</button></div>`);
    const q = s => m.querySelector(s), say = t => { q('#trS').textContent = t; }, text = () => q('#trT').value.trim();
    async function run(file) {
      if (file.size > 40e6) { toast('That file is over 40 MB. Trim or compress it first.'); return; }
      try {
        q('#trP').style.width = '4%'; say('Preparing audio on your device...');
        const chunks = await toWavChunks(await file.arrayBuffer());
        if (!chunks.length) throw new Error('No audio found in that file.');
        if (chunks.length > 45) throw new Error('That recording is longer than about 45 minutes. Please split it.');
        const t = await transcribeAll(chunks, (d, n) => { q('#trP').style.width = Math.max(6, d / n * 100) + '%'; say(`Transcribing part ${d} of ${n}...`); });
        q('#trT').value = t; say(t ? `Done. ${t.split(/\s+/).length.toLocaleString()} words.` : 'No speech was found.'); q('#trP').style.width = '100%';
      } catch (e) { say(''); q('#trP').style.width = '0'; toast(e.message || 'Transcription failed.'); }
    }
    q('#trF').onclick = async () => { const f = await pick('audio/*,video/*,.m4a,.mp3,.wav,.ogg,.webm,.mp4,.aac,.flac'); if (f) run(f); };
    let mr = null, parts = [], strm = null, tmr = 0;
    q('#trR').onclick = async () => {
      if (mr) { mr.stop(); return; }
      try { strm = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast('Please allow microphone access.'); return; }
      parts = []; mr = new MediaRecorder(strm); mr.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
      mr.onstop = () => { clearInterval(tmr); strm.getTracks().forEach(t => t.stop()); const btn = q('#trR'); if (btn) { btn.textContent = 'Record now'; btn.classList.remove('rec'); } const bl = new Blob(parts, { type: mr.mimeType || 'audio/webm' }); mr = null; run(bl); };
      mr.start(); const t0 = Date.now(), btn = q('#trR'); btn.classList.add('rec');
      tmr = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); btn.textContent = `Stop recording (${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')})`; if (s > 1800 && mr) mr.stop(); }, 500);
    };
    const go = prompt => { const t = text(); if (!t) { toast('Get a transcript first.'); return; } addContext('Transcript', t); m.remove(); submit(prompt, [], false); };
    q('#trM').onclick = () => go('Create professional meeting minutes from the attached transcript. Include: title, summary, attendees (if they can be identified), key discussion points, decisions, action items as a table (owner, task, deadline if mentioned), and open questions. Use Markdown headings.');
    q('#trU').onclick = () => go('Summarize the attached transcript in clear bullet points, then give a one-line takeaway.');
    q('#trQ').onclick = () => go('I attached a transcript. Briefly say what it is about, then wait for my questions.');
    q('#trC').onclick = () => { const t = text(); if (!t) return; navigator.clipboard.writeText(t).then(() => toast('Copied')); };
    q('#trD').onclick = () => { const t = text(); if (!t) return; const a = el('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' })); a.download = 'transcript.txt'; a.click(); };
  }
  Perses.attach.push(() => ['Transcribe audio or meetings', openTranscribe]);

  /* ---------- deep research ---------- */
  async function deepResearch(topic) {
    if (guest) { toast('Log in to use deep research.'); showAuth('signup'); return; }
    if (((window.PCFG || {}).kill || {}).search) { toast('Deep research is switched off right now.'); return; }
    if (busy) { toast('Wait for the current reply to finish.'); return; }
    let chat = cur();
    if (!chat) { chat = { id: uid(), title: topic.slice(0, 40), mode, project: activeProject, messages: [], updated: Date.now() }; chats.unshift(chat); currentId = chat.id; }
    const u = { role: 'user', content: '/research ' + topic, images: [], kind: 'chat' };
    chat.messages.push(u); chat.updated = Date.now(); els.welcome.style.display = 'none'; addMsg(u, chat.messages.length - 1); saveChats(); renderHistory(); toBottom();
    const msg = { role: 'assistant', content: '' }, ui = addMsg(msg, chat.messages.length);
    const prog = t => { ui.body.innerHTML = `<div class="typing"><i></i><i></i><i></i></div> <span style="color:var(--dim)">${x(t)}</span>`; };
    prog('Starting deep research (about 30 to 60 seconds)...'); abortCtl = new AbortController(); setBusy(true);
    try {
      const r = await fetch(CONFIG.API_BASE + '/api/research', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ topic }), signal: abortCtl.signal });
      if (!r.ok) throw await apiError(r);
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      const handle = line => { const s = line.trim(); if (!s) return; let o; try { o = JSON.parse(s); } catch { return; } if (o.p) prog(o.p); if (o.error) throw new Error(o.error); if (o.report) msg.content = o.report; };
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(handle); }
      handle(buf);
      if (!msg.content) throw new Error('No report was produced. Please try again.');
      ui.body.innerHTML = md(msg.content); enhance(ui.body);
      chat.messages.push(msg); chat.updated = Date.now(); saveChats(); renderHistory(); refreshUsage(); Perses.fire(Perses.afterReply, chat, msg);
    } catch (e) { if (e.name !== 'AbortError') await handleFail(e, ui.body, chat); const a = ui.bub.querySelector('.actions'); if (a && !msg.content) a.remove(); }
    setBusy(false); toBottom();
  }
  Perses.attach.push(() => ['Deep research (sourced report)', async () => { const v = await dialog({ title: 'Deep research', text: 'Perses runs several web searches and writes one report with sources. It uses 3 of your daily messages.', input: true, ok: 'Research' }); if (v && v.trim()) deepResearch(v.trim()); }]);

  /* /research and /repo typed in the message box */
  TAG_LIST.push(['research', 'Deep research with sources'], ['repo', 'Explain a GitHub repo']);
  const _submit = window.submit;
  window.submit = async function (text, images, force) {
    const t = String(text || '').trim(); let m;
    if ((m = /^\/research\s+([\s\S]+)/i.exec(t))) return deepResearch(m[1].trim());
    if ((m = /^\/repo\s+(\S+)/i.exec(t))) return repoFlow(m[1]);
    return _submit(text, images, force);
  };
})();
