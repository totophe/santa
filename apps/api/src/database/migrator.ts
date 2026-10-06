import { Sequelize, QueryTypes } from '@sequelize/core';
import { Umzug, type UmzugStorage } from 'umzug';
import * as m0001 from './migrations/0001-init';
import * as m0002 from './migrations/0002-participant-draw-changed';
import * as m0003 from './migrations/0003-rate-limit';

const MIGRATIONS = [m0001, m0002, m0003];

/**
 * Minimal forward-only storage backed by a migrations_meta table. Umzug's
 * bundled SequelizeStorage targets Sequelize v6, so we track applied migrations
 * ourselves with plain SQL.
 */
function makeStorage(sequelize: Sequelize): UmzugStorage {
  return {
    async executed() {
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS migrations_meta (
           name   text PRIMARY KEY,
           run_at timestamptz NOT NULL DEFAULT now()
         )`,
      );
      const rows = await sequelize.query<{ name: string }>(
        `SELECT name FROM migrations_meta ORDER BY name`,
        { type: QueryTypes.SELECT },
      );
      return rows.map((r) => r.name);
    },
    async logMigration({ name }) {
      await sequelize.query(`INSERT INTO migrations_meta (name) VALUES ($name)`, {
        bind: { name },
      });
    },
    async unlogMigration({ name }) {
      await sequelize.query(`DELETE FROM migrations_meta WHERE name = $name`, {
        bind: { name },
      });
    },
  };
}

/** Run every pending migration, in order, at startup. */
export async function runMigrations(sequelize: Sequelize): Promise<void> {
  const umzug = new Umzug({
    migrations: MIGRATIONS.map((m) => ({
      name: m.name,
      up: async () => m.up({ context: sequelize }),
    })),
    storage: makeStorage(sequelize),
    logger: console,
  });
  await umzug.up();
}
