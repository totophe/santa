import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** SHA-256 hex of a high-entropy token (or a short-lived code). */
export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** A URL-safe random token (default 32 bytes). */
export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** A 6-digit numeric code, zero-padded, from a CSPRNG. */
export function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
