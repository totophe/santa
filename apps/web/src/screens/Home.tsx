import { useEffect, useState } from 'react';
import { api, ApiError, type GroupSummary, type PublicMeta } from '../api';

export function Home({
  meta,
  onOpenEdition,
  onSignOut,
}: {
  meta: PublicMeta | null;
  onOpenEdition: (editionId: string) => void;
  onSignOut: () => void;
}) {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const { groups } = await api.listGroups();
    setGroups(groups);
  }
  useEffect(() => {
    void load();
  }, []);

  if (creating)
    return <CreateGroup meta={meta} onCreated={onOpenEdition} onCancel={() => setCreating(false)} />;

  if (!groups) return <p className="muted center">Loading…</p>;

  return (
    <div className="stack">
      {groups.length === 0 && (
        <div className="card stack center">
          <h2 style={{ fontSize: 24 }}>No group yet</h2>
          <p className="muted">You need an invite link to join a group, or create your own.</p>
        </div>
      )}
      {groups.map((g) => (
        <button
          key={g.id}
          className="card"
          style={{ textAlign: 'left', cursor: g.currentEdition ? 'pointer' : 'default', border: '1px solid var(--line)' }}
          onClick={() => g.currentEdition && onOpenEdition(g.currentEdition.id)}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{g.name}</div>
          {g.currentEdition ? (
            <>
              <div style={{ fontFamily: 'Chewy, cursive', fontSize: 28, color: 'var(--primary)' }}>{g.currentEdition.name}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                {g.currentEdition.daysToGo != null && g.currentEdition.daysToGo >= 0 ? `${g.currentEdition.daysToGo} days to go · ` : ''}
                {nextStep(g)}
              </div>
            </>
          ) : (
            <div className="muted" style={{ marginTop: 6 }}>No current edition.</div>
          )}
        </button>
      ))}

      {meta?.groupCreationOpen && (
        <button className="btn btn-primary" onClick={() => setCreating(true)}>Create a Secret Santa</button>
      )}
      <div className="spacer" />
      <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
    </div>
  );
}

function nextStep(g: GroupSummary): string {
  const e = g.currentEdition!;
  if (e.myStatus === 'invited') return 'Confirm you’re in';
  if (e.state === 'open') return 'Open';
  if (e.state === 'drawn') return 'Check your draw';
  return 'Archived';
}

function CreateGroup({ meta, onCreated, onCancel }: { meta: PublicMeta | null; onCreated: (editionId: string) => void; onCancel: () => void }) {
  const year = new Date().getFullYear();
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('santa');
  const [editionName, setEditionName] = useState(`Christmas ${year}`);
  const [exchangeDate, setExchangeDate] = useState(`${year}-12-24`);
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTheme(t: string) {
    setTheme(t);
    const tmpl = meta?.themes.find((x) => x.name === t)?.defaultEditionNamePattern ?? 'Gift exchange {year}';
    setEditionName(tmpl.replace('{year}', String(year)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.createGroup({
        name: name.trim(),
        edition: {
          name: editionName.trim(),
          theme,
          exchangeDate,
          ...(budget ? { budgetAmount: budget, budgetCurrency: 'EUR' } : {}),
        },
      });
      onCreated(res.edition.id);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'Group creation isn’t open on this instance.' : 'Please check the form and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 24 }}>Create a Secret Santa</h2>
      <div className="field">
        <label>Group name</label>
        <input type="text" required maxLength={60} placeholder="Famille Cuvelier" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Theme</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(meta?.themes ?? []).map((t) => (
            <button type="button" key={t.name} onClick={() => pickTheme(t.name)}
              className={theme === t.name ? 'btn btn-primary' : 'btn btn-soft'} style={{ flex: 1 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Edition name</label>
        <input type="text" required maxLength={40} value={editionName} onChange={(e) => setEditionName(e.target.value)} />
      </div>
      <div className="field">
        <label>Exchange date</label>
        <input type="text" value={exchangeDate} onChange={(e) => setExchangeDate(e.target.value)} placeholder="YYYY-MM-DD" />
      </div>
      <div className="field">
        <label>Budget (optional, €)</label>
        <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="25" />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Creating…' : 'Create'}</button>
      <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}
