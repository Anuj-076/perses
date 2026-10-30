/* Perses diagrams: mind maps and flowcharts drawn in the chat (Mermaid) */
(() => {
  const SRC = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
  let ready = null;
  const load = () => ready || (ready = new Promise((res, rej) => {
    if (window.mermaid) return res();
    const s = document.createElement('script'); s.src = SRC; s.onload = res; s.onerror = () => { ready = null; rej(new Error('Could not load the diagram engine. Check your internet.')); }; document.head.append(s);
  }));
  const st = document.createElement('style');
  st.textContent = '.mmout{padding:12px;background:var(--panel);overflow:auto;text-align:center}.mmout svg{max-width:100%;height:auto}.mmbar{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid #2b313b;background:#1b1f27}.mmbar button{font-size:12px;padding:4px 12px;border-radius:6px;color:#c9d1d9;border:1px solid #3a404a}.mmbar button:hover{border-color:var(--accent);color:var(--accent)}';
  document.head.append(st);

  TAGS.mindmap = { mode: 'default', tpl: t => `Create a mind map about: ${t}\n\nOutput ONLY one fenced code block with language mermaid, using the mindmap syntax, in exactly this shape:\n\`\`\`mermaid\nmindmap\n  root((Main topic))\n    Branch one\n      Leaf\n      Leaf\n    Branch two\n      Leaf\n\`\`\`\nRules: 4 to 7 main branches, 2 to 4 leaves each, labels of at most 4 words, no quotes, no parentheses, no colons or special symbols in labels (except the double parentheses of the root). Write the labels in the same language as the topic. After the code block write one short sentence.` };
  TAGS.flow = { mode: 'default', tpl: t => `Draw a flowchart for: ${t}\n\nOutput ONLY one fenced code block with language mermaid, using "flowchart TD" syntax, like this:\n\`\`\`mermaid\nflowchart TD\n  A[Start] --> B[Do something]\n  B --> C{Question}\n  C -->|Yes| D[Result]\n  C -->|No| E[Other result]\n\`\`\`\nRules: short labels, no quotes, no parentheses, no colons or special symbols inside labels. Use the same language as the request. After the code block write one short sentence.` };
  TAG_LIST.push(['mindmap', 'Draw a mind map'], ['flow', 'Draw a flowchart']);

  const dl = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  async function render(box) {
    if (box.dataset.mm) return; box.dataset.mm = '1';
    const code = box.querySelector('code').textContent.trim();
    let out = box.querySelector('.mmout'); if (!out) { out = document.createElement('div'); out.className = 'mmout'; box.append(out); }
    out.innerHTML = '<small class="hint">Drawing...</small>';
    try {
      await load();
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark', flowchart: { htmlLabels: false } });
      const { svg } = await mermaid.render('mm' + Math.random().toString(36).slice(2), code);
      out.innerHTML = svg; box.querySelector('pre').hidden = true;
      let bar = box.querySelector('.mmbar');
      if (!bar) {
        bar = document.createElement('div'); bar.className = 'mmbar';
        bar.innerHTML = '<button data-a="svg">Download SVG</button><button data-a="png">Download PNG</button><button data-a="code">Show / hide code</button>';
        box.append(bar);
        bar.onclick = e => {
          const b = e.target.closest('button'); if (!b) return;
          const s = out.querySelector('svg'); if (!s && b.dataset.a !== 'code') return;
          if (b.dataset.a === 'code') { const p = box.querySelector('pre'); p.hidden = !p.hidden; return; }
          const cl = s.cloneNode(true), vb = s.viewBox && s.viewBox.baseVal, w = (vb && vb.width) || s.clientWidth || 800, h = (vb && vb.height) || s.clientHeight || 600;
          cl.setAttribute('width', w); cl.setAttribute('height', h); cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          const str = new XMLSerializer().serializeToString(cl);
          if (b.dataset.a === 'svg') return dl(new Blob([str], { type: 'image/svg+xml' }), 'perses-diagram.svg');
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas'), k = 2; c.width = w * k; c.height = h * k; const g = c.getContext('2d');
            g.fillStyle = document.documentElement.dataset.theme === 'light' ? '#ffffff' : '#141414'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(bl => bl && dl(bl, 'perses-diagram.png'));
          };
          img.onerror = () => toast('PNG export failed. Use SVG instead.');
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
        };
      }
    } catch (err) {
      document.querySelectorAll('[id^="dmm"]').forEach(n => n.remove());
      const msg = String(err.message || err).split('\n')[0].slice(0, 140);
      out.innerHTML = `<small class="err">The diagram could not be drawn: ${msg.replace(/[<>&]/g, '')}</small><br><button class="mini" style="margin-top:8px">Ask Perses to fix it</button>`;
      out.querySelector('button').onclick = () => submit(`The mermaid diagram code failed to render (${msg}). Fix the code and send ONLY the corrected mermaid code block.`, [], false);
    }
  }
  Perses.enhancers.push(root => {
    root.querySelectorAll('.codebox').forEach(box => {
      if ((box.dataset.lang || '').toLowerCase() !== 'mermaid') return;
      if (!box.dataset.mmb) {
        box.dataset.mmb = '1';
        const copy = box.querySelector('.copy');
        if (copy) { const g = document.createElement('div'); g.className = 'grp'; copy.replaceWith(g); const b = document.createElement('button'); b.className = 'runbtn'; b.textContent = 'Diagram'; g.append(b, copy); b.onclick = () => { box.dataset.mm = ''; render(box); }; }
      }
      if (!busy) render(box);
    });
  });
  Perses.afterReply.push(() => document.querySelectorAll('#messages .codebox[data-lang=mermaid]').forEach(render));

  const ask = async tag => {
    const v = await dialog({ title: tag === 'mindmap' ? 'Mind map' : 'Flowchart', text: tag === 'mindmap' ? 'What topic should the mind map cover?' : 'What process should the flowchart show?', input: true, ok: 'Draw' });
    if (v && v.trim()) submit('/' + tag + ' ' + v.trim(), [], false);
  };
  Perses.attach.push(() => ['Mind map or flowchart', [['Mind map', () => ask('mindmap')], ['Flowchart', () => ask('flow')]]]);
})();
