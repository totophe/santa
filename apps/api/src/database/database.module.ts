import { Global, Module, Logger } from '@nestjs/common';
import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';
import { CONFIG, type AppConfig } from '../config/env';
import { CryptoService } from '../crypto/crypto.service';
import { CryptoModule } from '../crypto/crypto.module';
import { ALL_MODELS, InstanceMeta } from './models';
import { runMigrations } from './migrator';

export const SEQUELIZE = Symbol('SEQUELIZE');

/**
 * Creates the Sequelize instance, runs forward-only migrations, and enforces
 * the encryption-key fingerprint before the app is allowed to serve traffic.
 */
@Global()
@Module({
  imports: [CryptoModule],
  providers: [
    {
      provide: SEQUELIZE,
      inject: [CONFIG, CryptoService],
      useFactory: async (config: AppConfig, crypto: CryptoService) => {
        const logger = new Logger('Database');
        const sequelize = new Sequelize({
          dialect: PostgresDialect,
          url: config.databaseUrl,
          models: ALL_MODELS,
          logging: false,
        });

        await sequelize.authenticate();
        await runMigrations(sequelize);

        // Store the key fingerprint at first start; refuse to start on mismatch.
        const fingerprint = crypto.fingerprint();
        const existing = await InstanceMeta.findOne();
        if (!existing) {
          await InstanceMeta.create({ keyFingerprint: fingerprint });
          logger.log('Stored encryption key fingerprint (first start).');
        } else if (existing.keyFingerprint !== fingerprint) {
          throw new Error(
            'ENCRYPTION_KEY does not match the fingerprint stored at first ' +
              'start. Refusing to start — using the wrong key would make every ' +
              'past draw undecryptable.',
          );
        }

        logger.log('Database ready.');
        return sequelize;
      },
    },
  ],
  exports: [SEQUELIZE],
})
export class DatabaseModule {}
