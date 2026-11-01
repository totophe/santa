import { useEffect, useState } from 'react';
import { api, type GroupVisibility } from '../api';
import { useI18n } from '../i18n';

export function Join({
  token,
  authed,
  onNeedsAuth,
  onJoined,
  onHome,
}: {
  token: string;
  authed: boolean;
  onNeedsAuth: () => void;
  onJoined: (groupId: string) => void;
  onHome: () => void;
}) {
  const { t } = useI18n();
  const [info, setInfo] = useState<{ state: string; groupName?: string; visibility?: GroupVisibility } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.joinInfo(token).then(setInfo);
  }, [token]);

  if (!info) return <p className="muted center">{t('web.loading')}</p>;
  if (info.state !== 'open')
    return (
      <div className="card center">
        <h2 style={{ fontSize: 22 }}>{t('join.unavailable_title')}</h2>
        <p className="muted">{t('join.revoked')}</p>
      </div>
    );

  if (pending)
    return (
      <div className="card center stack">
        <h2 style={{ fontSize: 22 }}>{t('join.pending_title')}</h2>
        <p className="muted">{t('join.pending_body', { group: info.groupName ?? '' })}</p>
        <button className="btn btn-soft" onClick={onHome}>{t('nav.home')}</button>
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
      const res = await api.join(token);
      if (res.state === 'pending') setPending(true);
      else onJoined(res.groupId);
    } catch {
      setError(t('create.error'));
    } finally {
      setBusy(false);
    }
  }

  const semiPublic = info.visibility === 'semi_public';
  return (
    <div className="card center stack">
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('join.group_label')}</div>
      <h1 style={{ fontSize: 32 }}>{info.groupName}</h1>
      <p className="muted">{semiPublic ? t('join.invited_body') : t('join.invited_body_private')}</p>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={join}>
        {!authed ? t('join.signin_to_join') : semiPublic ? t('action.join') : t('join.request_to_join')}
      </button>
    </div>
  );
}
