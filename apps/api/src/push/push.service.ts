import { Inject, Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PushSubscription } from '../database/models';
import { CONFIG, type AppConfig } from '../config/env';

export interface PushPayload {
  title: string;
  body: string;
  /** Path to open on tap, e.g. `/editions/<id>`. */
  url?: string;
}

/**
 * Web Push sender. Disabled (a no-op) when the instance set no VAPID keys.
 * Payloads must obey the draw-secrecy rule exactly like emails: role/alias only,
 * never a giver→recipient correlation.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  private readonly enabled: boolean;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.enabled = config.push.enabled;
    if (this.enabled) {
      webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async subscribe(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    // The endpoint is unique; re-subscribing updates the keys / owning user.
    const existing = await PushSubscription.findOne({ where: { endpoint } });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = p256dh;
      existing.auth = auth;
      await existing.save();
    } else {
      await PushSubscription.create({ userId, endpoint, p256dh, auth });
    }
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await PushSubscription.destroy({ where: { userId, endpoint } });
  }

  /**
   * Send a notification to every device a user has. Never throws (a failed push
   * must not break the action that triggered it). Dead endpoints (404/410) are
   * pruned.
   */
  async notify(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await PushSubscription.findAll({ where: { userId } });
    if (subs.length === 0) return;
    const data = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data,
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await s.destroy(); // subscription gone — prune it
          } else {
            this.logger.warn(`push send failed (status ${code ?? '?'})`);
          }
        }
      }),
    );
  }
}
