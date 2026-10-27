import { createMMKV } from 'react-native-mmkv';

let kv: ReturnType<typeof createMMKV> | null = null;
try {
  kv = createMMKV({ id: 'zikaron3d-compliance' });
} catch {
  kv = null;
}

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
