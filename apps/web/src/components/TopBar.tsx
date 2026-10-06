import { useState } from 'react';
import { api, type PublicMeta, type SessionUser } from '../api';
import { useI18n } from '../i18n';

/** Persistent top bar shown on every screen, with a global dropdown menu. */
export function TopBar({
  meta,
  user,
  onHome,
  onAccount,
  onSignOut,
  onUserUpdated,
}: {
  meta: PublicMeta | null;
  user: SessionUser | null;
  onHome: () => void;
  onAccount: () => void;
  onSignOut: () => void;
  onUserUpdated: (u: SessionUser) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const authed = !!(user && user.profileComplete);
  const langs = meta?.languages ?? ['en', 'fr'];

  async function pickLang(l: string) {
    setOpen(false);
    setLang(l);
    // Persist for signed-in users so the choice sticks across sessions/devices.
    if (authed && user?.firstName) {
      try {
        const { user: u } = await api.updateProfile(user.firstName, user.lastName, l);
        onUserUpdated(u);
      } catch {
        /* non-fatal — UI language still switched for this session */
      }
    }
  }

  const item: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '12px 16px',
    font: 'inherit',
    fontSize: 15,
    color: 'var(--text)',
    cursor: 'pointer',
    minHeight: 44,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, position: 'relative', zIndex: 30 }}>
      <button
        onClick={() => authed && onHome()}
        style={{ background: 'none', border: 'none', cursor: authed ? 'pointer' : 'default', fontFamily: 'Chewy, cursive', fontSize: 26, color: 'var(--primary)', padding: 0 }}
      >
        {meta?.instanceName ?? 'Santa'}
      </button>

      <div style={{ position: 'relative' }}>
        <button
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="btn btn-soft"
          style={{ width: 'auto', minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span style={{ fontSize: 12, fontWeight: 700 }}>{lang.toUpperCase()}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        {open && (
          <>
            {/* click-away backdrop */}
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
            <div
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                minWidth: 200,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,.14)',
                overflow: 'hidden',
                zIndex: 21,
              }}
            >
              {authed && (
                <>
                  <button style={item} onClick={() => { setOpen(false); onHome(); }}>{t('nav.home')}</button>
                  <button style={item} onClick={() => { setOpen(false); onAccount(); }}>{t('action.account')}</button>
                </>
              )}
              <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', borderTop: authed ? '1px solid var(--line)' : 'none' }}>
                {t('profile.language')}
              </div>
              {langs.map((l) => (
                <button key={l} style={{ ...item, fontWeight: l === lang ? 700 : 400 }} onClick={() => pickLang(l)}>
                  {l.toUpperCase()} {l === lang ? '✓' : ''}
                </button>
              ))}
              {authed && (
                <button
                  style={{ ...item, color: 'var(--danger)', borderTop: '1px solid var(--line)' }}
                  onClick={() => { setOpen(false); onSignOut(); }}
                >
                  {t('action.sign_out')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
