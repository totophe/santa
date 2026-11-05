import type { Sequelize } from '@sequelize/core';

/**
 * Per-user opt-out for the weekly unread-chat digest. Distinct from the full
 * email suppression list — a user who opts out still gets sign-in and draw
 * emails. Default false (everyone is in by default).
 */
export const name = '0008-user-digest-opt-out';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "user" ADD COLUMN digest_opt_out boolean NOT NULL DEFAULT false;
  `);
}
