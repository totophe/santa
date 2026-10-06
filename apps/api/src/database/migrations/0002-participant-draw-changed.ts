import type { Sequelize } from '@sequelize/core';

/**
 * A flag set on the inheriting giver by a departure repair, so their draw card
 * can show a "changed" notice until their next reveal. "Draw checked" itself
 * never reverts, keeping the repair invisible in the participant list.
 */
export const name = '0002-participant-draw-changed';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    ALTER TABLE participant
      ADD COLUMN draw_changed boolean NOT NULL DEFAULT false;
  `);
}
