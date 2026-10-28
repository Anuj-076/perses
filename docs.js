/* Perses documents: PDF, Word, Excel, text. Also powers the long-document summarizer (/summarize). */
(() => {
  const MAX_PER = 120000, MAX_ALL = 300000;
  const LIBS = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  };
  const loaded = {};
  const lib = (name, test) => loaded[name] || (loaded[name] = new Promise((res, rej) => {
    if (test()) return res();
    const s = document.createElement('script'); s.src = LIBS[name]; s.onload = res;
    s.onerror = () => { delete loaded[name]; rej(new Error('Could not load the ' + name + ' reader. Check your internet.')); };
    document.head.append(s);
  }));

  async function parse(file) {
    const n = file.name.toLowerCase();
    if (file.size > 15 * 1024 * 1024) throw new Error('That file is bigger than 15 MB.');
    if (n.endsWith('.pdf')) {
      await lib('pdf', () => window.pdfjsLib);
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      let t = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i), c = await pg.getTextContent();
        t += `\n[Page ${i}]\n` + c.items.map(x => x.str).join(' ');
        if (t.length > MAX_PER) break;
      }
      return t;
    }
    if (n.endsWith('.docx')) {
      await lib('mammoth', () => window.mammoth);
      return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    }
    if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
      await lib('xlsx', () => window.XLSX);
      const wb = XLSX.read(await file.arrayBuffer());
      return wb.SheetNames.map(s => `[Sheet: ${s}]\n` + XLSX.utils.sheet_to_csv(wb.Sheets[s])).join('\n\n');
    }
    if (/\.(txt|md|csv|json|html|xml|js|py|css|log)$/.test(n)) return await file.text();
    throw new Error('Supported files: PDF, Word (.docx), Excel (.xlsx), and text files.');
  }

  const store = new Map();
  let pendingDocs = [];
  const KEY = id => 'perses_docs_' + (user ? user.id : 'guest') + '_' + id;
  function getDocs(id) {
    if (!store.has(id)) { let d = []; try { d = JSON.parse(localStorage.getItem(KEY(id)) || '[]'); } catch {} store.set(id, d); }
    return store.get(id);
  }
  function persist(id) { try { localStorage.setItem(KEY(id), JSON.stringify(store.get(id) || [])); } catch {} }

  let chipBox = null;
  function ensureBox() {
    if (chipBox) return chipBox;
    chipBox = document.createElement('div'); chipBox.id = 'docChips';
    $('#previews').before(chipBox); return chipBox;
  }
  function paint() {
    const box = ensureBox(); box.innerHTML = '';
    const chat = cur();
    const all = [...(chat ? getDocs(chat.id) : []).map((d, i) => ({ d, i, p: false })), ...pendingDocs.map((d, i) => ({ d, i, p: true }))];
    all.forEach(({ d, i, p }) => {
      const c = document.createElement('div'); c.className = 'dchip';
      c.innerHTML = '<b></b><small></small><button title="Remove" aria-label="Remove">\u2715</button>';
      c.querySelector('b').textContent = d.name; c.querySelector('small').textContent = Math.round(d.text.length / 1000) + 'k chars';
      c.querySelector('button').onclick = () => { if (p) pendingDocs.splice(i, 1); else { getDocs(chat.id).splice(i, 1); persist(chat.id); } paint(); };
      box.append(c);
    });
    if (all.length) {
      const s = document.createElement('div'); s.className = 'dchip';
      s.innerHTML = '<button class="sum">Summarize</button>'; s.querySelector('button').onclick = () => send('/summarize'); box.append(s);
    }
  }

  const picker = document.createElement('input');
  picker.type = 'file'; picker.hidden = true; picker.multiple = true; picker.accept = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.html,.xml,.js,.py,.css,.log';
  document.body.append(picker);
  picker.onchange = async () => {
    const files = [...picker.files]; picker.value = '';
    for (const f of files) {
      try {
        toast('Reading ' + f.name + '...');
        const text = (await parse(f)).replace(/\s+\n/g, '\n').trim();
        if (!text) throw new Error('No readable text found in ' + f.name + ' (scanned PDFs are not supported).');
        pendingDocs.push({ name: f.name, text: text.slice(0, MAX_PER) });
        paint(); toast(f.name + ' is ready');
      } catch (e) { toast(e.message || 'Could not read that file.'); }
    }
  };
  Perses.attach.push(() => ['Attach document (PDF, Word, Excel, text)', () => { if (guest) { toast('Log in to attach documents.'); showAuth('signup'); return; } picker.click(); }]);

  Perses.bodyExtra.push(chat => {
    if (pendingDocs.length) { getDocs(chat.id).push(...pendingDocs); pendingDocs = []; persist(chat.id); paint(); }
    const docs = getDocs(chat.id);
    if (!docs.length) return {};
    let ctx = 'DOCUMENTS ATTACHED BY THE USER (answer using them, and mention the document name when you quote):', left = MAX_ALL;
    for (const d of docs) { const t = d.text.slice(0, left); left -= t.length; ctx += `\n\n=== ${d.name} ===\n${t}`; if (left <= 0) break; }
    return { context: ctx };
  });
  Perses.opened.push(paint);
  Perses.onStart(paint);
})();
