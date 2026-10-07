import { useI18n } from '../i18n';
import type { PublicMeta } from '../api';

export const REPO_URL = 'https://github.com/totophe/santa';

export function About({ meta, onClose }: { meta: PublicMeta | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
        <h2 style={{ fontSize: 28 }}>{meta?.instanceName ?? 'Santa'}</h2>
        <p className="muted" style={{ marginTop: -6 }}>{t('about.body')}</p>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          {t('about.source')}
        </a>
        <p className="muted center" style={{ fontSize: 13 }}>{t('about.license')}</p>
        <button className="btn btn-ghost" onClick={onClose}>{t('action.cancel')}</button>
      </div>
    </div>
  );
}
