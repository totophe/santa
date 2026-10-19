import { useEffect, useState } from 'react';
import { api, type PublicMeta, type SessionUser } from './api';
import { useI18n } from './i18n';
import { TopBar } from './components/TopBar';
import { UpdateBanner } from './components/UpdateBanner';
import { About } from './components/About';
import { BottomNav, type EdTab, type NavKind } from './components/BottomNav';
import { AuthFlow } from './screens/AuthFlow';
import { Home } from './screens/Home';
import { Edition } from './screens/Edition';
import { Group } from './screens/Group';
import { Admin } from './screens/Admin';
import { Join } from './screens/Join';
import { Account } from './screens/Account';

type View =
  | { kind: 'home' }
  | { kind: 'edition'; editionId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'account' }
  | { kind: 'admin' };

export default function App() {
  const { setLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<View>({ kind: 'home' });
  // Edition section is owned here so the global bottom bar can drive it.
  // null means "not chosen yet" — the Edition picks a state-aware default on load.
  const [edTab, setEdTab] = useState<EdTab | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

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
    setEdTab(null); // reset so the edition re-picks its default section
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
  const showChrome = !loading && !joinToken && authed;

  return (
    <div className="shell">
      <UpdateBanner />
      {!loading && (
        <TopBar
          meta={meta}
          user={user}
          onHome={goHome}
          onAccount={() => setView({ kind: 'account' })}
          onSignOut={signOut}
          onAbout={() => setShowAbout(true)}
          onUserUpdated={setUser}
        />
      )}

      {showAbout && <About meta={meta} onClose={() => setShowAbout(false)} />}

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

      {showChrome && view.kind === 'home' && (
        <Home meta={meta} onOpenEdition={openEdition} onOpenGroup={(groupId) => setView({ kind: 'group', groupId })} />
      )}

      {showChrome && view.kind === 'account' && user && (
        <Account user={user} meta={meta} onUpdated={setUser} onSignedOut={signOut} />
      )}

      {showChrome && view.kind === 'admin' && user?.isInstanceAdmin && <Admin />}

      {showChrome && view.kind === 'edition' && (
        <Edition
          editionId={view.editionId}
          meta={meta}
          tab={edTab}
          onTab={setEdTab}
          onOpenGroup={(groupId) => setView({ kind: 'group', groupId })}
        />
      )}

      {showChrome && view.kind === 'group' && (
        <Group groupId={view.groupId} meta={meta} onOpenEdition={openEdition} onLeft={goHome} />
      )}

      {showChrome && (
        <BottomNav
          kind={view.kind as NavKind}
          user={user}
          editionTab={edTab ?? 'people'}
          onHome={goHome}
          onAccount={() => setView({ kind: 'account' })}
          onAdmin={() => setView({ kind: 'admin' })}
          onEditionTab={setEdTab}
        />
      )}
    </div>
  );
}
