import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from '@sequelize/core';
import { ChatMessage, Edition, Participant, User } from '../database/models';
import { CONFIG, type AppConfig } from '../config/env';
import { MailService } from '../mail/mail.service';
import { I18nService } from '../i18n/i18n.service';
import { AliasService } from '../aliases/alias.service';
import { SuppressionService } from '../safety/suppression.service';
import { RateLimitService, DAY } from '../safety/rate-limit.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class DigestService {
  private readonly logger = new Logger('Digest');

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly mail: MailService,
    private readonly i18n: I18nService,
    private readonly aliases: AliasService,
    private readonly suppression: SuppressionService,
    private readonly rateLimit: RateLimitService,
    private readonly crypto: CryptoService,
  ) {}

  // Daily tick; the per-user 7-day guard makes each person's digest weekly.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scheduled(): Promise<void> {
    try {
      const { sent } = await this.runDigests();
      if (sent > 0) this.logger.log(`sent ${sent} chat digest(s)`);
    } catch (err) {
      this.logger.error(`digest run failed: ${(err as Error).message}`);
    }
  }

  /**
   * Email each participant a digest of the GROUP-chat messages they haven't read
   * (others' messages only, excluding system/deleted), skipping anyone who's
   * caught up, opted out, or suppressed, and at most once per 7 days per person.
   * Returns how many emails were sent. Exposed so it can be invoked directly.
   */
  async runDigests(): Promise<{ sent: number }> {
    const editions = await Edition.findAll({
      where: { chatOpenedAt: { [Op.ne]: null }, state: { [Op.ne]: 'archived' } },
    });

    // userId → (editionId → { name, theme, messages[] })
    const perUser = new Map<string, Map<string, { name: string; theme: string; msgs: ChatMessage[] }>>();

    for (const edition of editions) {
      const messages = await ChatMessage.findAll({
        where: { editionId: edition.id, deletedAt: null, systemKind: null },
        order: [['createdAt', 'ASC']],
      });
      if (messages.length === 0) continue;

      const participants = await Participant.findAll({ where: { editionId: edition.id } });
      for (const p of participants) {
        if (!p.userId) continue;
        const readAt = p.chatReadAt ? p.chatReadAt.getTime() : 0;
        // Unread, with a body, and not authored by this person.
        const unread = messages.filter(
          (m) => m.createdAt.getTime() > readAt && m.body && m.aliasKey && m.aliasKey !== p.aliasKey,
        );
        if (unread.length === 0) continue;
        if (!perUser.has(p.userId)) perUser.set(p.userId, new Map());
        perUser.get(p.userId)!.set(edition.id, { name: edition.name, theme: edition.theme, msgs: unread });
      }
    }

    let sent = 0;
    for (const [userId, editionsMap] of perUser) {
      const user = await User.findByPk(userId);
      if (!user?.email) continue;
      if (user.digestOptOut) continue;
      if (await this.suppression.isSuppressed(user.email)) continue;
      try {
        await this.rateLimit.hit('chat_digest', userId, 1, 7 * DAY); // ≤ once per 7 days
      } catch {
        continue;
      }

      const lang = this.i18n.normalize(user.language);
      const unsubscribeUrl = `${this.config.appUrl}/api/digest/unsubscribe/${userId}/${this.crypto.digestUnsubToken(userId)}`;
      for (const [editionId, info] of editionsMap) {
        const lines = info.msgs.map((m) => {
          const a = this.aliases.display(info.theme, m.aliasKey!, lang);
          return `${a.emoji} ${a.name}: ${m.body}`;
        });
        try {
          await this.mail.sendChatDigest(
            user.email,
            info.name,
            lines,
            `${this.config.appUrl}/editions/${editionId}`,
            unsubscribeUrl,
            lang,
          );
          sent++;
        } catch (err) {
          this.logger.error(`digest email failed: ${(err as Error).message}`);
        }
      }
    }
    return { sent };
  }

  /** Verify the keyed link and opt the user out of the digest (no sign-in needed). */
  async unsubscribe(userId: string, hash: string): Promise<{ ok: boolean }> {
    const expected = this.crypto.digestUnsubToken(userId);
    // constant-time-ish compare
    if (hash.length !== expected.length) return { ok: false };
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return { ok: false };
    const user = await User.findByPk(userId);
    if (!user) return { ok: false };
    if (!user.digestOptOut) {
      user.digestOptOut = true;
      await user.save();
    }
    return { ok: true };
  }
}
