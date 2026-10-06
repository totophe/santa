import { useState } from 'react';
import { api, ApiError, type PublicMeta, type SessionUser } from '../api';
import { useI18n } from '../i18n';

export function Account({
  user,
  meta,
  onUpdated,
  onBack,
  onSignedOut,
}: {
  user: SessionUser;
  meta: PublicMeta | null;
  onUpdated: (u: SessionUser) => void;
  onBack: () => void;
  onSignedOut: () => void;
}) {
  const { t, setLang } = useI18n();
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [language, setLanguage] = useState(user.language);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const langs = meta?.languages ?? ['en', 'fr'];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const { user: u } = await api.updateProfile(firstName.trim(), lastName.trim() || null, language);
      setLang(u.language);
      onUpdated(u);
      setMsg(t('account.saved'));
    } catch {
      setError(t('create.error'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t('account.delete_confirm'))) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount();
      onSignedOut();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t('account.delete_blocked') : t('create.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>{t('web.back_home')}</button>
      <form className="card stack" onSubmit={save}>
        <h2 style={{ fontSize: 26 }}>{t('account.title')}</h2>
        <div className="field">
          <label htmlFor="afn">{t('profile.first_name')}</label>
          <input id="afn" type="text" maxLength={30} required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="aln">{t('profile.last_name')}</label>
          <input id="aln" type="text" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="alang">{t('profile.language')}</label>
          <select id="alang" value={language} onChange={(e) => { setLanguage(e.target.value); setLang(e.target.value); }}
            style={{ minHeight: 48, borderRadius: 12, border: '1px solid var(--line)', padding: '0 12px', fontSize: 16, background: 'var(--bg)', color: 'var(--text)' }}>
            {langs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t('account.email')}</label>
          <input type="text" value={user.email} readOnly disabled />
          <span className="muted" style={{ fontSize: 13 }}>{t('account.email_hint')}</span>
        </div>
        {msg && <p className="muted" style={{ color: 'var(--success)' }}>{msg}</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy} type="submit">{t('action.save')}</button>
      </form>

      <button className="btn btn-ghost" onClick={onSignedOut}>{t('action.sign_out')}</button>
      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} disabled={busy} onClick={remove}>{t('action.delete_account')}</button>
    </div>
  );
}
