import { useCallback, useEffect, useState } from 'react';
import { api, type EditionDetail, type MyWishlist, type ParticipantRow, type PublicMeta } from '../api';
import { HoldToReveal } from '../components/HoldToReveal';
import { applyTheme } from '../theme';

type Tab = 'home' | 'wishlists' | 'chat' | 'people';

export function Edition({ editionId, meta, onBack }: { editionId: string; meta: PublicMeta | null; onBack: () => void }) {
  const [detail, setDetail] = useState<EditionDetail | null>(null);
  const [tab, setTab] = useState<Tab>('home');

  const load = useCallback(async () => {
    const d = await api.edition(editionId);
    setDetail(d);
    applyTheme(meta, d.theme);
  }, [editionId, meta]);
  useEffect(() => {
    void load();
    return () => applyTheme(meta, null);
  }, [load, meta]);

  if (!detail) return <p className="muted center">Loading…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Home</button>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{detail.groupName}</div>
        <h1 style={{ fontSize: 34 }}>{detail.name}</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {detail.daysToGo != null && detail.daysToGo >= 0 && <Chip>{detail.daysToGo === 0 ? 'Today’s the day!' : `${detail.daysToGo} days to go`}</Chip>}
          {detail.budgetAmount && <Chip>Budget {detail.budgetAmount} {detail.budgetCurrency ?? ''}</Chip>}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {tab === 'home' && <HomeTab detail={detail} reload={load} />}
        {tab === 'wishlists' && <WishlistsTab editionId={editionId} />}
        {tab === 'chat' && <ChatTab editionId={editionId} />}
        {tab === 'people' && <PeopleTab editionId={editionId} />}
      </div>

      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--soft)', fontSize: 13, fontWeight: 700 }}>{children}</span>;
}

function HomeTab({ detail, reload }: { detail: EditionDetail; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Awaited<ReturnType<typeof api.drawCard>> | null>(null);
  const [drawMsg, setDrawMsg] = useState<string | null>(null);

  useEffect(() => {
    if (detail.state !== 'open') void api.drawCard(detail.id).then(setCard);
  }, [detail.id, detail.state]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await reload(); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      {detail.myStatus === 'invited' && (
        <div className="card stack">
          <h2 style={{ fontSize: 22 }}>Are you in this year?</h2>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.confirm(detail.id))}>I’m in</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.decline(detail.id))}>Not this year</button>
        </div>
      )}

      {detail.state === 'open' && detail.myStatus === 'confirmed' && (
        <div className="card">
          <h2 style={{ fontSize: 22 }}>You’re ready.</h2>
          <p className="muted">The draw happens when everyone has confirmed. {detail.counts.confirmed} of {detail.counts.participants} confirmed.</p>
        </div>
      )}

      {detail.state !== 'open' && card && card.state !== 'no_card' && (
        <div className="card stack">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your draw</div>
          {card.changed && <div className="error">Your draw has changed. Press and hold to see it.</div>}
          <HoldToReveal onReveal={async () => (await api.reveal(detail.id)).recipientFirstName} />
          {card.signedInAs && <div className="muted" style={{ fontSize: 13 }}>Signed in as {card.signedInAs}</div>}
        </div>
      )}

      {detail.isAdmin && (
        <div className="card stack">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Admin</div>
          {detail.inviteUrl && (
            <button className="btn btn-soft" onClick={() => { void navigator.clipboard?.writeText(detail.inviteUrl!); setDrawMsg('Invite link copied'); }}>
              Copy invite link
            </button>
          )}
          {detail.state === 'open' && (
            <button className="btn btn-primary" disabled={busy || detail.counts.confirmed < 3 || detail.counts.confirmed !== detail.counts.participants}
              onClick={() => act(async () => {
                const r = await api.runDraw(detail.id);
                setDrawMsg(`Drawn for ${r.participants}.${r.relaxed ? ' The no-repeat rule was relaxed this year.' : ''}`);
              })}>
              {detail.counts.confirmed < 3 ? 'Run the draw · need 3' : detail.counts.confirmed !== detail.counts.participants ? 'Run the draw · waiting for all' : 'Run the draw'}
            </button>
          )}
          {detail.state === 'drawn' && (
            <button className="btn btn-soft" disabled={busy} onClick={() => act(() => api.openChat(detail.id))}>Open the chat now</button>
          )}
          {drawMsg && <p className="muted" style={{ fontSize: 14 }}>{drawMsg}</p>}
        </div>
      )}
    </div>
  );
}

function WishlistsTab({ editionId }: { editionId: string }) {
  const [wl, setWl] = useState<MyWishlist | null>(null);
  const [text, setText] = useState('');
  const [others, setOthers] = useState<Array<{ participantId: string; firstName: string; isYou: boolean; icon: string }>>([]);

  const load = useCallback(async () => {
    setWl(await api.myWishlist(editionId));
    setOthers((await api.wishlists(editionId)).wishlists);
  }, [editionId]);
  useEffect(() => { void load(); }, [load]);

  if (!wl) return <p className="muted center">Loading…</p>;

  return (
    <div className="stack">
      <div className="card stack">
        <div style={{ fontSize: 14, fontWeight: 700, color: wl.state === 'published' ? 'var(--success)' : 'var(--muted)' }}>
          {wl.state === 'published' ? 'Published: everyone here can see this' : wl.state === 'surprise' ? 'Surprise me! is on' : 'Draft: only you can see this'}
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
              <input type="text" placeholder="Add an item" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-soft" style={{ width: 'auto' }} disabled={!text.trim()}
                onClick={async () => { setWl(await api.addItem(editionId, { text: text.trim() })); setText(''); }}>Add</button>
            </div>
            {wl.state !== 'published' && <button className="btn btn-primary" disabled={wl.items.length === 0} onClick={async () => setWl(await api.publishWishlist(editionId))}>Publish</button>}
            <button className="btn btn-ghost" onClick={async () => setWl(await api.surprise(editionId))}>Switch to “Surprise me!”</button>
          </>
        )}
        {wl.state === 'surprise' && <button className="btn btn-ghost" onClick={async () => setWl(await api.unsurprise(editionId))}>Write a list instead</button>}
      </div>

      <div className="card stack">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Everyone’s wishlists</div>
        {others.map((o) => (
          <div key={o.participantId} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{o.firstName}{o.isYou ? ' (you)' : ''}</span>
            <span className="muted">{o.icon === 'published' ? '🎁 Published' : o.icon === 'surprise' ? '✨ Surprise' : '— Not yet'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatTab({ editionId }: { editionId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.chat>> | null>(null);
  const [text, setText] = useState('');

  const load = useCallback(async () => setData(await api.chat(editionId)), [editionId]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000); // poll every 15s
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <p className="muted center">Loading…</p>;
  if (data.locked)
    return (
      <div className="card center stack">
        <h2 style={{ fontSize: 22 }}>The chat is locked</h2>
        <p className="muted">It opens when everyone has checked their draw: {data.toCheck} to go.</p>
      </div>
    );

  return (
    <div className="stack">
      {data.myAlias && <div className="muted" style={{ fontSize: 13 }}>You are {data.myAlias.emoji} {data.myAlias.name} this year</div>}
      <div className="card stack" style={{ maxHeight: '50vh', overflow: 'auto' }}>
        {(data.messages ?? []).map((m) =>
          m.system ? (
            <div key={m.id} className="muted center" style={{ fontSize: 13 }}>— {m.system.replace('_', ' ')} —</div>
          ) : (
            <div key={m.id} style={{ textAlign: m.mine ? 'right' : 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.alias?.emoji} {m.alias?.name}</div>
              <div style={{ display: 'inline-block', background: m.mine ? 'var(--primary)' : 'var(--soft)', color: m.mine ? 'var(--on-primary)' : 'var(--text)', padding: '8px 12px', borderRadius: 14 }}>
                {m.removed ? <em className="muted">message removed</em> : m.body}
              </div>
            </div>
          ),
        )}
      </div>
      {data.canPost && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} maxLength={1000} />
          <button className="btn btn-soft" style={{ width: 'auto' }} disabled={!text.trim()}
            onClick={async () => { await api.postChat(editionId, text.trim()); setText(''); await load(); }}>Send</button>
        </div>
      )}
    </div>
  );
}

function PeopleTab({ editionId }: { editionId: string }) {
  const [data, setData] = useState<{ participants: ParticipantRow[]; summary: { confirmed: number; checked: number; total: number; drawn: boolean } } | null>(null);
  useEffect(() => { void api.participants(editionId).then(setData); }, [editionId]);
  if (!data) return <p className="muted center">Loading…</p>;
  return (
    <div className="card stack">
      <div className="muted" style={{ fontSize: 13 }}>
        {data.summary.drawn ? `${data.summary.checked} of ${data.summary.total} have checked their draw` : `${data.summary.confirmed} of ${data.summary.total} confirmed`}
      </div>
      {data.participants.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{p.firstName}{p.lastInitial ? ` ${p.lastInitial}.` : ''}{p.isYou ? ' (you)' : ''}{p.isAdmin ? ' · admin' : ''}</span>
          <StatusChip status={p.status} />
          <span>{p.wishlistState === 'published' ? '🎁' : p.wishlistState === 'surprise' ? '✨' : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: ParticipantRow['status'] }) {
  const map = { invited: ['⏳ Invited', 'var(--muted)'], confirmed: ['✓ Confirmed', 'var(--success)'], draw_checked: ['👁 Draw checked', 'var(--primary)'] } as const;
  const [label, color] = map[status];
  return <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>;
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: Array<[Tab, string]> = [['home', 'Home'], ['wishlists', 'Wishlists'], ['chat', 'Chat'], ['people', 'People']];
  return (
    <div style={{ position: 'sticky', bottom: 0, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 8, marginTop: 12 }}>
      {tabs.map(([t, label]) => (
        <button key={t} onClick={() => setTab(t)} className="btn" style={{ minHeight: 44, background: tab === t ? 'var(--soft)' : 'transparent', color: tab === t ? 'var(--primary)' : 'var(--muted)', fontSize: 13 }}>
          {label}
        </button>
      ))}
    </div>
  );
}
