import type { Sequelize } from '@sequelize/core';

/**
 * Let an admin invite people to a group by email before they have an account.
 * A membership becomes "a person's relationship to a group, with or without an
 * account yet": `user_id` is now nullable and a row can instead carry an
 * `invited_email` + `invited_first_name` with status `invited`. When the person
 * signs in (or accepts in-app) the row gains their `user_id` and goes `active`.
 *
 * Existing rows all have a user_id and status 'active', so they're untouched.
 */
export const name = '0007-group-email-invites';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    ALTER TABLE membership
      ALTER COLUMN user_id DROP NOT NULL,
      ADD COLUMN invited_email text,
      ADD COLUMN invited_first_name text;

    -- Widen the status check to include email invites.
    ALTER TABLE membership DROP CONSTRAINT IF EXISTS membership_status_check;
    ALTER TABLE membership
      ADD CONSTRAINT membership_status_check CHECK (status IN ('active','pending','invited'));

    -- One membership per real user per group (was a plain UNIQUE; now partial so
    -- multiple email-only invites, which have NULL user_id, don't collide).
    ALTER TABLE membership DROP CONSTRAINT IF EXISTS membership_group_id_user_id_key;
    CREATE UNIQUE INDEX membership_group_user_uk
      ON membership (group_id, user_id) WHERE user_id IS NOT NULL;

    -- One open email-invite per address per group (only while unlinked).
    CREATE UNIQUE INDEX membership_group_invited_email_uk
      ON membership (group_id, lower(invited_email)) WHERE user_id IS NULL AND invited_email IS NOT NULL;
  `);
}
