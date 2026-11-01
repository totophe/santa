import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, ApiError, type GroupDetail, type GroupVisibility, type JoinRequest, type PublicMeta } from '../api';
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

  const load = useCallback(async () => setGroup(await api.group(groupId)), [groupId]);
  useEffect(() => { void load(); }, [load]);

  if (!group) return <p className="muted center">{t('web.loading')}</p>;

  const isAdmin = group.role === 'admin';
  const hasLive = group.editions.some((e) => e.state !== 'archived');

  return (
    <div className="stack">
      <h1 style={{ fontSize: 34 }}>{group.name}</h1>

      {isAdmin && <JoinRequests group={group} reload={load} />}
      {isAdmin && group.inviteUrl && <GroupInviteCard group={group} reload={load} />}

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

      {isAdmin && !hasLive && <NewEditionForm groupId={groupId} meta={meta} members={group.members} onCreated={onOpenEdition} />}

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

type Member = { userId: string; firstName: string | null; isYou: boolean };

function NewEditionForm({ groupId, meta, members, onCreated }: { groupId: string; meta: PublicMeta | null; members: Member[]; onCreated: (editionId: string) => void }) {
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

  // Wizard: who takes part, and who must not draw each other.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [exclusions, setExclusions] = useState<Array<[string, string]>>([]);
  const [feasible, setFeasible] = useState<{ feasible: boolean; reason?: string } | null>(null);

  const nameOf = (uid: string) => {
    const m = members.find((x) => x.userId === uid);
    return (m?.firstName ?? '…') + (m?.isYou ? ` (${t('people.you')})` : '');
  };
  const selectedIds = members.map((m) => m.userId).filter((id) => selected.has(id));

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
    // Drop exclusions that reference a now-deselected member.
    setExclusions((prev) => prev.filter(([a, b]) => a !== uid && b !== uid));
  }

  // Live feasibility whenever the set or restrictions change.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const body = { participantUserIds: selectedIds, exclusions: exclusions.map(([a, b]) => ({ a, b })) };
    void api.drawFeasibility(groupId, body).then((r) => { if (!cancelled) setFeasible(r); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, exclusions]);

  if (!open) {
    return (
      <div className="card stack">
        <h2 style={{ fontSize: 22 }}>{t('group.new_edition')}</h2>
        <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>{t('group.new_edition_hint')}</p>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>{t('group.new_edition')}</button>
      </div>
    );
  }

  function pickTheme(tn: string) {
    setTheme(tn);
    setName(editionNameFor(meta, tn, year));
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
        participantUserIds: selectedIds,
        exclusions: exclusions.map(([a, b]) => ({ a, b })),
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

      {/* Who takes part */}
      <div className="field">
        <label>{t('wizard.who_takes_part')}</label>
        <div className="stack" style={{ gap: 6 }}>
          {members.map((m) => (
            <label key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
              <input type="checkbox" checked={selected.has(m.userId)} onChange={() => toggle(m.userId)} />
              <span>{nameOf(m.userId)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Exclusion pairs */}
      <div className="field">
        <label>{t('wizard.restrictions')}</label>
        <p className="muted" style={{ marginTop: -2, marginBottom: 6, fontSize: 13 }}>{t('wizard.restrictions_hint')}</p>
        {exclusions.map(([a, b], i) => (
          <div key={`${a}-${b}`} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 14 }}>{nameOf(a)} ⟷ {nameOf(b)}</span>
            <button type="button" className="btn btn-ghost" style={{ width: 'auto', minHeight: 32, padding: '0 8px' }}
              onClick={() => setExclusions((prev) => prev.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <ExclusionPicker
          members={members.filter((m) => selected.has(m.userId))}
          existing={exclusions}
          onAdd={(a, b) => setExclusions((prev) => [...prev, [a, b]])}
        />
      </div>

      {feasible && !feasible.feasible && (
        <p className="error">
          {feasible.reason === 'too_few' ? t('wizard.infeasible_too_few') : t('wizard.infeasible_restrictions')}
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? t('create.creating') : t('group.new_edition')}</button>
      <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>{t('action.cancel')}</button>
    </form>
  );
}

/** Two dropdowns + Add, to append a symmetric exclusion pair from selected members. */
function ExclusionPicker({ members, existing, onAdd }: { members: Member[]; existing: Array<[string, string]>; onAdd: (a: string, b: string) => void }) {
  const { t } = useI18n();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  if (members.length < 2) return null;

  const has = (x: string, y: string) =>
    existing.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  const canAdd = a && b && a !== b && !has(a, b);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select value={a} onChange={(e) => setA(e.target.value)} style={selectStyle}>
        <option value="">{t('wizard.pick_person')}</option>
        {members.map((m) => <option key={m.userId} value={m.userId}>{m.firstName ?? '…'}</option>)}
      </select>
      <span className="muted">⟷</span>
      <select value={b} onChange={(e) => setB(e.target.value)} style={selectStyle}>
        <option value="">{t('wizard.pick_person')}</option>
        {members.map((m) => <option key={m.userId} value={m.userId}>{m.firstName ?? '…'}</option>)}
      </select>
      <button type="button" className="btn btn-soft" style={{ width: 'auto', minHeight: 40, padding: '0 12px' }}
        disabled={!canAdd} onClick={() => { onAdd(a, b); setA(''); setB(''); }}>{t('wizard.add_restriction')}</button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, minHeight: 40, borderRadius: 10, border: '1px solid var(--line)',
  padding: '0 10px', fontSize: 14, background: 'var(--bg)', color: 'var(--text)',
};

function JoinRequests({ group, reload }: { group: GroupDetail; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setRequests((await api.groupRequests(group.id)).requests), [group.id]);
  useEffect(() => { void load(); }, [load]);

  if (!requests || requests.length === 0) return null;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); await reload(); } finally { setBusy(false); }
  }

  return (
    <div className="card stack">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('group.requests_title')}</div>
      {requests.map((r) => (
        <div key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{[r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || '…'}</span>
            {r.email && <span className="muted" style={{ display: 'block', fontSize: 12, wordBreak: 'break-all' }}>{r.email}</span>}
          </span>
          <button className="btn btn-primary" style={{ width: 'auto', minHeight: 38, padding: '0 14px' }} disabled={busy} onClick={() => act(() => api.approveRequest(group.id, r.userId))}>{t('group.approve')}</button>
          <button className="btn btn-ghost" style={{ width: 'auto', minHeight: 38, padding: '0 10px', color: 'var(--danger)' }} disabled={busy} onClick={() => act(() => api.rejectRequest(group.id, r.userId))}>{t('group.reject')}</button>
        </div>
      ))}
    </div>
  );
}

function GroupInviteCard({ group, reload }: { group: GroupDetail; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const url = group.inviteUrl ?? '';
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function setVisibility(v: GroupVisibility) {
    if (v === group.visibility) return;
    setBusy(true);
    try { await api.saveGroupSettings(group.id, { visibility: v }); await reload(); } finally { setBusy(false); }
  }

  return (
    <div className="card stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>🎟️</span>
        <h2 style={{ fontSize: 22, flex: 1 }}>{t('group.invite_title')}</h2>
      </div>

      {/* Visibility: private needs approval, semi-public joins immediately. */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['private', 'semi_public'] as const).map((v) => (
          <button key={v} type="button" disabled={busy} onClick={() => setVisibility(v)}
            className={group.visibility === v ? 'btn btn-primary' : 'btn btn-soft'} style={{ flex: 1, minHeight: 44, fontSize: 14 }}>
            {t('group.visibility_' + v)}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: -4, fontSize: 13 }}>{t('group.visibility_' + group.visibility + '_hint')}</p>

      <div style={{ alignSelf: 'center', background: '#fff', padding: 14, borderRadius: 14 }}>
        <QRCodeSVG value={url} size={168} level="M" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {canShare && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { void navigator.share({ title: group.name, url }).catch(() => {}); }}>
            {t('edition.share')}
          </button>
        )}
        <button className="btn btn-soft" style={{ flex: 1 }}
          onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? t('edition.invite_copied') : t('edition.invite_copy')}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>{url}</div>
    </div>
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
