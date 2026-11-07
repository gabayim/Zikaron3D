#!/usr/bin/env node
/**
 * Generates the Apple "client secret" JWT used by Supabase's Sign in with Apple
 * provider and by the link-apple / delete-account functions (APPLE_CLIENT_SECRET).
 *
 *   node scripts/deploy/apple-client-secret.mjs \
 *     --team-id ABCDE12345 --key-id FGHIJ67890 \
 *     --client-id com.AdvBig.Zikaron3D --p8 ./AuthKey_FGHIJ67890.p8
 *
 * Prints the JWT to stdout; set it as a function secret:
 *   npx supabase secrets set APPLE_CLIENT_SECRET="<jwt>"
 *
 * Apple caps the lifetime at 6 months, so regenerate before it expires. The .p8
 * key is read locally and never leaves the machine.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const teamId = opt('team-id');
const keyId = opt('key-id');
const clientId = opt('client-id');
const p8Path = opt('p8');
const days = Math.min(180, Math.max(1, Number(opt('days', '180')) || 180));

if (!teamId || !keyId || !clientId || !p8Path) {
  console.error('Usage: node scripts/deploy/apple-client-secret.mjs --team-id <id> --key-id <id> --client-id <bundle id> --p8 <AuthKey.p8> [--days 180]');
  process.exit(1);
}

const b64url = (input) => Buffer.from(input).toString('base64url');
const now = Math.floor(Date.now() / 1000);

const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
const payload = b64url(
  JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + days * 24 * 60 * 60,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  }),
);
const signingInput = `${header}.${payload}`;

const key = createPrivateKey(readFileSync(p8Path, 'utf8'));
// Apple wants JOSE (raw r||s) ECDSA signatures, not DER.
const signature = sign(null, Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });

console.log(`${signingInput}.${b64url(signature)}`);
console.error(`Apple client secret generated (${days} days, child key ${keyId}, team ${teamId}).`);
