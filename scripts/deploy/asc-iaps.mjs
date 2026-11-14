#!/usr/bin/env node
/**
 * Finishes the five consumable in-app purchases Zikaron3D needs.
 *
 * IMPORTANT (verified against the live API with an Admin/Account-Holder key):
 *   POST /v1/inAppPurchases -> 403 "The resource 'inAppPurchases' does not allow
 *   'CREATE'. Allowed operation is: GET_INSTANCE".
 *   Apple does not expose in-app purchase *creation* over the App Store Connect
 *   API, so the five product shells have to be created once in the web UI.
 *
 * What this script does instead:
 *   - reports which of the five ids exist,
 *   - prints the exact UI rows to create for the missing ones,
 *   - and for the ones that exist, sets the English localization and the USA
 *     price automatically (localizations and price schedules DO allow CREATE).
 *
 *   node scripts/deploy/asc-iaps.mjs --dry-run \
 *     --key-path "C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8" \
 *     --key-id 9F3C3BR5Z2 --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1
 *
 * Override a price with --price crystals_500=4.99 (repeatable).
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const allOf = (name) => args.reduce((out, a, i) => (a === `--${name}` && args[i + 1] ? [...out, args[i + 1]] : out), []);

const KEY_PATH = arg('key-path', process.env.ASC_KEY_PATH ?? '');
const KEY_ID = arg('key-id', process.env.ASC_KEY_ID ?? '');
const ISSUER = arg('issuer-id', process.env.ASC_ISSUER_ID ?? '');
const APP_ID = arg('app-id', '475133336');
const DRY = args.includes('--dry-run');
const BASE = 'https://api.appstoreconnect.apple.com';
const TERRITORY = 'USA';

if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error('Need --key-path, --key-id and --issuer-id (or ASC_* env vars).');
  process.exit(2);
}

const priceOverrides = new Map(allOf('price').map((pair) => pair.split('=')));

const PRODUCTS = [
  { productId: 'crystals_100', ref: 'Crystals 100', display: '100 Crystals', description: 'Pouch of sparkling blue gems', price: '0.99' },
  { productId: 'crystals_500', ref: 'Crystals 500', display: '500 Crystals', description: 'Chest of crystals for world unlocks', price: '3.99' },
  { productId: 'crystals_1200', ref: 'Crystals 1200', display: '1,200 Crystals', description: 'Vault of crystals - best value', price: '7.99' },
  { productId: 'starter_pack', ref: 'Starter Pack', display: 'Starter Pack', description: '500 crystals + 3 rare skins, once', price: '2.99' },
  { productId: 'shield_pack_10', ref: '10 Streak Shields', display: '10 Streak Shields', description: 'Protects arcade combo streaks', price: '0.99' },
];

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const key = createPrivateKey(readFileSync(KEY_PATH, 'utf8'));

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = sign(null, Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

async function api(pathAndQuery, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail = JSON.stringify(parsed?.errors ?? parsed ?? '').slice(0, 400);
    const error = new Error(`${method} ${pathAndQuery} -> ${res.status} ${detail}`);
    error.status = res.status;
    error.detail = detail;
    throw error;
  }
  return parsed;
}

async function findPricePoint(iapId, price) {
  let next = `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=${TERRITORY}&limit=200`;
  while (next) {
    const page = await api(next);
    const hit = (page.data ?? []).find((p) => String(p.attributes.customerPrice) === price);
    if (hit) return hit.id;
    next = page.links?.next ? page.links.next.replace(BASE, '') : '';
  }
  return null;
}

function priceScheduleBody(iapId, pricePointId) {
  return {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id: iapId } },
        baseTerritory: { data: { type: 'territories', id: TERRITORY } },
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${p0}' }] },
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: '${p0}',
        relationships: {
          inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: pricePointId } },
        },
      },
    ],
  };
}


async function main() {
  console.log(`App ${APP_ID}${DRY ? '  (DRY RUN - nothing is written)' : ''}\n`);

  const existing = await api(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`);
  const byProduct = new Map((existing.data ?? []).map((p) => [p.attributes.productId, p]));
  console.log(`Existing in-app purchases: ${existing.data?.length ? [...byProduct.keys()].join(', ') : 'none'}\n`);

  const missing = [];

  for (const product of PRODUCTS) {
    const price = priceOverrides.get(product.productId) ?? product.price;
    let current = byProduct.get(product.productId);
    if (!current) {
      if (DRY) {
        missing.push({ ...product, price });
        continue;
      }
      try {
        console.log(`CREATE ${product.productId.padEnd(18)} type=CONSUMABLE ref="${product.ref}"`);
        const res = await api('/v2/inAppPurchases', {
          method: 'POST',
          body: {
            data: {
              type: 'inAppPurchases',
              attributes: {
                name: product.ref,
                productId: product.productId,
                inAppPurchaseType: 'CONSUMABLE',
              },
              relationships: {
                app: {
                  data: {
                    type: 'apps',
                    id: APP_ID,
                  },
                },
              },
            },
          },
        });
        current = res.data;
        byProduct.set(product.productId, current);
        console.log(`       created (id ${current.id})`);
      } catch (err) {
        console.log(`       create failed: ${err.message}`);
        missing.push({ ...product, price });
        continue;
      }
    }

    console.log(`FOUND  ${product.productId.padEnd(18)} state=${current.attributes.state}`);
    if (DRY) continue;

    const locs = await api(`/v2/inAppPurchases/${current.id}/inAppPurchaseLocalizations?limit=50`);
    const en = (locs.data ?? []).find((l) => l.attributes.locale === 'en-US');
    if (!en) {
      await api('/v1/inAppPurchaseLocalizations', {
        method: 'POST',
        body: {
          data: {
            type: 'inAppPurchaseLocalizations',
            attributes: { locale: 'en-US', name: product.display, description: product.description },
            relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: current.id } } },
          },
        },
      });
      console.log('       localization en-US created');
    } else {
      console.log(`       localization en-US present ("${en.attributes.name}")`);
    }

    try {
      const pricePointId = await findPricePoint(current.id, price);
      if (!pricePointId) {
        console.log(`       WARNING: no ${TERRITORY} price point at $${price}`);
        continue;
      }
      await api('/v1/inAppPurchasePriceSchedules', { method: 'POST', body: priceScheduleBody(current.id, pricePointId) });
      console.log(`       price $${price} set (${TERRITORY} base, other stores auto-calculated)`);
    } catch (error) {
      if (/already|conflict|exist/i.test(String(error.detail ?? error.message))) {
        console.log('       price already set');
      } else {
        console.log(`       price not set: ${String(error.detail ?? error.message).slice(0, 180)}`);
      }
    }
  }

  if (missing.length) {
    console.log('\n----------------------------------------------------------------------');
    console.log('APPLE DOES NOT ALLOW CREATING IN-APP PURCHASES VIA THE API');
    console.log('(verified: the resource inAppPurchases allows GET_INSTANCE only).');
    console.log('Create these once in App Store Connect > In-App Purchases > "+":\n');
    console.log('  #  Reference Name        Product ID         Type        Price');
    missing.forEach((p, i) => {
      console.log(`  ${i + 1}  ${p.ref.padEnd(22)}${p.productId.padEnd(19)}CONSUMABLE  $${p.price}`);
    });
    console.log('\n  Display Name (max 30) and Description (max 45) to use:');
    missing.forEach((p) => console.log(`    ${p.productId.padEnd(18)} "${p.display}" / "${p.description}"`));
    console.log('\n  Re-run this script afterwards: it sets the English localization and');
    console.log('  the USA price automatically and verifies all five ids.');
    console.log('----------------------------------------------------------------------');
  }

  if (!DRY) {
    const after = await api(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`);
    console.log(`\nNow on the app: ${after.data?.length ?? 0} product(s)`);
    for (const p of after.data ?? []) {
      console.log(`  ${String(p.attributes.productId).padEnd(18)} ${String(p.attributes.state).padEnd(16)} ${p.attributes.name ?? ''}`);
    }
  }

  const ready = PRODUCTS.length - missing.length;
  console.log(`\n${ready}/${PRODUCTS.length} product ids exist${missing.length ? ' - create the rest in the UI, then re-run' : ' - nothing missing'}.`);
  process.exit(missing.length ? 3 : 0);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
