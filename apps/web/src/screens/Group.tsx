import { useEffect, useState } from 'react';
import { api, type GroupDetail } from '../api';
import { useI18n } from '../i18n';

export function Group({
  groupId,
  onOpenEdition,
  onBack,
}: {
  groupId: string;
  onOpenEdition: (editionId: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [group, setGroup] = useState<GroupDetail | null>(null);

  useEffect(() => {
    void api.group(groupId).then(setGroup);
  }, [groupId]);

  if (!group) return <p className="muted center">{t('web.loading')}</p>;

  return (
    <div className="stack">
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>{t('web.back_home')}</button>
      <h1 style={{ fontSize: 34 }}>{group.name}</h1>

      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('group.editions')}</div>
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

      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('group.members')}</div>
        {group.members.map((m) => (
          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{(m.firstName ?? '…')}{m.isYou ? ` (${t('people.you')})` : ''}</span>
            {m.role === 'admin' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{t('people.admin')}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
