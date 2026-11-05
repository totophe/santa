import { useEffect, useState } from 'react';
import { api, ApiError, type PublicMeta, type SessionUser } from '../api';
import { useI18n } from '../i18n';
import { pushSupported, isIos, isStandalone, permission, isSubscribed, enablePush, disablePush } from '../push';

export function Account({
  user,
  meta,
  onUpdated,
  onSignedOut,
}: {
  user: SessionUser;
  meta: PublicMeta | null;
  onUpdated: (u: SessionUser) => void;
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

      {meta?.pushEnabled && <NotificationsCard publicKey={meta.pushPublicKey} />}

      <DigestCard user={user} onUpdated={onUpdated} />

      <button className="btn btn-ghost" onClick={onSignedOut}>{t('action.sign_out')}</button>
      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} disabled={busy} onClick={remove}>{t('action.delete_account')}</button>
    </div>
  );
}

function DigestCard({ user, onUpdated }: { user: SessionUser; onUpdated: (u: SessionUser) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const on = !user.digestOptOut;

  async function toggle() {
    setBusy(true);
    try {
      // New opt-out value = the current on-state (turning the box off opts out).
      const { user: u } = await api.updateProfile(user.firstName ?? '', user.lastName, user.language, on);
      onUpdated(u);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('account.digest_label')}</div>
      <p className="muted" style={{ fontSize: 14 }}>{t('account.digest_hint')}</p>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
        <input type="checkbox" checked={on} disabled={busy} onChange={toggle} />
        <span>{t('account.digest_label')}</span>
      </label>
    </div>
  );
}

function NotificationsCard({ publicKey }: { publicKey: string | null }) {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = pushSupported();
  const iosGate = isIos() && !isStandalone(); // iOS needs an installed PWA
  const blocked = supported && permission() === 'denied';

  useEffect(() => {
    if (supported) void isSubscribed().then(setOn).catch(() => {});
  }, [supported]);

  async function toggle() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      if (on) { await disablePush(); setOn(false); }
      else { await enablePush(publicKey); setOn(true); }
    } catch {
      setError(permission() === 'denied' ? t('notifications.blocked') : t('notifications.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('notifications.title')}</div>
      {iosGate ? (
        <p className="muted" style={{ fontSize: 14 }}>{t('notifications.ios_hint')}</p>
      ) : !supported ? (
        <p className="muted" style={{ fontSize: 14 }}>{t('notifications.unsupported')}</p>
      ) : blocked ? (
        <p className="muted" style={{ fontSize: 14 }}>{t('notifications.blocked')}</p>
      ) : (
        <>
          {on && <p className="muted" style={{ fontSize: 14 }}>{t('notifications.on')}</p>}
          <button className={on ? 'btn btn-ghost' : 'btn btn-primary'} disabled={busy} onClick={toggle}>
            {on ? t('notifications.disable') : t('notifications.enable')}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
