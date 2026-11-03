import { type InviteEntry } from '../api';
import { useI18n } from '../i18n';

/** Controlled list of name + email rows for inviting people to a group. */
export function InviteRows({ value, onChange }: { value: InviteEntry[]; onChange: (v: InviteEntry[]) => void }) {
  const { t } = useI18n();
  // Always show one trailing blank row to type into.
  const rows = value.length === 0 || value[value.length - 1].email || value[value.length - 1].firstName
    ? [...value, { firstName: '', email: '' }]
    : value;

  function set(i: number, patch: Partial<InviteEntry>) {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    // Drop fully-empty rows except keep the list coherent for the parent.
    onChange(next.filter((r) => r.firstName.trim() || r.email.trim()));
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder={t('invite.name_placeholder')} maxLength={30}
            value={r.firstName} onChange={(e) => set(i, { firstName: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
          <input type="email" placeholder={t('invite.email_placeholder')} inputMode="email" autoComplete="off"
            value={r.email} onChange={(e) => set(i, { email: e.target.value })} style={{ flex: 1.3, minWidth: 0 }} />
        </div>
      ))}
    </div>
  );
}

/** Keep only rows with both a name and a plausible email. */
export function validInvites(rows: InviteEntry[]): InviteEntry[] {
  return rows
    .map((r) => ({ firstName: r.firstName.trim(), email: r.email.trim() }))
    .filter((r) => r.firstName && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));
}
