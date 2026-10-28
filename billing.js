/* Perses billing screen: monthly / yearly (10% off) and the 3-day Pro trial */
(() => {
  let period = 'month';
  const MONTH = { pro: 5.99, elite: 10.99 }, OFF = 0.10;
  const yearly = id => +(MONTH[id] * 12 * (1 - OFF)).toFixed(2);
  const money = n => '$' + n.toFixed(2);

  window.renderPlans = function () {
    const box = $('#plansBox'); box.innerHTML = '';
    let tg = $('#billToggle');
    if (!tg) {
      tg = document.createElement('div'); tg.id = 'billToggle'; tg.className = 'seg';
      tg.innerHTML = '<button data-p="month">Monthly</button><button data-p="year">Yearly <small>save 10%</small></button>';
      box.before(tg);
      tg.onclick = e => { const b = e.target.closest('button'); if (!b) return; period = b.dataset.p; renderPlans(); };
    }
    tg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === period));
    const canTrial = !guest && plan() === 'free' && profile && !profile.trial_used;

    CONFIG.PLANS.forEach(p => {
      const d = document.createElement('div'); d.className = 'plan ' + p.id;
      let price = p.price, per = p.per, note = '';
      if (p.id !== 'free' && period === 'year') {
        price = money(yearly(p.id)); per = ' / year';
        note = `<p class="save">That is ${money(yearly(p.id) / 12)} a month. You save ${money(MONTH[p.id] * 12 - yearly(p.id))} a year.</p>`;
      }
      d.innerHTML = `${p.badge ? `<span class="badge">${p.badge}</span>` : ''}<h3>${p.name}</h3><div class="price">${price}<small>${per}</small></div>${note}<p class="tag">${p.tag}</p><ul>${p.pros.map(x => `<li class="y">${x}</li>`).join('')}${p.cons.map(x => `<li class="n">${x}</li>`).join('')}</ul>`;

      if (p.id === 'pro' && canTrial) {
        const t = document.createElement('button'); t.className = 'primary'; t.textContent = 'Start 3-day free trial'; t.onclick = startTrial; d.append(t);
        const s = document.createElement('button'); s.className = 'btn'; s.style.marginTop = '8px'; s.textContent = 'Buy Pro'; s.onclick = () => choose('pro'); d.append(s);
      } else {
        const b = document.createElement('button'); b.className = 'primary';
        if (p.id === plan()) { b.textContent = 'Your current plan'; b.disabled = true; }
        else if (RANK[p.id] < RANK[plan()]) { b.textContent = 'Included in your plan'; b.disabled = true; }
        else { b.textContent = 'Get ' + p.name.replace('Perses ', ''); b.onclick = () => choose(p.id); }
        d.append(b);
      }
      box.append(d);
    });
  };

  window.choose = function (id) {
    const c = CONFIG.CHECKOUT[id], url = typeof c === 'string' ? c : c && c[period];
    if (url) window.open(url, '_blank', 'noopener'); else toast('Payments are not switched on yet. Coming soon.');
  };

  async function startTrial() {
    const { data, error } = await sb.rpc('start_trial');
    if (error || data !== 'ok') { toast(data === 'used' ? 'You already used your free trial.' : 'Could not start the trial.'); return; }
    const { data: p } = await sb.from('profiles').select('plan,plan_expires,trial_used').eq('id', user.id).maybeSingle();
    Object.assign(profile, p || {});
    paintPlan(); applyBg(); refreshUsage(); close('upgradeModal');
    dialog({ title: 'Your Pro trial has started', text: 'You have Pro for 3 days. No card needed. When it ends you go back to the Free plan automatically.', ok: 'Great', cancel: '' });
  }

  const oldPaint = window.paintPlan;
  window.paintPlan = function () {
    oldPaint();
    if (!guest && profile && profile.plan_expires && plan() !== 'free') {
      const days = Math.max(1, Math.ceil((new Date(profile.plan_expires) - Date.now()) / 864e5));
      $('#uPlan').textContent = PLAN_NAME[plan()] + ' (' + days + (days === 1 ? ' day' : ' days') + ' left)';
    }
  };
})();
