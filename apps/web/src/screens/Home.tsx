import { useEffect, useState } from 'react';
import { api, type EditionSummary, type PublicMeta } from '../api';
import { useI18n } from '../i18n';

/** The app Home: your active editions across every group. */
export function Home({
  meta: _meta,
  onOpenEdition,
  onOpenGroups,
}: {
  meta: PublicMeta | null;
  onOpenEdition: (editionId: string) => void;
  onOpenGroups: () => void;
}) {
  const { t } = useI18n();
  const [editions, setEditions] = useState<EditionSummary[] | null>(null);

  useEffect(() => {
    void api.myEditions().then((r) => setEditions(r.editions));
  }, []);

  if (!editions) return <p className="muted center">{t('web.loading')}</p>;

  if (editions.length === 0) {
    return (
      <div className="card stack center">
        <img src="/illustrations/no-group.webp" alt="" style={{ width: 220, maxWidth: '75%', margin: '0 auto', display: 'block', borderRadius: 16 }} />
        <h2 style={{ fontSize: 24 }}>{t('home.none_title')}</h2>
        <p className="muted">{t('home.none_body')}</p>
        <button className="btn btn-primary" onClick={onOpenGroups}>{t('home.go_to_groups')}</button>
      </div>
    );
  }

  return (
    <div className="stack">
      {editions.map((e) => (
        <button
          key={e.id}
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)' }}
          onClick={() => onOpenEdition(e.id)}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{e.groupName}</div>
          <div style={{ fontFamily: 'Chewy, cursive', fontSize: 28, color: 'var(--primary)' }}>{e.name}</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            {e.daysToGo != null && e.daysToGo >= 0 ? `${t('home.days_to_go', { days: e.daysToGo })} · ` : ''}
            {nextStep(e, t)}
          </div>
        </button>
      ))}
    </div>
  );
}

function nextStep(e: EditionSummary, t: (k: string) => string): string {
  if (e.myStatus === 'invited') return t('home.next.confirm');
  if (e.state === 'open') return t('home.next.open');
  if (e.state === 'drawn') return t('home.next.check');
  return t('home.next.archived');
}
