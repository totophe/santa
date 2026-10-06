import { randomBytes } from 'node:crypto';
import { CryptoService } from './crypto.service';

const keyB64 = randomBytes(32).toString('base64');

describe('CryptoService', () => {
  it('round-trips a value', () => {
    const svc = CryptoService.fromBase64(keyB64);
    const sealed = svc.encrypt('participant-123');
    expect(svc.decrypt(sealed.ciphertext, sealed.nonce)).toBe('participant-123');
  });

  it('produces a different nonce (and ciphertext) each time', () => {
    const svc = CryptoService.fromBase64(keyB64);
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => CryptoService.fromBase64(randomBytes(16).toString('base64'))).toThrow();
    expect(() => CryptoService.fromBase64('')).toThrow();
  });

  it('a wrong key cannot decrypt (auth tag fails)', () => {
    const good = CryptoService.fromBase64(keyB64);
    const bad = CryptoService.fromBase64(randomBytes(32).toString('base64'));
    const sealed = good.encrypt('secret');
    expect(() => bad.decrypt(sealed.ciphertext, sealed.nonce)).toThrow();
  });

  it('detects tampering with the ciphertext', () => {
    const svc = CryptoService.fromBase64(keyB64);
    const sealed = svc.encrypt('secret');
    sealed.ciphertext[0] ^= 0xff;
    expect(() => svc.decrypt(sealed.ciphertext, sealed.nonce)).toThrow();
  });

  it('fingerprint is stable per key and differs across keys', () => {
    const a = CryptoService.fromBase64(keyB64);
    const b = CryptoService.fromBase64(keyB64);
    const c = CryptoService.fromBase64(randomBytes(32).toString('base64'));
    expect(a.fingerprint()).toBe(b.fingerprint());
    expect(a.fingerprint()).not.toBe(c.fingerprint());
  });
});
