import { createSafeKV, type SafeKV } from '../storage/kv';

const kv: SafeKV = createSafeKV('zikaron3d-compliance');

const SESSION_MS = 10 * 60 * 1000;

/** Parent passed a gate recently — OK for restore / IAP prompts. */
export function isParentalCommerceOk(): boolean {
  const until = kv?.getNumber('parentalCommerceUntil') ?? 0;
  return Date.now() < until;
}

export function grantParentalCommerce(sessionMs = SESSION_MS): void {
  kv?.set('parentalCommerceUntil', Date.now() + sessionMs);
}

export function clearParentalCommerce(): void {
  kv?.remove('parentalCommerceUntil');
}
