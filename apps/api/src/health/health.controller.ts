import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Sequelize } from '@sequelize/core';
import { SEQUELIZE } from '../database/database.module';
import { InstanceMeta } from '../database/models';
import { CryptoService } from '../crypto/crypto.service';

/** Returns 200 when the database is reachable and the key fingerprint matches. */
@Controller('healthz')
export class HealthController {
  constructor(
    @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
    private readonly crypto: CryptoService,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    try {
      await this.sequelize.query('SELECT 1');
      const meta = await InstanceMeta.findOne();
      const ok = !!meta && meta.keyFingerprint === this.crypto.fingerprint();
      res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded' });
    } catch {
      res.status(503).json({ status: 'down' });
    }
  }
}
