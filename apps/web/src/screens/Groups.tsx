import { useEffect, useState } from 'react';
import { api, ApiError, type GroupSummary, type PublicMeta } from '../api';
import { useI18n } from '../i18n';

/** The groups you belong to; enter one to see members, editions, and manage it. */
export function Groups({
  meta,
  onOpenGroup,
  onOpenEdition,
}: {
  meta: PublicMeta | null;
  onOpenGroup: (groupId: string) => void;
  onOpenEdition: (editionId: string) => void;
}) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void api.listGroups().then((r) => setGroups(r.groups));
  }, []);

  if (creating) return <CreateGroup meta={meta} onCreated={onOpenEdition} onCancel={() => setCreating(false)} />;
  if (!groups) return <p className="muted center">{t('web.loading')}</p>;

  return (
    <div className="stack">
      <h1 style={{ fontSize: 34 }}>{t('groups.title')}</h1>

      {groups.length === 0 && (
        <div className="card stack center">
          <h2 style={{ fontSize: 22 }}>{t('home.no_group_title')}</h2>
          <p className="muted">{t('home.no_group_body')}</p>
        </div>
      )}

      {groups.map((g) => (
        <button
          key={g.id}
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}
          onClick={() => onOpenGroup(g.id)}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'Chewy, cursive', fontSize: 24, color: 'var(--primary)' }}>{g.name}</span>
            <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
              {t('groups.member_count', { n: g.memberCount })}
              {g.role === 'admin' ? ` · ${t('people.admin')}` : ''}
            </span>
          </span>
          {g.pendingCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-primary)', background: 'var(--primary)', borderRadius: 999, padding: '2px 9px' }}>
              {t('groups.pending_badge', { n: g.pendingCount })}
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      ))}

      {meta?.groupCreationOpen && (
        <button className="btn btn-primary" onClick={() => setCreating(true)}>{t('action.create_group')}</button>
      )}
    </div>
  );
}

function CreateGroup({ meta, onCreated, onCancel }: { meta: PublicMeta | null; onCreated: (editionId: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('santa');
  const [editionName, setEditionName] = useState(`Christmas ${year}`);
  const [exchangeDate, setExchangeDate] = useState(`${year}-12-24`);
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTheme(tn: string) {
    setTheme(tn);
    const tmpl = meta?.themes.find((x) => x.name === tn)?.defaultEditionNamePattern ?? 'Gift exchange {year}';
    setEditionName(tmpl.replace('{year}', String(year)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.createGroup({
        name: name.trim(),
        edition: { name: editionName.trim(), theme, exchangeDate, ...(budget ? { budgetAmount: budget, budgetCurrency: 'EUR' } : {}) },
      });
      onCreated(res.edition.id);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t('create.closed') : t('create.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 24 }}>{t('create.title')}</h2>
      <div className="field">
        <label>{t('create.group_name')}</label>
        <input type="text" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>{t('create.theme')}</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(meta?.themes ?? []).map((th) => (
            <button type="button" key={th.name} onClick={() => pickTheme(th.name)} className={theme === th.name ? 'btn btn-primary' : 'btn btn-soft'} style={{ flex: 1 }}>
              {th.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t('create.edition_name')}</label>
        <input type="text" required maxLength={40} value={editionName} onChange={(e) => setEditionName(e.target.value)} />
      </div>
      <div className="field">
        <label>{t('create.exchange_date')}</label>
        <input type="text" value={exchangeDate} onChange={(e) => setExchangeDate(e.target.value)} placeholder="YYYY-MM-DD" />
      </div>
      <div className="field">
        <label>{t('create.budget')}</label>
        <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="25" />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? t('create.creating') : t('action.create_group')}</button>
      <button className="btn btn-ghost" type="button" onClick={onCancel}>{t('action.cancel')}</button>
    </form>
  );
}
