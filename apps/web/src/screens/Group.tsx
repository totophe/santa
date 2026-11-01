import { useEffect, useState } from 'react';
import { api, ApiError, type GroupDetail, type PublicMeta } from '../api';
import { useI18n } from '../i18n';

export function Group({
  groupId,
  meta,
  onOpenEdition,
  onLeft,
}: {
  groupId: string;
  meta: PublicMeta | null;
  onOpenEdition: (editionId: string) => void;
  onLeft: () => void;
}) {
  const { t } = useI18n();
  const [group, setGroup] = useState<GroupDetail | null>(null);

  useEffect(() => {
    void api.group(groupId).then(setGroup);
  }, [groupId]);

  if (!group) return <p className="muted center">{t('web.loading')}</p>;

  const isAdmin = group.role === 'admin';
  const hasLive = group.editions.some((e) => e.state !== 'archived');

  return (
    <div className="stack">
      <h1 style={{ fontSize: 34 }}>{group.name}</h1>

      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('group.editions')}</div>
        {group.editions.length === 0 && <p className="muted" style={{ fontSize: 14 }}>{t('home.no_current_edition')}</p>}
        {group.editions.map((e) => {
          const open = e.state !== 'archived';
          return (
            <button
              key={e.id}
              onClick={() => open && onOpenEdition(e.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderBottom: '1px solid var(--line)', padding: '10px 0', cursor: open ? 'pointer' : 'default', textAlign: 'left', font: 'inherit', color: 'var(--text)' }}
            >
              <span style={{ flex: 1, fontWeight: 600 }}>{e.name}</span>
              {open && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{t('group.current')}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--soft)', color: 'var(--muted)' }}>{t('state.' + e.state)}</span>
              {open && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
              )}
            </button>
          );
        })}
      </div>

      {isAdmin && !hasLive && <NewEditionForm groupId={groupId} meta={meta} onCreated={onOpenEdition} />}

      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('group.members')}</div>
        {group.members.map((m) => (
          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{(m.firstName ?? '…')}{m.isYou ? ` (${t('people.you')})` : ''}</span>
            {m.role === 'admin' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{t('people.admin')}</span>}
          </div>
        ))}
      </div>

      <GroupActions group={group} isAdmin={isAdmin} onLeft={onLeft} />
    </div>
  );
}

function editionNameFor(meta: PublicMeta | null, themeName: string, year: number): string {
  const tmpl = meta?.themes.find((x) => x.name === themeName)?.defaultEditionNamePattern ?? 'Gift exchange {year}';
  return tmpl.replace('{year}', String(year));
}

function NewEditionForm({ groupId, meta, onCreated }: { groupId: string; meta: PublicMeta | null; onCreated: (editionId: string) => void }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const firstTheme = meta?.themes[0]?.name ?? 'generic';
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(firstTheme);
  const [name, setName] = useState(() => editionNameFor(meta, firstTheme, year));
  const [exchangeDate, setExchangeDate] = useState(`${year}-12-24`);
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTheme(tn: string) {
    setTheme(tn);
    setName(editionNameFor(meta, tn, year));
  }

  if (!open) {
    return (
      <div className="card stack">
        <h2 style={{ fontSize: 22 }}>{t('group.new_edition')}</h2>
        <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>{t('group.new_edition_hint')}</p>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>{t('group.new_edition')}</button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.createEdition(groupId, {
        name: name.trim(),
        theme,
        exchangeDate,
        ...(budget ? { budgetAmount: budget, budgetCurrency: 'EUR' } : {}),
      });
      onCreated(res.edition.id);
    } catch {
      setError(t('create.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ fontSize: 22 }}>{t('group.new_edition')}</h2>
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
        <input type="text" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
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
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? t('create.creating') : t('group.new_edition')}</button>
      <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>{t('action.cancel')}</button>
    </form>
  );
}

function GroupActions({ group, isAdmin, onLeft }: { group: GroupDetail; isAdmin: boolean; onLeft: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (!window.confirm(t('group.leave_confirm'))) return;
    setBusy(true);
    try {
      await api.leaveGroup(group.id);
      onLeft();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      const key =
        code === 'delete_instead' ? 'group.leave_err_delete_instead'
        : code === 'promote_another_admin_first' ? 'group.leave_err_last_admin'
        : code === 'active_draw' ? 'group.leave_err_active_draw'
        : 'error.generic';
      window.alert(t(key));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const typed = window.prompt(t('group.delete_confirm', { name: group.name }));
    if (typed == null) return;
    setBusy(true);
    try {
      await api.deleteGroup(group.id, typed);
      onLeft();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      window.alert(t(code === 'group_has_drawn_edition' ? 'group.delete_err_drawn' : 'error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('group.manage')}</div>
      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} disabled={busy} onClick={leave}>{t('group.leave')}</button>
      {isAdmin && (group.hasDrawnEdition
        ? <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{t('group.delete_blocked_drawn')}</p>
        : <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} disabled={busy} onClick={remove}>{t('group.delete')}</button>
      )}
    </div>
  );
}
