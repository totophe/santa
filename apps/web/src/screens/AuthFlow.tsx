import { useState } from 'react';
import { api, ApiError, type PublicMeta, type SessionUser } from '../api';
import { useI18n } from '../i18n';

type View = 'signin' | 'code' | 'profile';

export function AuthFlow({
  meta,
  initialUser,
  onAuthed,
}: {
  meta: PublicMeta | null;
  initialUser: SessionUser | null;
  onAuthed: (u: SessionUser) => void;
}) {
  const [view, setView] = useState<View>(initialUser ? 'profile' : 'signin');
  const [email, setEmail] = useState('');
  const [shared, setShared] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  if (view === 'signin')
    return (
      <SignIn
        onSent={(e, s) => {
          setEmail(e);
          setShared(s);
          setView('code');
        }}
      />
    );
  if (view === 'code')
    return (
      <EnterCode
        email={email}
        sharedDevice={shared}
        onVerified={(u) => {
          setUser(u);
          if (u.profileComplete) onAuthed(u);
          else setView('profile');
        }}
        onBack={() => setView('signin')}
      />
    );
  return <ProfileSetup meta={meta} initial={user} onSaved={onAuthed} />;
}

function SignIn({ onSent }: { onSent: (email: string, shared: boolean) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(email, shared);
      onSent(email, shared);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('signin.too_many') : t('signin.invalid_address'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 26 }}>{t('signin.title')}</h2>
      <p className="muted" style={{ marginTop: -4 }}>{t('app.tagline')}</p>
      <div className="field">
        <label htmlFor="email">{t('signin.email_label')}</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>{t('signin.shared_device')}<br /><span className="muted" style={{ fontSize: 13 }}>{t('signin.shared_device_hint')}</span></span>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? t('signin.sending') : t('action.send_code')}</button>
    </form>
  );
}

function EnterCode({ email, sharedDevice, onVerified, onBack }: { email: string; sharedDevice: boolean; onVerified: (u: SessionUser) => void; onBack: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.verify(email, value, sharedDevice);
      onVerified(user);
    } catch {
      setError(t('code.invalid'));
      setCode('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card stack">
      <h2 style={{ fontSize: 26 }}>{t('code.title')}</h2>
      <p className="muted" style={{ marginTop: -4 }}>{t('code.sent_to', { email })} {t('code.link_hint')}</p>
      <input inputMode="numeric" autoComplete="one-time-code" pattern="\d*" value={code} disabled={busy}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) void verify(d); }}
        style={{ fontSize: 28, letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'ui-monospace, monospace' }} aria-label={t('code.title')} />
      {error && <p className="error">{error}</p>}
      <button className="btn btn-ghost" type="button" onClick={onBack}>{t('action.use_another_address')}</button>
    </div>
  );
}

function ProfileSetup({ meta, initial, onSaved }: { meta: PublicMeta | null; initial: SessionUser | null; onSaved: (u: SessionUser) => void }) {
  const { t, setLang } = useI18n();
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [language, setLanguage] = useState(initial?.language ?? meta?.defaultLanguage ?? 'en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const langs = meta?.languages ?? ['en', 'fr'];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.updateProfile(firstName.trim(), lastName.trim() || null, language);
      setLang(user.language); // apply the chosen UI language immediately
      onSaved(user);
    } catch {
      setError(t('create.error'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 26 }}>{t('profile.title')}</h2>
      <div className="field">
        <label htmlFor="fn">{t('profile.first_name')}</label>
        <input id="fn" type="text" maxLength={30} required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <span className="muted" style={{ fontSize: 13 }}>{t('profile.first_name_hint')}</span>
      </div>
      <div className="field">
        <label htmlFor="ln">{t('profile.last_name')}</label>
        <input id="ln" type="text" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="lang">{t('profile.language')}</label>
        <select id="lang" value={language} onChange={(e) => { setLanguage(e.target.value); setLang(e.target.value); }}
          style={{ minHeight: 48, borderRadius: 12, border: '1px solid var(--line)', padding: '0 12px', fontSize: 16, background: 'var(--bg)', color: 'var(--text)' }}>
          {langs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{t('action.continue')}</button>
    </form>
  );
}
