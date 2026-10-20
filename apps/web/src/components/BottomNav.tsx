import { useI18n } from '../i18n';
import type { SessionUser } from '../api';

/** The three sections inside an edition. */
export type EdTab = 'people' | 'lists' | 'chat';

/** Where the app currently is — drives which items the bottom bar shows. */
export type NavKind = 'home' | 'group' | 'account' | 'admin' | 'edition';

type Item = { key: string; icon: string; label: string; active: boolean; onClick: () => void };

/**
 * One context-aware bottom bar for the whole app. At the app level it offers
 * Home / Account / Admin; inside an edition it morphs into that edition's
 * sections, with Home as the way back out. Rendered once, in App.
 */
export function BottomNav({
  kind,
  user,
  editionTab,
  onHome,
  onAccount,
  onAdmin,
  onEditionTab,
}: {
  kind: NavKind;
  user: SessionUser | null;
  editionTab: EdTab;
  onHome: () => void;
  onAccount: () => void;
  onAdmin: () => void;
  onEditionTab: (t: EdTab) => void;
}) {
  const { t } = useI18n();

  let items: Item[];
  if (kind === 'edition') {
    items = [
      { key: 'home', icon: '🏠', label: t('nav.home'), active: false, onClick: onHome },
      { key: 'people', icon: '👥', label: t('nav.people'), active: editionTab === 'people', onClick: () => onEditionTab('people') },
      { key: 'lists', icon: '🎁', label: t('nav.wishlists'), active: editionTab === 'lists', onClick: () => onEditionTab('lists') },
      { key: 'chat', icon: '💬', label: t('nav.chat'), active: editionTab === 'chat', onClick: () => onEditionTab('chat') },
    ];
  } else {
    items = [
      { key: 'home', icon: '🏠', label: t('nav.home'), active: kind === 'home' || kind === 'group', onClick: onHome },
      { key: 'account', icon: '👤', label: t('action.account'), active: kind === 'account', onClick: onAccount },
    ];
    if (user?.isInstanceAdmin) {
      items.push({ key: 'admin', icon: '🛠', label: t('nav.admin'), active: kind === 'admin', onClick: onAdmin });
    }
  }

  return (
    <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${items.length},1fr)` }}>
      {items.map((it) => (
        <button key={it.key} className={it.active ? 'active' : undefined} onClick={it.onClick} aria-current={it.active ? 'page' : undefined}>
          <span className="icon" aria-hidden="true">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
