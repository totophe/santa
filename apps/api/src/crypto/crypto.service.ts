import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface Sealed {
  /** Ciphertext with the 16-byte GCM auth tag appended. */
  ciphertext: Buffer;
  nonce: Buffer;
}

/**
 * Encrypts draw assignments under the instance key (AES-256-GCM). The key lives
 * only in the environment, never the database. A fingerprint of it is stored at
 * first start so the server can refuse to boot against the wrong key — which
 * would silently make every past draw undecryptable.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`,
      );
    }
    this.key = key;
  }

  /** Parse and validate a base64-encoded 32-byte key. */
  static fromBase64(b64: string): CryptoService {
    if (!b64) {
      throw new Error('ENCRYPTION_KEY is required');
    }
    let raw: Buffer;
    try {
      raw = Buffer.from(b64, 'base64');
    } catch {
      throw new Error('ENCRYPTION_KEY must be valid base64');
    }
    return new CryptoService(raw);
  }

  /** A stable, non-reversible fingerprint of the key, stored in instance_meta. */
  fingerprint(): string {
    return createHash('sha256')
      .update('santa-key-fingerprint:')
      .update(this.key)
      .digest('hex');
  }

  /** A keyed (HMAC) hash of an email, for the suppression list — not reversible. */
  emailHash(email: string): string {
    return createHmac('sha256', this.key)
      .update('santa-email:')
      .update(email.trim().toLowerCase())
      .digest('hex');
  }

  encrypt(plaintext: string): Sealed {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGO, this.key, nonce);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return { ciphertext: Buffer.concat([enc, tag]), nonce };
  }

  decrypt(ciphertext: Buffer, nonce: Buffer): string {
    if (ciphertext.length < TAG_BYTES) {
      throw new Error('ciphertext too short');
    }
    const enc = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
    const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
    const decipher = createDecipheriv(ALGO, this.key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      'utf8',
    );
  }
}
