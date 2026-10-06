import { useCallback, useEffect, useState } from 'react';
import { api, type EditionDetail, type MyWishlist, type ParticipantRow, type PublicMeta } from '../api';
import { HoldToReveal } from '../components/HoldToReveal';
import { applyTheme } from '../theme';
import { useI18n } from '../i18n';

type Tab = 'home' | 'wishlists' | 'chat';

/** Locale-aware currency (thousands separators + symbol), falling back gracefully. */
function fmtBudget(amount: string, currency: string | null, lang: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: currency || 'EUR' }).format(n);
  } catch {
    return `${new Intl.NumberFormat(lang).format(n)} ${currency ?? ''}`.trim();
  }
}

export function Edition({ editionId, meta, onBack, onOpenGroup }: { editionId: string; meta: PublicMeta | null; onBack: () => void; onOpenGroup: (groupId: string) => void }) {
  const { t, lang } = useI18n();
  const [detail, setDetail] = useState<EditionDetail | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [showAdmin, setShowAdmin] = useState(false);

  const load = useCallback(async () => {
    const d = await api.edition(editionId);
    setDetail(d);
    applyTheme(meta, d.theme);
  }, [editionId, meta]);
  useEffect(() => {
    void load();
    return () => applyTheme(meta, null);
  }, [load, meta]);

  function goTab(tb: Tab) {
    setShowAdmin(false);
    setTab(tb);
  }

  if (!detail) return <p className="muted center">{t('web.loading')}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>{t('web.back_home')}</button>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={() => onOpenGroup(detail.groupId)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {detail.groupName} ›
          </button>
          <h1 style={{ fontSize: 34 }}>{detail.name}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {detail.daysToGo != null && detail.daysToGo >= 0 && <Chip>{detail.daysToGo === 0 ? t('edition.today') : t('edition.days_to_go', { days: detail.daysToGo })}</Chip>}
            {detail.budgetAmount && <Chip>{t('edition.budget', { amount: fmtBudget(detail.budgetAmount, detail.budgetCurrency, lang) })}</Chip>}
          </div>
        </div>
        {detail.isAdmin && (
          <button aria-label={t('action.settings')} onClick={() => setShowAdmin((s) => !s)} className="btn btn-soft" style={{ width: 'auto', minHeight: 44, padding: '0 12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      <div style={{ flex: 1 }}>
        {showAdmin ? (
          <AdminPanel detail={detail} reload={load} />
        ) : (
          <>
            {tab === 'home' && <HomeTab detail={detail} reload={load} goChat={() => goTab('chat')} />}
            {tab === 'wishlists' && <WishlistsTab editionId={editionId} />}
            {tab === 'chat' && <ChatTab editionId={editionId} />}
          </>
        )}
      </div>

      <TabBar tab={showAdmin ? null : tab} setTab={goTab} />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--soft)', fontSize: 13, fontWeight: 700 }}>{children}</span>;
}

function InviteCard({ url, groupName }: { url: string; groupName: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="card stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>🎟️</span>
        <h2 style={{ fontSize: 22, flex: 1 }}>{t('edition.invite_people')}</h2>
      </div>
      <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>{t('edition.invite_hint')}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {canShare && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { void navigator.share({ title: groupName, url }).catch(() => {}); }}>
            {t('edition.share')}
          </button>
        )}
        <button
          className="btn btn-soft"
          style={{ flex: 1 }}
          onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        >
          {copied ? t('edition.invite_copied') : t('edition.invite_copy')}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>{url}</div>
    </div>
  );
}

function HomeTab({ detail, reload, goChat }: { detail: EditionDetail; reload: () => Promise<void>; goChat: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Awaited<ReturnType<typeof api.drawCard>> | null>(null);

  useEffect(() => {
    if (detail.state !== 'open') void api.drawCard(detail.id).then(setCard);
  }, [detail.id, detail.state]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await reload(); } finally { setBusy(false); }
  }

  const chatEntry = detail.chatOpen && (
    <button className="card" onClick={goChat} style={{ textAlign: 'left', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <span style={{ fontSize: 24 }}>💬</span>
      <span style={{ flex: 1, fontWeight: 700 }}>{t('edition.chat_open_entry')}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  );

  return (
    <div className="stack">
      {detail.isAdmin && detail.state === 'open' && detail.inviteUrl && (
        <InviteCard url={detail.inviteUrl} groupName={detail.groupName} />
      )}

      {detail.myStatus === 'invited' && (
        <div className="card stack">
          <h2 style={{ fontSize: 22 }}>{t('edition.in_this_year')}</h2>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.confirm(detail.id))}>{t('action.im_in')}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.decline(detail.id))}>{t('action.not_this_year')}</button>
        </div>
      )}

      {detail.state === 'open' && detail.myStatus === 'confirmed' && (
        <div className="card">
          <h2 style={{ fontSize: 22 }}>{t('edition.ready_title')}</h2>
          <p className="muted">{t('edition.ready_body', { confirmed: detail.counts.confirmed, total: detail.counts.participants })}</p>
        </div>
      )}

      {detail.state !== 'open' && card && card.state !== 'no_card' && (
        <div className="card stack">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('edition.your_draw')}</div>
          {card.changed && <div className="error">{t('draw.changed')}</div>}
          <HoldToReveal onReveal={async () => (await api.reveal(detail.id)).recipientFirstName} />
          {card.signedInAs && <div className="muted" style={{ fontSize: 13 }}>{t('draw.signed_in_as', { name: card.signedInAs })}</div>}
        </div>
      )}

      {/* Once the chat is open it leads; otherwise members are the heart of the page. */}
      {chatEntry}
      <Members editionId={detail.id} />
    </div>
  );
}

function Members({ editionId }: { editionId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<{ participants: ParticipantRow[]; summary: { confirmed: number; checked: number; total: number; drawn: boolean } } | null>(null);
  useEffect(() => { void api.participants(editionId).then(setData); }, [editionId]);
  if (!data) return <p className="muted center">{t('web.loading')}</p>;
  return (
    <div className="card stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('nav.people')}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {data.summary.drawn
            ? t('participants.summary_checked', { checked: data.summary.checked, total: data.summary.total })
            : t('participants.summary_confirmed', { confirmed: data.summary.confirmed, total: data.summary.total })}
        </div>
      </div>
      {data.participants.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{p.firstName}{p.lastInitial ? ` ${p.lastInitial}.` : ''}{p.isYou ? ` (${t('people.you')})` : ''}{p.isAdmin ? ` · ${t('people.admin')}` : ''}</span>
          <StatusChip status={p.status} />
          <span>{p.wishlistState === 'published' ? '🎁' : p.wishlistState === 'surprise' ? '✨' : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function AdminPanel({ detail, reload }: { detail: EditionDetail; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try { await fn(); if (done) setMsg(done); await reload(); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('edition.admin')}</div>
        {detail.state === 'open' && (
          <button className="btn btn-primary" disabled={busy || detail.counts.confirmed < 3 || detail.counts.confirmed !== detail.counts.participants}
            onClick={() => {
              if (!window.confirm(t('edition.draw_confirm', { n: detail.counts.participants }))) return;
              void act(async () => {
                const r = await api.runDraw(detail.id);
                setMsg(t('edition.drawn_for', { n: r.participants }) + (r.relaxed ? ' ' + t('draw.relaxed') : ''));
              });
            }}>
            {detail.counts.confirmed < 3 ? t('edition.run_draw_need3') : detail.counts.confirmed !== detail.counts.participants ? t('edition.run_draw_waiting') : t('edition.run_draw')}
          </button>
        )}
        {detail.state === 'drawn' && !detail.chatOpen && (
          <button className="btn btn-soft" disabled={busy} onClick={() => act(() => api.openChat(detail.id), t('account.saved'))}>{t('edition.open_chat_now')}</button>
        )}
        {msg && <p className="muted" style={{ fontSize: 14 }}>{msg}</p>}
      </div>
      <EditionSettings edition={detail} reload={reload} />
    </div>
  );
}

function EditionSettings({ edition, reload }: { edition: EditionDetail; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState(edition.name);
  const [exchangeDate, setExchangeDate] = useState(edition.exchangeDate ?? '');
  const [budget, setBudget] = useState(edition.budgetAmount ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const readOnly = edition.state === 'archived';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.saveEditionSettings(edition.id, {
        name: name.trim(),
        ...(exchangeDate ? { exchangeDate } : {}),
        ...(budget ? { budgetAmount: budget, budgetCurrency: edition.budgetCurrency ?? 'EUR' } : {}),
      });
      setMsg(t('account.saved'));
      await reload();
    } catch {
      setMsg(t('create.error'));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!window.confirm(t('settings.archive_confirm'))) return;
    setBusy(true);
    try { await api.archiveEditionReq(edition.id); await reload(); } finally { setBusy(false); }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('settings.title')}</div>
      <div className="field">
        <label>{t('create.edition_name')}</label>
        <input type="text" maxLength={40} required disabled={readOnly} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>{t('create.exchange_date')}</label>
        <input type="text" placeholder="YYYY-MM-DD" disabled={readOnly} value={exchangeDate} onChange={(e) => setExchangeDate(e.target.value)} />
      </div>
      <div className="field">
        <label>{t('create.budget')}</label>
        <input type="text" placeholder="25" disabled={readOnly} value={budget} onChange={(e) => setBudget(e.target.value)} />
      </div>
      {msg && <p className="muted" style={{ color: 'var(--success)' }}>{msg}</p>}
      {!readOnly && <button className="btn btn-primary" disabled={busy} type="submit">{t('action.save')}</button>}
      {!readOnly && <button className="btn btn-ghost" type="button" style={{ color: 'var(--danger)' }} disabled={busy} onClick={archive}>{t('action.archive')}</button>}
    </form>
  );
}

function WishlistsTab({ editionId }: { editionId: string }) {
  const { t } = useI18n();
  const [wl, setWl] = useState<MyWishlist | null>(null);
  const [text, setText] = useState('');
  const [others, setOthers] = useState<Array<{ participantId: string; firstName: string; isYou: boolean; icon: string }>>([]);

  const load = useCallback(async () => {
    setWl(await api.myWishlist(editionId));
    setOthers((await api.wishlists(editionId)).wishlists);
  }, [editionId]);
  useEffect(() => { void load(); }, [load]);

  if (!wl) return <p className="muted center">{t('web.loading')}</p>;
  const iconLabel = (icon: string) => icon === 'published' ? '🎁 ' + t('wishlist.published') : icon === 'surprise' ? '✨ ' + t('wishlist.surprise') : '— ' + t('wishlist.not_yet');

  return (
    <div className="stack">
      <div className="card stack">
        <div style={{ fontSize: 14, fontWeight: 700, color: wl.state === 'published' ? 'var(--success)' : 'var(--muted)' }}>
          {wl.state === 'published' ? t('wishlist.banner_published') : wl.state === 'surprise' ? t('wishlist.banner_surprise') : t('wishlist.banner_draft')}
        </div>
        {wl.state !== 'surprise' && (
          <>
            {wl.items.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                <div style={{ flex: 1 }}>{it.text}{it.price ? <span className="muted"> · {it.price}</span> : null}</div>
                <button className="btn btn-ghost" style={{ width: 'auto', minHeight: 32, padding: '0 8px' }} onClick={async () => setWl(await api.deleteItem(it.id))}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder={t('wishlist.add_item')} value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-soft" style={{ width: 'auto' }} disabled={!text.trim()}
                onClick={async () => { setWl(await api.addItem(editionId, { text: text.trim() })); setText(''); }}>{t('wishlist.add')}</button>
            </div>
            {wl.state !== 'published' && <button className="btn btn-primary" disabled={wl.items.length === 0} onClick={async () => setWl(await api.publishWishlist(editionId))}>{t('wishlist.publish')}</button>}
            <button className="btn btn-ghost" onClick={async () => setWl(await api.surprise(editionId))}>{t('wishlist.switch_surprise')}</button>
          </>
        )}
        {wl.state === 'surprise' && <button className="btn btn-ghost" onClick={async () => setWl(await api.unsurprise(editionId))}>{t('wishlist.write_instead')}</button>}
      </div>

      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('wishlist.everyone')}</div>
        {others.map((o) => (
          <div key={o.participantId} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{o.firstName}{o.isYou ? ` (${t('people.you')})` : ''}</span>
            <span className="muted">{iconLabel(o.icon)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatTab({ editionId }: { editionId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.chat>> | null>(null);
  const [text, setText] = useState('');

  const load = useCallback(async () => setData(await api.chat(editionId)), [editionId]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (!data) return <p className="muted center">{t('web.loading')}</p>;
  if (data.locked)
    return (
      <div className="card center stack">
        <h2 style={{ fontSize: 22 }}>{t('chat.locked_title')}</h2>
        <p className="muted">{t('chat.locked_body', { n: data.toCheck ?? 0 })}</p>
      </div>
    );

  return (
    <div className="stack">
      {data.myAlias && <div className="muted" style={{ fontSize: 13 }}>{t('chat.you_are', { alias: `${data.myAlias.emoji} ${data.myAlias.name}` })}</div>}
      <div className="card stack" style={{ maxHeight: '50vh', overflow: 'auto' }}>
        {(data.messages ?? []).map((m) =>
          m.system ? (
            <div key={m.id} className="muted center" style={{ fontSize: 13 }}>— {m.system.replace(/_/g, ' ')} —</div>
          ) : (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start', gap: 2 }}>
              <div style={{ display: 'inline-block', maxWidth: '85%', background: m.mine ? 'var(--primary)' : 'var(--soft)', color: m.mine ? 'var(--on-primary)' : 'var(--text)', padding: '8px 12px', borderRadius: 14 }}>
                {m.removed ? <em className="muted">{t('chat.removed')}</em> : m.body}
              </div>
              {/* sender's alias sits under the bubble */}
              {!m.removed && m.alias && <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 4px' }}>{m.alias.emoji} {m.alias.name}</div>}
            </div>
          ),
        )}
      </div>
      {data.canPost && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder={t('chat.message_placeholder')} value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} maxLength={1000} />
          <button className="btn btn-soft" style={{ width: 'auto' }} disabled={!text.trim()}
            onClick={async () => { await api.postChat(editionId, text.trim()); setText(''); await load(); }}>{t('chat.send')}</button>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: ParticipantRow['status'] }) {
  const { t } = useI18n();
  const map: Record<ParticipantRow['status'], [string, string]> = {
    invited: ['⏳', 'var(--muted)'],
    confirmed: ['✓', 'var(--success)'],
    draw_checked: ['👁', 'var(--primary)'],
  };
  const [icon, color] = map[status];
  return <span style={{ fontSize: 13, fontWeight: 700, color }}>{icon} {t('status.' + status)}</span>;
}

function TabBar({ tab, setTab }: { tab: Tab | null; setTab: (t: Tab) => void }) {
  const { t } = useI18n();
  const tabs: Array<[Tab, string]> = [['home', 'nav.home'], ['wishlists', 'nav.wishlists'], ['chat', 'nav.chat']];
  return (
    <div style={{ position: 'sticky', bottom: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 8, marginTop: 12 }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)} className="btn" style={{ minHeight: 44, background: tab === key ? 'var(--soft)' : 'transparent', color: tab === key ? 'var(--primary)' : 'var(--muted)', fontSize: 13 }}>
          {t(label)}
        </button>
      ))}
    </div>
  );
}
