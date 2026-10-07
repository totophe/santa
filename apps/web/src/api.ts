export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  language: string;
  profileComplete: boolean;
}

export interface ThemeInfo {
  name: string;
  label: string;
  defaultEditionNamePattern: string;
  palette: { light: Record<string, string>; dark: Record<string, string> };
  pattern: string;
}

export interface PublicMeta {
  instanceName: string;
  defaultLanguage: string;
  languages: string[];
  groupCreationOpen: boolean;
  themes: ThemeInfo[];
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) code = Array.isArray(body.message) ? body.message[0] : body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface EditionSummary {
  id: string;
  name: string;
  theme: string;
  state: string;
  exchangeDate: string | null;
  budgetAmount: string | null;
  budgetCurrency: string | null;
  daysToGo: number | null;
  myStatus: 'invited' | 'confirmed' | null;
  counts: { participants: number; confirmed: number };
}
export interface GroupSummary {
  id: string;
  name: string;
  defaultLanguage: string;
  role: string;
  currentEdition: EditionSummary | null;
}
export interface EditionDetail extends EditionSummary {
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  chatOpen: boolean;
  inviteUrl?: string;
}
export interface GroupDetail {
  id: string;
  name: string;
  defaultLanguage: string;
  role: string;
  members: Array<{ userId: string; firstName: string | null; lastName: string | null; role: string; isYou: boolean }>;
  editions: Array<{ id: string; name: string; theme: string; state: string; exchangeDate: string | null }>;
}
export interface ParticipantRow {
  id: string;
  firstName: string;
  lastInitial: string | null;
  isAdmin: boolean;
  isYou: boolean;
  status: 'invited' | 'confirmed' | 'draw_checked';
  wishlistState: 'published' | 'surprise' | 'not_yet';
}
export interface WishlistItem {
  id: string;
  text: string;
  url: string | null;
  price: string | null;
  note: string | null;
  addedAt: string;
}
export interface MyWishlist {
  state: 'draft' | 'published' | 'surprise';
  publishedAt: string | null;
  updatedAt: string;
  items: WishlistItem[];
}
export interface DrawCard {
  state: 'not_drawn' | 'ready' | 'checked' | 'no_card';
  changed: boolean;
  signedInAs?: string;
  budgetAmount?: string | null;
  budgetCurrency?: string | null;
  exchangeDate?: string | null;
}

export const api = {
  meta: () => request<PublicMeta>('/api/meta'),
  me: () => request<{ user: SessionUser }>('/api/auth/me'),

  listGroups: () => request<{ groups: GroupSummary[] }>('/api/groups'),
  createGroup: (body: unknown) =>
    request<{ group: { id: string }; edition: { id: string }; inviteUrl: string }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  group: (id: string) => request<GroupDetail>(`/api/groups/${id}`),
  saveEditionSettings: (id: string, body: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/editions/${id}/settings`, { method: 'PUT', body: JSON.stringify(body) }),
  archiveEditionReq: (id: string) => request<{ ok: true }>(`/api/editions/${id}/archive`, { method: 'POST' }),

  edition: (id: string) => request<EditionDetail>(`/api/editions/${id}`),
  participants: (id: string) =>
    request<{ participants: ParticipantRow[]; summary: { confirmed: number; checked: number; total: number; drawn: boolean } }>(
      `/api/editions/${id}/participants`,
    ),
  confirm: (id: string) => request(`/api/editions/${id}/confirm`, { method: 'POST' }),
  decline: (id: string) => request(`/api/editions/${id}/decline`, { method: 'POST' }),
  regenerateInvite: (id: string) => request<{ inviteUrl: string }>(`/api/editions/${id}/invite/regenerate`, { method: 'POST' }),

  joinInfo: (token: string) =>
    request<{ state: string; groupName?: string; editionName?: string; theme?: string }>(`/api/join/${token}`),
  join: (token: string) => request<{ editionId: string }>(`/api/join/${token}`, { method: 'POST' }),

  myWishlist: (id: string) => request<MyWishlist>(`/api/editions/${id}/my-wishlist`),
  addItem: (id: string, item: unknown) =>
    request<MyWishlist>(`/api/editions/${id}/my-wishlist/items`, { method: 'POST', body: JSON.stringify(item) }),
  deleteItem: (itemId: string) => request<MyWishlist>(`/api/wishlist-items/${itemId}`, { method: 'DELETE' }),
  pasteItems: (id: string, text: string) =>
    request<MyWishlist>(`/api/editions/${id}/my-wishlist/paste`, { method: 'POST', body: JSON.stringify({ text }) }),
  publishWishlist: (id: string) => request<MyWishlist>(`/api/editions/${id}/my-wishlist/publish`, { method: 'POST' }),
  surprise: (id: string) => request<MyWishlist>(`/api/editions/${id}/my-wishlist/surprise`, { method: 'POST' }),
  unsurprise: (id: string) => request<MyWishlist>(`/api/editions/${id}/my-wishlist/unsurprise`, { method: 'POST' }),
  wishlists: (id: string) =>
    request<{ wishlists: Array<{ participantId: string; firstName: string; isYou: boolean; icon: string }> }>(
      `/api/editions/${id}/wishlists`,
    ),
  wishlistOf: (id: string, pid: string) =>
    request<{ state: string; items?: WishlistItem[]; updatedAt?: string }>(`/api/editions/${id}/wishlists/${pid}`),

  runDraw: (id: string) =>
    request<{ participants: number; lookbackAchieved: number; relaxed: boolean }>(`/api/editions/${id}/draw`, { method: 'POST' }),
  drawCard: (id: string) => request<DrawCard>(`/api/editions/${id}/draw`),
  reveal: (id: string) => request<{ recipientFirstName: string }>(`/api/editions/${id}/reveal`, { method: 'POST' }),
  openChat: (id: string) => request(`/api/editions/${id}/open-chat`, { method: 'POST' }),

  chat: (id: string) =>
    request<{
      locked: boolean;
      toCheck?: number;
      total?: number;
      myAlias: { emoji: string; name: string } | null;
      canPost?: boolean;
      isAdmin?: boolean;
      messages?: Array<{ id: string; system?: string; alias?: { emoji: string; name: string } | null; mine?: boolean; body: string | null; removed?: boolean; createdAt: string }>;
    }>(`/api/editions/${id}/chat`),
  postChat: (id: string, body: string) =>
    request(`/api/editions/${id}/chat`, { method: 'POST', body: JSON.stringify({ body }) }),
  signIn: (email: string, sharedDevice: boolean) =>
    request<{ ok: true }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, sharedDevice }),
    }),
  verify: (email: string, code: string, sharedDevice: boolean) =>
    request<{ user: SessionUser; target: string | null }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, sharedDevice }),
    }),
  updateProfile: (firstName: string, lastName: string | null, language: string) =>
    request<{ user: SessionUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName, language }),
    }),
  signOut: () => request<{ ok: true }>('/api/auth/signout', { method: 'POST' }),
  deleteAccount: () => request<{ ok: true }>('/api/account', { method: 'DELETE' }),
};

export { ApiError };
