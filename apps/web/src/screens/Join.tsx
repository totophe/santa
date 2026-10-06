import { useEffect, useState } from 'react';
import { api } from '../api';

export function Join({
  token,
  authed,
  onNeedsAuth,
  onJoined,
}: {
  token: string;
  authed: boolean;
  onNeedsAuth: () => void;
  onJoined: (editionId: string) => void;
}) {
  const [info, setInfo] = useState<{ state: string; groupName?: string; editionName?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.joinInfo(token).then(setInfo);
  }, [token]);

  if (!info) return <p className="muted center">Loading…</p>;
  if (info.state !== 'open')
    return (
      <div className="card center">
        <h2 style={{ fontSize: 22 }}>This invite isn’t available</h2>
        <p className="muted">{info.state === 'closed' ? 'Entries are closed — the draw has run.' : 'This link is no longer valid.'}</p>
      </div>
    );

  async function join() {
    if (!authed) {
      onNeedsAuth();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { editionId } = await api.join(token);
      onJoined(editionId);
    } catch {
      setError('Could not join — the group may be full or the link revoked.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card center stack">
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{info.groupName}</div>
      <h1 style={{ fontSize: 32 }}>{info.editionName}</h1>
      <p className="muted">You’ve been invited to join this gift exchange.</p>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={join}>{authed ? 'Join' : 'Sign in to join'}</button>
    </div>
  );
}
