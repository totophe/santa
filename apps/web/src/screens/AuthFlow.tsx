import { useState } from 'react';
import { api, ApiError, type PublicMeta, type SessionUser } from '../api';

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
  return (
    <ProfileSetup
      meta={meta}
      initial={user}
      onSaved={onAuthed}
    />
  );
}

function SignIn({ onSent }: { onSent: (email: string, shared: boolean) => void }) {
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
      setError(err instanceof ApiError && err.status === 429 ? 'Too many requests. Try again later.' : 'That doesn’t look like an email address.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 26 }}>Sign in</h2>
      <p className="muted" style={{ marginTop: -4 }}>A group that lasts, a draw nobody can see, a wishlist per person.</p>
      <div className="field">
        <label htmlFor="email">Your email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>Shared device<br /><span className="muted" style={{ fontSize: 13 }}>You’ll be signed out when you close the browser.</span></span>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send my code'}</button>
    </form>
  );
}

function EnterCode({ email, sharedDevice, onVerified, onBack }: { email: string; sharedDevice: boolean; onVerified: (u: SessionUser) => void; onBack: () => void }) {
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
      setError('Wrong or expired code.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card stack">
      <h2 style={{ fontSize: 26 }}>Enter your code</h2>
      <p className="muted" style={{ marginTop: -4 }}>We sent a code to {email}. The link in the email works too.</p>
      <input inputMode="numeric" autoComplete="one-time-code" pattern="\d*" value={code} disabled={busy}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) void verify(d); }}
        style={{ fontSize: 28, letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'ui-monospace, monospace' }} aria-label="6-digit code" />
      {error && <p className="error">{error}</p>}
      <button className="btn btn-ghost" type="button" onClick={onBack}>Use another address</button>
    </div>
  );
}

function ProfileSetup({ meta, initial, onSaved }: { meta: PublicMeta | null; initial: SessionUser | null; onSaved: (u: SessionUser) => void }) {
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
      onSaved(user);
    } catch {
      setError('Please check your name (no links) and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 26 }}>Your profile</h2>
      <div className="field">
        <label htmlFor="fn">First name or nickname</label>
        <input id="fn" type="text" maxLength={30} required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <span className="muted" style={{ fontSize: 13 }}>This is the name everyone sees. A nickname like “Mamy” is fine.</span>
      </div>
      <div className="field">
        <label htmlFor="ln">Last name (optional)</label>
        <input id="ln" type="text" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="lang">Language</label>
        <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)}
          style={{ minHeight: 48, borderRadius: 12, border: '1px solid var(--line)', padding: '0 12px', fontSize: 16, background: 'var(--bg)', color: 'var(--text)' }}>
          {langs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">Continue</button>
    </form>
  );
}
