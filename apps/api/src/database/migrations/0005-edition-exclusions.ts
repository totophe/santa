import type { Sequelize } from '@sequelize/core';

/**
 * Per-edition exclusion rules: two participants who must not draw each other
 * (e.g. a couple). Symmetric — stored once per unordered pair with
 * participant_a_id < participant_b_id; the draw forbids both directions.
 */
export const name = '0005-edition-exclusions';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    CREATE TABLE edition_exclusion (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_id        uuid NOT NULL REFERENCES edition(id) ON DELETE CASCADE,
      participant_a_id  uuid NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
      participant_b_id  uuid NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
      CHECK (participant_a_id < participant_b_id)
    );
    CREATE UNIQUE INDEX edition_exclusion_pair_uk
      ON edition_exclusion (edition_id, participant_a_id, participant_b_id);
    CREATE INDEX edition_exclusion_edition_idx ON edition_exclusion (edition_id);
  `);
}
