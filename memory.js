/* Perses automatic memory + loader for the extra plugin files */
(() => {
  ['merge', 'community', 'lab'].forEach(n => { const s = document.createElement('script'); s.src = n + '.js'; s.async = false; s.onerror = () => s.remove(); document.body.append(s); });

  const KEY = 'perses_automem';
  const enabled = () => localStorage.getItem(KEY) !== '0';
  let count = 0, running = false;
  Perses.afterReply.push(async chat => {
    if (guest || !user || !profile || !enabled() || running) return;
    if (++count % 4 !== 0) return;
    running = true;
    try {
      const msgs = chat.messages.slice(-8).filter(m => m.content).map(m => ({ role: m.role, content: String(m.content).slice(0, 800) }));
      const r = await fetch(CONFIG.API_BASE + '/api/memory', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ memory: profile.memory || '', messages: msgs }) });
      if (!r.ok) return;
      const d = await r.json(), m = (d.memory || '').trim().slice(0, 1800);
      if (m && m !== (profile.memory || '').trim()) { profile.memory = m; await sb.from('profiles').update({ memory: m }).eq('id', user.id); toast('Memory updated'); }
    } catch {} finally { running = false; }
  });
  Perses.onStart(() => {
    if ($('#sAuto')) return;
    const l = document.createElement('label'); l.className = 'chk';
    l.innerHTML = '<input type="checkbox" id="sAuto"><span>Automatic memory: Perses learns your preferences from your chats and keeps them in Memory above. It never stores passwords, ID numbers, health details or other sensitive information.</span>';
    $('#sSave').before(l);
    $('#sAuto').onchange = () => localStorage.setItem(KEY, $('#sAuto').checked ? '1' : '0');
  });
  const old = window.openSettings;
  window.openSettings = function () { old(); const c = $('#sAuto'); if (c) c.checked = enabled(); };
})();
