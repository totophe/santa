import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/** The hashed main bundle this app was loaded with (null in dev / no match). */
function currentBundle(): string | null {
  const re = /\/assets\/index-[^"']+\.js/;
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(re);
    if (m) return m[0];
  }
  return null;
}

/**
 * Installed/home-screen PWAs have no reload button, so they can sit on a stale
 * build. This polls index.html (on reopen, on focus, and every few minutes) and,
 * when the deployed bundle differs from the running one, offers a Reload.
 */
export function UpdateBanner() {
  const { t } = useI18n();
  const mine = useRef<string | null>(currentBundle());
  const [stale, setStale] = useState(false);

  const check = useCallback(async () => {
    if (!mine.current || stale) return; // dev mode, or already flagged
    try {
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const m = html.match(/\/assets\/index-[^"']+\.js/);
      if (m && m[0] !== mine.current) setStale(true);
    } catch {
      /* offline / transient — ignore */
    }
  }, [stale]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = setInterval(() => void check(), 120000); // every 2 min while open
    void check();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(timer);
    };
  }, [check]);

  if (!stale) return null;

  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--primary)',
        color: 'var(--on-primary)',
        padding: '10px 14px',
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t('update.available')}</span>
      <button
        className="btn"
        style={{ width: 'auto', minHeight: 40, padding: '0 16px', background: 'var(--on-primary)', color: 'var(--primary)' }}
        onClick={() => window.location.reload()}
      >
        {t('action.reload')}
      </button>
    </div>
  );
}
