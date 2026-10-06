import type { Sequelize } from '@sequelize/core';

/** A sliding-window hit log for rate limiting, backed by Postgres (no Redis). */
export const name = '0003-rate-limit';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    CREATE TABLE rate_limit_hit (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket      text NOT NULL,
      subject     text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX rate_limit_hit_lookup ON rate_limit_hit (bucket, subject, created_at);
  `);
}
