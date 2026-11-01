import { useEffect, useState } from 'react';
import { api, ApiError, type InstanceOverview, type InstanceUser } from '../api';
import { useI18n } from '../i18n';

type AdminTab = 'groups' | 'editions' | 'users';

/**
 * Read-only instance overview for an instance admin. Draw assignments are never
 * fetched or shown here — the API only exposes counts/metadata (invariant #1).
 */
export function Admin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<AdminTab>('groups');
  const [overview, setOverview] = useState<InstanceOverview | null>(null);
  const [users, setUsers] = useState<InstanceUser[] | null>(null);

  async function loadOverview() {
    setOverview(await api.instanceOverview());
  }
  useEffect(() => { void loadOverview(); }, []);
  useEffect(() => { if (tab === 'users' && !users) void api.instanceUsers().then((r) => setUsers(r.users)); }, [tab, users]);

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

  async function deleteGroup(id: string, name: string) {
    if (!window.confirm(t('admin.delete_confirm', { name }))) return;
    try {
      await api.instanceDeleteGroup(id);
      await loadOverview();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      window.alert(t(code === 'group_has_drawn_edition' ? 'group.delete_err_drawn' : 'error.generic'));
    }
  }

  if (!overview) return <p className="muted center">{t('web.loading')}</p>;

  const tabs: Array<[AdminTab, string]> = [['groups', t('admin.tab_groups')], ['editions', t('admin.tab_editions')], ['users', t('admin.tab_users')]];

  return (
    <div className="stack">
      <h1 style={{ fontSize: 34 }}>{t('admin.title')}</h1>
      <div className="card" style={{ background: 'var(--soft)' }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>🔒 {t('admin.secrecy_note')}</p>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <Total n={overview.totals.accounts} label={t('admin.accounts')} />
        <Total n={overview.totals.groups} label={t('admin.groups')} />
        <Total n={overview.totals.editions} label={t('admin.editions')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className="btn" style={{ minHeight: 42, fontSize: 13, background: tab === key ? 'var(--soft)' : 'transparent', color: tab === key ? 'var(--primary)' : 'var(--muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'groups' && overview.groups.map((g) => (
        <div key={g.id} className="card stack">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 18 }}>{g.name}</span>
            <span className="muted" style={{ fontSize: 12 }}>{t('admin.member_edition_counts', { members: g.memberCount, editions: g.editionCount })}</span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{g.creatorEmail ?? '—'} · {fmtDate(g.createdAt)}</div>
          {g.editions.some((e) => e.drawn)
            ? <p className="muted" style={{ fontSize: 12 }}>{t('group.delete_blocked_drawn')}</p>
            : <button className="btn btn-ghost" style={{ color: 'var(--danger)', minHeight: 38 }} onClick={() => deleteGroup(g.id, g.name)}>{t('group.delete')}</button>}
        </div>
      ))}

      {tab === 'editions' && (
        <div className="card stack">
          {overview.groups.flatMap((g) => g.editions.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{e.name}</span>
                <span className="muted" style={{ fontSize: 12 }}> · {g.name}</span>
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{t('admin.participants_n', { n: e.participants })}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--soft)', color: 'var(--muted)' }}>{t('state.' + e.state)}</span>
            </div>
          )))}
        </div>
      )}

      {tab === 'users' && (
        users == null ? <p className="muted center">{t('web.loading')}</p> : (
          <div className="card stack">
            {users.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</span>
                  <span className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}> · {u.email}</span>
                </span>
                <span className="muted" style={{ fontSize: 12 }}>{t('admin.groups_n', { n: u.groupCount })}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Total({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'Chewy, cursive', fontSize: 30, color: 'var(--primary)' }}>{n}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
