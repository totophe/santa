import type { Sequelize } from '@sequelize/core';

/**
 * Web Push subscriptions: one row per browser/device a user enabled. The
 * endpoint (a vendor push-service URL) is the natural unique key — re-subscribing
 * returns the same endpoint. p256dh/auth are device-side public key material, not
 * Santa secrets. Dead endpoints (404/410 on send) are pruned at send time.
 */
export const name = '0006-push-subscriptions';

export async function up({ context: sequelize }: { context: Sequelize }): Promise<void> {
  await sequelize.query(`
    CREATE TABLE push_subscription (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      endpoint    text NOT NULL UNIQUE,
      p256dh      text NOT NULL,
      auth        text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX push_subscription_user_idx ON push_subscription (user_id);
  `);
}
