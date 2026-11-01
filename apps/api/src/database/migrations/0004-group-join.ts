import type { Sequelize } from '@sequelize/core';
import { randomUrlToken } from '../../auth/tokens';

/**
 * Move joining from the edition to the GROUP. A group now has a shareable invite
 * token and a visibility: `private` (admin approves join requests) or
 * `semi_public` (joining adds you straight away). A membership gains a status so
 * a pending row can represent an unapproved join request.
 *
 * Backfill is non-destructive: existing groups become `private` with a fresh
 * token, and every existing membership is `active` (already-vetted members).
 * `edition.invite_token` is left in place but unused by the new flow.
 */
export const name = '0004-group-join';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "group"
      ADD COLUMN visibility text NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private','semi_public')),
      ADD COLUMN invite_token text;

    ALTER TABLE membership
      ADD COLUMN status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','pending'));
  `);

  // Backfill a unique invite token per existing group.
  const [groups] = await sequelize.query(`SELECT id FROM "group" WHERE invite_token IS NULL`);
  for (const row of groups as Array<{ id: string }>) {
    await sequelize.query(
      `UPDATE "group" SET invite_token = $token WHERE id = $id`,
      { bind: { token: randomUrlToken(16), id: row.id } },
    );
  }

  await sequelize.query(`
    CREATE UNIQUE INDEX group_invite_token_uk ON "group" (invite_token)
      WHERE invite_token IS NOT NULL;
  `);
}
