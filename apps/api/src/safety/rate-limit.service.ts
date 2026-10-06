import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Sequelize, QueryTypes } from '@sequelize/core';
import { SEQUELIZE } from '../database/database.module';

export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const MINUTE = 60_000;

/**
 * Sliding-window rate limiting backed by Postgres (the stack has no Redis). Each
 * check counts recent hits for a (bucket, subject) pair; over the limit raises
 * 429. Old hits are pruned opportunistically.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(SEQUELIZE) private readonly sequelize: Sequelize) {}

  /** Record a hit and throw 429 if the limit for this window is exceeded. */
  async hit(bucket: string, subject: string, limit: number, windowMs: number): Promise<void> {
    const since = new Date(Date.now() - windowMs);
    const rows = await this.sequelize.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM rate_limit_hit
         WHERE bucket = $bucket AND subject = $subject AND created_at > $since`,
      { type: QueryTypes.SELECT, bind: { bucket, subject, since } },
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count >= limit) {
      throw new HttpException('too_many_requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.sequelize.query(
      `INSERT INTO rate_limit_hit (bucket, subject) VALUES ($bucket, $subject)`,
      { bind: { bucket, subject } },
    );
    // Opportunistic prune of this subject's expired hits.
    await this.sequelize.query(
      `DELETE FROM rate_limit_hit WHERE bucket = $bucket AND subject = $subject AND created_at <= $since`,
      { bind: { bucket, subject, since } },
    );
  }
}
