/* Perses billing: Free / VIP / Pro / Elite, monthly or yearly (10% off), upgrade credit with struck-through price, 3-day Pro trial */
(() => {
  const PRICE = { vip: 1.99, pro: 5.99, elite: 10.99 }, OFF = 0.10;
  const money = n => '$' + n.toFixed(2);
  const amt = (id, per) => per === 'year' ? +(PRICE[id] * 12 * (1 - OFF)).toFixed(2) : PRICE[id];
  let period = 'month', source = null, srcLoaded = false;

  /* ---- the four plans (perks) ---- */
  const P = [
    { id: 'free', name: 'Perses (Free)', price: '$0', per: '', tag: 'Great for getting started.',
      pros: ['100 messages per day', '3 AI images per day', '3 projects', 'Read PDF, Word and Excel files', 'Code runner, live preview and voice chat', 'Web search, deep research and exam prep', 'Share chats by link'],
      cons: ['Small "Perses" watermark on images', 'Standard speed, slower when busy', 'No folder colors or custom background'] },
    { id: 'vip', name: 'Perses VIP', price: '$1.99', per: ' / month', tag: 'A small step up that removes the limits you notice first.', badge: 'Starter',
      pros: ['300 messages per day', '6 AI images per day', 'No watermark on images', '8 projects with folder colors', 'Custom background from your gallery', 'Priority over free users', 'Everything in Free'],
      cons: ['Standard AI engine order', 'No deep-thinking mode'] },
    { id: 'pro', name: 'Perses Pro', price: '$5.99', per: ' / month', tag: 'For everyday power users.', badge: 'Most popular',
      pros: ['1,000 messages per day', '15 AI images per day', 'Faster, smarter replies', '20 projects with folder colors', 'Priority over VIP and free users', 'Everything in VIP'],
      cons: ['Daily fair-use limits still apply'] },
    { id: 'elite', name: 'Perses Elite', price: '$10.99', per: ' / month', tag: 'The complete Perses experience.', badge: 'Best value',
      pros: ['5,000 messages per day', '40 AI images per day', 'Deep-thinking mode for hard questions', 'Top priority, the least waiting', '100 projects with folder colors', 'Early access to new features', 'Everything in Pro'],
      cons: ['Fair-use limits apply to prevent abuse'] }
  ];
  CONFIG.PLANS.length = 0; CONFIG.PLANS.push(...P);
  Object.assign(CONFIG.LIMITS, { vip: { msgs: 300, imgs: 6 } });
  Object.assign(RANK, { free: 0, vip: 1, pro: 2, elite: 3 });
  PLAN_NAME.vip = 'Perses VIP'; PROJECT_LIMIT.vip = 8;
  try { INFO.about[1] = INFO.about[1].replace(/Pro \(\$5\.99\/month\) and Elite/, 'VIP ($1.99/month), Pro ($5.99/month) and Elite'); } catch {}

  const st = document.createElement('style');
  st.textContent = '.sheet.wide{max-width:1180px}.plans{grid-template-columns:repeat(auto-fit,minmax(215px,1fr))}.price s{font-family:Inter,sans-serif;font-size:19px;font-weight:500;color:var(--dim);margin-right:8px;text-decoration:line-through}';
  document.head.append(st);

  async function loadSource() {
    if (srcLoaded || guest || !user) return; srcLoaded = true;
    try { const { data } = await sb.from('profiles').select('plan_source').eq('id', user.id).maybeSingle(); source = data ? data.plan_source : null; } catch { source = null; }
    if (!$('#upgradeModal').hidden) renderPlans();
  }
  const credit = () => { const p = plan(); return (guest || p === 'free' || source !== 'paid') ? 0 : amt(p, period); };
  const payFor = id => { const full = amt(id, period), cr = RANK[id] > RANK[plan()] ? credit() : 0; return { full, cr, pay: Math.max(0.5, +(full - cr).toFixed(2)) }; };

  window.renderPlans = function () {
    loadSource();
    const box = $('#plansBox'); box.innerHTML = '';
    let tg = $('#billToggle');
    if (!tg) {
      tg = document.createElement('div'); tg.id = 'billToggle'; tg.className = 'seg';
      tg.innerHTML = '<button data-p="month">Monthly</button><button data-p="year">Yearly <small>save 10%</small></button>';
      box.before(tg); tg.onclick = e => { const b = e.target.closest('button'); if (!b) return; period = b.dataset.p; renderPlans(); };
    }
    tg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === period));
    const held = plan(), canTrial = !guest && held === 'free' && profile && !profile.trial_used, onTrial = !guest && held !== 'free' && source === 'trial';
    const unit = period === 'year' ? ' / year' : ' / month';

    CONFIG.PLANS.forEach(p => {
      const d = document.createElement('div'); d.className = 'plan ' + p.id;
      let price = '$0<small></small>', note = '';
      if (p.id !== 'free') {
        const { full, cr, pay } = payFor(p.id);
        if (cr > 0) {
          price = `<s>${money(full)}</s>${money(pay)}<small>${unit}, first payment</small>`;
          note = `<p class="save">You save ${money(cr)}. We subtract the price of your current ${PLAN_NAME[held]} (${money(cr)}) from the first payment. After that it renews at ${money(full)}.</p>`;
        } else {
          price = `${money(full)}<small>${unit}</small>`;
          if (period === 'year') note = `<p class="save">That is ${money(full / 12)} a month. You save ${money(PRICE[p.id] * 12 - full)} a year.</p>`;
        }
      }
      const tagline = (p.id === held && profile && profile.plan_expires && held !== 'free') ? `Active until ${new Date(profile.plan_expires).toLocaleDateString()}${onTrial ? ' (free trial)' : ''}` : p.tag;
      d.innerHTML = `${p.badge ? `<span class="badge">${p.badge}</span>` : ''}<h3>${p.name}</h3><div class="price">${price}</div>${note}<p class="tag">${tagline}</p><ul>${p.pros.map(x => `<li class="y">${x}</li>`).join('')}${p.cons.map(x => `<li class="n">${x}</li>`).join('')}</ul>`;
      const short = p.name.replace('Perses ', '');
      if (p.id === held) {
        const b = document.createElement('button'); b.className = 'primary';
        if (onTrial) { b.textContent = 'Subscribe to keep ' + short; b.onclick = () => choose(p.id); } else { b.textContent = 'Your current plan'; b.disabled = true; }
        d.append(b);
      } else if (RANK[p.id] < RANK[held]) {
        const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Included in your plan'; b.disabled = true; d.append(b);
      } else if (p.id === 'pro' && canTrial) {
        const t = document.createElement('button'); t.className = 'primary'; t.textContent = 'Start 3-day free trial'; t.onclick = startTrial; d.append(t);
        const s = document.createElement('button'); s.className = 'btn'; s.style.marginTop = '8px'; s.textContent = 'Buy Pro'; s.onclick = () => choose('pro'); d.append(s);
      } else {
        const { cr, pay } = payFor(p.id), b = document.createElement('button'); b.className = 'primary';
        b.textContent = cr > 0 ? `Upgrade for ${money(pay)}` : 'Get ' + short; b.onclick = () => choose(p.id); d.append(b);
      }
      box.append(d);
    });
  };

  window.choose = function (id) {
    const C = CONFIG.CHECKOUT || {}, held = plan(), { cr, pay } = payFor(id);
    const get = o => (o && typeof o === 'object') ? o[period] : o;
    const link = cr > 0 ? get((C.upgrade || {})[held + '>' + id]) : get(C[id]);
    if (link) window.open(link, '_blank', 'noopener'); else toast(`Payments are not switched on yet. This plan would cost ${money(pay)}.`);
  };

  async function startTrial() {
    const { data, error } = await sb.rpc('start_trial');
    if (error || data !== 'ok') { toast(data === 'used' ? 'You already used your free trial.' : 'Could not start the trial.'); return; }
    const { data: p } = await sb.from('profiles').select('plan,plan_expires,trial_used').eq('id', user.id).maybeSingle();
    Object.assign(profile, p || {}); source = 'trial';
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
