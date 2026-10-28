/* Perses account: delete account (asks twice + emailed code), admin shortcut */
(() => {
  Perses.menu.push(() => (user && CONFIG.ADMINS.includes((user.email || '').toLowerCase())) ? ['Admin dashboard', () => { location.href = 'admin.html'; }] : null);

  Perses.onStart(() => {
    if (guest) return;
    const sheet = $('#settingsModal .sheet');
    if (sheet.querySelector('#sDelete')) return;
    const w = document.createElement('div');
    w.innerHTML = '<h3 class="sub-h danger-h">Delete account</h3><p class="hint">Permanently deletes your account, profile and shared links. We email you a code to confirm.</p><button id="sDelete" class="btn danger wide-btn">Delete my account</button>';
    sheet.append(w);
    $('#sDelete').onclick = deleteFlow;
  });

  async function deleteFlow() {
    const email = user.email;
    if (!(await dialog({ title: 'Delete your account?', text: 'This permanently deletes your account, profile and shared links. Chats saved on this device will also be erased. This cannot be undone.', ok: 'Continue', danger: true }))) return;
    const typed = await dialog({ title: 'Are you absolutely sure?', text: 'Type DELETE (in capital letters) to confirm.', input: true, ok: 'Confirm', danger: true });
    if (typed === null) return;
    if (typed.trim() !== 'DELETE') { toast('You did not type DELETE. Nothing was deleted.'); return; }

    const { error: e1 } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (e1) { toast('Could not send the email: ' + e1.message); return; }
    const code = await dialog({ title: 'Check your email', text: `We sent a security code to ${email}. Enter it to delete your account.`, input: true, ok: 'Delete my account', danger: true });
    if (code === null) return;
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) { toast('That does not look like the code from the email.'); return; }
    const { error: e2 } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (e2) { toast('Wrong or expired code. Nothing was deleted.'); return; }

    try {
      const r = await fetch(CONFIG.API_BASE + '/api/account', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'delete', confirm: 'DELETE' }) });
      if (!r.ok) throw await apiError(r);
    } catch (e) { toast(e.message || 'Could not delete the account.'); return; }

    const id = user.id;
    Object.keys(localStorage).filter(k => k.includes(id)).forEach(k => localStorage.removeItem(k));
    close('settingsModal');
    await sb.auth.signOut();
    dialog({ title: 'Account deleted', text: 'Your account and data have been deleted. Thank you for using Perses.', ok: 'Close', cancel: '' });
  }
})();
