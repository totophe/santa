import { useEffect, useState } from 'react';
import { api, type PublicMeta, type SessionUser } from './api';
import { AuthFlow } from './screens/AuthFlow';
import { Home } from './screens/Home';
import { Edition } from './screens/Edition';
import { Join } from './screens/Join';

type View = { kind: 'home' } | { kind: 'edition'; editionId: string };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [joinToken, setJoinToken] = useState<string | null>(null);

  useEffect(() => {
    const m = /^\/join\/([^/]+)/.exec(window.location.pathname);
    if (m) setJoinToken(decodeURIComponent(m[1]));
    void (async () => {
      try { setMeta(await api.meta()); } catch { /* best effort */ }
      try { setUser((await api.me()).user); } catch { /* signed out */ }
      setLoading(false);
    })();
  }, []);

  function openEdition(editionId: string) {
    setJoinToken(null);
    if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
    setView({ kind: 'edition', editionId });
  }

  const showProfileComplete = user && user.profileComplete;

  return (
    <div className="shell">
      {(loading || !joinToken) && view.kind === 'home' && (
        <header className="center" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 40 }}>{meta?.instanceName ?? 'Santa'}</h1>
        </header>
      )}

      {loading && <p className="muted center">Loading…</p>}

      {!loading && joinToken && (
        <Join
          token={joinToken}
          authed={!!showProfileComplete}
          onNeedsAuth={() => { /* the AuthFlow below handles sign-in */ }}
          onJoined={openEdition}
        />
      )}

      {!loading && joinToken && !showProfileComplete && (
        <div style={{ marginTop: 16 }}>
          <AuthFlow meta={meta} initialUser={user} onAuthed={(u) => setUser(u)} />
        </div>
      )}

      {!loading && !joinToken && !showProfileComplete && (
        <AuthFlow meta={meta} initialUser={user} onAuthed={setUser} />
      )}

      {!loading && !joinToken && showProfileComplete && view.kind === 'home' && (
        <Home
          meta={meta}
          onOpenEdition={openEdition}
          onSignOut={async () => { await api.signOut(); setUser(null); }}
        />
      )}

      {!loading && !joinToken && showProfileComplete && view.kind === 'edition' && (
        <Edition editionId={view.editionId} meta={meta} onBack={() => setView({ kind: 'home' })} />
      )}
    </div>
  );
}
