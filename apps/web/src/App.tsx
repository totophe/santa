import { useEffect, useState } from 'react';
import { api, type PublicMeta, type SessionUser } from './api';
import { useI18n } from './i18n';
import { TopBar } from './components/TopBar';
import { AuthFlow } from './screens/AuthFlow';
import { Home } from './screens/Home';
import { Edition } from './screens/Edition';
import { Group } from './screens/Group';
import { Join } from './screens/Join';
import { Account } from './screens/Account';

type View =
  | { kind: 'home' }
  | { kind: 'edition'; editionId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'account' };

export default function App() {
  const { setLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [joinToken, setJoinToken] = useState<string | null>(null);

  useEffect(() => {
    const m = /^\/join\/([^/]+)/.exec(window.location.pathname);
    if (m) setJoinToken(decodeURIComponent(m[1]));
    void (async () => {
      let metaData: PublicMeta | null = null;
      try { metaData = await api.meta(); setMeta(metaData); } catch { /* best effort */ }
      try {
        const u = (await api.me()).user;
        setUser(u);
        setLang(u.language);
      } catch {
        if (metaData) setLang(metaData.defaultLanguage);
      }
      setLoading(false);
    })();
  }, [setLang]);

  function openEdition(editionId: string) {
    setJoinToken(null);
    if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
    setView({ kind: 'edition', editionId });
  }

  async function signOut() {
    try { await api.signOut(); } catch { /* ignore */ }
    setUser(null);
    setView({ kind: 'home' });
  }

  function goHome() {
    setJoinToken(null);
    setView({ kind: 'home' });
  }

  const authed = !!(user && user.profileComplete);

  return (
    <div className="shell">
      {!loading && (
        <TopBar
          meta={meta}
          user={user}
          onHome={goHome}
          onAccount={() => setView({ kind: 'account' })}
          onSignOut={signOut}
          onUserUpdated={setUser}
        />
      )}

      {loading && <p className="muted center">…</p>}

      {!loading && joinToken && (
        <>
          <Join token={joinToken} authed={authed} onNeedsAuth={() => {}} onJoined={openEdition} />
          {!authed && (
            <div style={{ marginTop: 16 }}>
              <AuthFlow meta={meta} initialUser={user} onAuthed={(u) => { setUser(u); setLang(u.language); }} />
            </div>
          )}
        </>
      )}

      {!loading && !joinToken && !authed && (
        <AuthFlow meta={meta} initialUser={user} onAuthed={(u) => { setUser(u); setLang(u.language); }} />
      )}

      {!loading && !joinToken && authed && view.kind === 'home' && (
        <Home meta={meta} onOpenEdition={openEdition} onOpenAccount={() => setView({ kind: 'account' })} />
      )}

      {!loading && !joinToken && authed && view.kind === 'account' && user && (
        <Account user={user} meta={meta} onUpdated={setUser} onBack={goHome} onSignedOut={signOut} />
      )}

      {!loading && !joinToken && authed && view.kind === 'edition' && (
        <Edition
          editionId={view.editionId}
          meta={meta}
          onBack={goHome}
          onOpenGroup={(groupId) => setView({ kind: 'group', groupId })}
        />
      )}

      {!loading && !joinToken && authed && view.kind === 'group' && (
        <Group groupId={view.groupId} onOpenEdition={openEdition} onBack={goHome} />
      )}
    </div>
  );
}
