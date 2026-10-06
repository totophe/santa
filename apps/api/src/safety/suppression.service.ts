import { Injectable } from '@nestjs/common';
import { EmailSuppression } from '../database/models';
import { CryptoService } from '../crypto/crypto.service';

/**
 * The unsubscribe link in an invitation stores a keyed hash of the address.
 * Typed invitations to a suppressed address are silently skipped, and E2 is
 * never sent to it again.
 */
@Injectable()
export class SuppressionService {
  constructor(private readonly crypto: CryptoService) {}

  async isSuppressed(email: string): Promise<boolean> {
    const hash = this.crypto.emailHash(email);
    return (await EmailSuppression.count({ where: { emailHash: hash } })) > 0;
  }

  /** Suppress by the keyed hash directly (the unsubscribe link carries it). */
  async suppressByHash(hash: string): Promise<void> {
    await EmailSuppression.findOrCreate({
      where: { emailHash: hash },
      defaults: { emailHash: hash },
    });
  }

  hashFor(email: string): string {
    return this.crypto.emailHash(email);
  }
}
