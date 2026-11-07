#!/usr/bin/env node
/**
 * Sets up RevenueCat for Zikaron3D through the REST API v2, using a *secret* API
 * key (`sk_…`) scoped to the Zikaron3D project.
 *
 *   node scripts/deploy/rc-setup.mjs --secret-key sk_xxxx --dry-run
 *   node scripts/deploy/rc-setup.mjs --secret-key sk_xxxx
 *
 * What it does (idempotent):
 *   1. finds the project the key can see (or uses --project-id)
 *   2. finds the Apple App Store app; creates it with bundle_id if missing
 *   3. reads the public Apple SDK key (appl_…) via /public_api_keys
 *   4. creates the five consumable products the app requires
 *   5. registers the webhook that feeds the Supabase purchases ledger
 *   6. prints the appl_ key so it can be wired into the build
 *
 * A public key (appl_, test_, goog_) cannot authenticate the REST API - only a
 * secret key can, which is why this script needs the sk_ value.
 */
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const KEY = arg('secret-key', process.env.RC_SECRET_KEY ?? '').trim();
const BUNDLE = arg('bundle-id', 'com.AdvBig.Zikaron3D');
const APP_NAME = arg('app-name', 'Zikaron3D');
const PROJECT_ARG = arg('project-id', '');
const WEBHOOK_URL = arg('webhook-url', 'https://ggkrbyjabsihzdskdbrt.supabase.co/functions/v1/revenuecat-webhook');
const DRY = flag('dry-run');
const SKIP_WEBHOOK = flag('skip-webhook');
const BASE = 'https://api.revenuecat.com/v2';

const PRODUCTS = [
  { store_identifier: 'crystals_100', display_name: '100 Crystals', title: '100 Crystals' },
  { store_identifier: 'crystals_500', display_name: '500 Crystals', title: '500 Crystals' },
  { store_identifier: 'crystals_1200', display_name: '1,200 Crystals', title: '1,200 Crystals' },
  { store_identifier: 'starter_pack', display_name: 'Starter Pack', title: 'Starter Pack' },
  { store_identifier: 'shield_pack_10', display_name: '10 Streak Shields', title: '10 Streak Shields' },
];

const WEBHOOK_EVENTS = ['initial_purchase', 'non_renewing_purchase', 'renewal'];

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

if (!KEY) fail('Pass --secret-key sk_… (RevenueCat > your Zikaron3D project > API keys > Secret API keys).');
if (KEY.startsWith('test_') || KEY.startsWith('appl_') || KEY.startsWith('goog_')) {
  fail('That is a PUBLIC key. The REST API v2 only accepts a secret key (sk_…); public keys are for the SDK.');
}

async function api(pathAndQuery, { method = 'GET', body } = {}) {
  if (DRY && method !== 'GET') {
    console.log(`   [dry-run] ${method} ${pathAndQuery}${body ? ` ${JSON.stringify(body).slice(0, 140)}` : ''}`);
    return { dry: true };
  }
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
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
    const error = new Error(`${method} ${pathAndQuery} -> ${res.status} ${JSON.stringify(parsed?.message ?? parsed?.errors ?? parsed).slice(0, 260)}`);
    error.status = res.status;
    error.body = parsed;
    throw error;
  }
  return parsed;
}

async function main() {
  console.log(`RevenueCat setup${DRY ? '  (DRY RUN - no writes)' : ''}`);

  // 1. which project can this key see?
  let projectId = PROJECT_ARG;
  if (!projectId) {
    const projects = await api('/projects');
    const items = projects.items ?? [];
    if (items.length === 0) fail('This secret key cannot see any project.');
    if (items.length > 1) fail(`The key sees ${items.length} projects (${items.map((i) => `${i.id}:${i.name}`).join(', ')}). Re-run with --project-id.`);
    projectId = items[0].id;
    console.log(`project: ${projectId}  (${items[0].name})`);
  } else {
    console.log(`project: ${projectId}  (from --project-id)`);
  }

  // 2. App Store app config
  const apps = await api(`/projects/${projectId}/apps?limit=100`);
  let app = (apps.items ?? []).find((a) => a.type === 'app_store');
  if (!app) {
    console.log(`no App Store app yet - creating "${APP_NAME}" (${BUNDLE})`);
    await api(`/projects/${projectId}/apps`, {
      method: 'POST',
      body: { name: APP_NAME, type: 'app_store', app_store: { bundle_id: BUNDLE } },
    });
    app = { id: DRY ? '<new>' : null, type: 'app_store' };
    if (!DRY) {
      const after = await api(`/projects/${projectId}/apps?limit=100`);
      app = (after.items ?? []).find((a) => a.type === 'app_store');
      console.log(`created app ${app?.id}`);
    }
  } else {
    console.log(`App Store app: ${app.id}  bundle=${app.app_store?.bundle_id ?? '?'}`);
    if (app.app_store?.bundle_id && app.app_store.bundle_id !== BUNDLE) {
      console.warn(`⚠ the app config uses bundle id ${app.app_store.bundle_id}, expected ${BUNDLE}`);
    }
  }

  // 3. public Apple SDK key
  if (!DRY && app?.id) {
    const keys = await api(`/projects/${projectId}/apps/${app.id}/public_api_keys`);
    for (const k of keys.items ?? []) console.log(`public key [${k.environment}]: ${k.key}`);
    const prod = (keys.items ?? []).find((k) => k.environment === 'production') ?? (keys.items ?? [])[0];
    if (prod) console.log(`\nEXPO_PUBLIC_REVENUECAT_APPLE_KEY=${prod.key}\n`);
  }

  // 4. consumable products
  const existing = await api(`/projects/${projectId}/products?limit=100`);
  const have = new Set((existing.items ?? []).map((p) => p.store_identifier));
  for (const product of PRODUCTS) {
    if (have.has(product.store_identifier)) {
      console.log(`product ${product.store_identifier}: exists`);
      continue;
    }
    console.log(`product ${product.store_identifier}: creating`);
    const body = { store_identifier: product.store_identifier, app_id: app?.id, type: 'consumable', display_name: product.display_name };
    try {
      await api(`/projects/${projectId}/products`, { method: 'POST', body });
    } catch (error) {
      if (!DRY && error.status === 422 && /title/i.test(JSON.stringify(error.body))) {
        await api(`/projects/${projectId}/products`, { method: 'POST', body: { ...body, title: product.title } });
      } else {
        throw error;
      }
    }
  }

  // 5. webhook feeding the Supabase ledger
  if (!SKIP_WEBHOOK) {
    const hooks = await api(`/projects/${projectId}/integrations/webhooks?limit=100`);
    const already = (hooks.items ?? []).some((h) => h.url === WEBHOOK_URL);
    if (already) {
      console.log('webhook: already registered');
    } else {
      console.log(`webhook: registering ${WEBHOOK_URL}`);
      await api(`/projects/${projectId}/integrations/webhooks`, {
        method: 'POST',
        body: {
          name: 'Zikaron3D Supabase',
          url: WEBHOOK_URL,
          environment: null,
          event_types: WEBHOOK_EVENTS,
          app_id: app?.id ?? null,
        },
      });
    }
  }

  console.log('\nNext:');
  console.log('  1. dashboard > Integrations > Webhooks > open it > Authorization header:');
  console.log('     Bearer <REVENUECAT_WEBHOOK_SECRET>   (the v2 API cannot set a custom header)');
  console.log('  2. node scripts/deploy/rc-wire.mjs --public-key appl_…   (wires the build env)');
}

main().catch((error) => fail(error.message));
