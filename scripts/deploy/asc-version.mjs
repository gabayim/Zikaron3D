#!/usr/bin/env node
/**
 * Creates the 2.15.1 App Store version for Zikaron3D and fills its en-US metadata
 * over the App Store Connect API, then verifies it. Also sets the app-level
 * subtitle and privacy policy URL.
 *
 *   node scripts/deploy/asc-version.mjs --dry-run \
 *     --key-path "C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8" \
 *     --key-id 9F3C3BR5Z2 --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1
 *
 * Drop --dry-run to write. Idempotent: an existing 2.15.1 version is updated, not
 * duplicated.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEY_PATH = arg('key-path', process.env.ASC_KEY_PATH ?? '');
const KEY_ID = arg('key-id', process.env.ASC_KEY_ID ?? '');
const ISSUER = arg('issuer-id', process.env.ASC_ISSUER_ID ?? '');
const APP_ID = arg('app-id', '475133336');
const VERSION = arg('version', '2.17.0');
const DRY = args.includes('--dry-run');
const BASE = 'https://api.appstoreconnect.apple.com';

if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error('Need --key-path, --key-id and --issuer-id (or ASC_* env vars).');
  process.exit(2);
}

const SUBTITLE = 'Memory arcade for families';
const PRIVACY_URL = 'https://zmz.ca/zikaron3d/privacy.html';

const REVIEW_NOTES = `Thank you for reviewing Zikaron3D!

1. Play Modes (tap the mode icon at the top right inside any game to switch):
- TOYBOX: gentle mode for young children (ages 4-7): no timers, hints, no ads.
- ARCADE: competitive arcade memory experience with combos and streak shields.
- SANCTUARY: zen, relaxing memory training mode.

2. In-App Purchases (5 consumables, all active in the App Store):
crystals_100, crystals_500, crystals_1200, starter_pack, shield_pack_10.
Open the Shop (shopping bag icon at top right of the hub) > Gems tab and tap any pack to buy with a StoreKit Sandbox account. Streak shields can also be bought in Settings. Purchases can be restored with the "RESTORE PURCHASES" button in the Shop and in Settings.

3. Account Deletion:
In compliance with guideline 5.1.1(v), tap the Profile avatar (top left of the hub) > SETTINGS & ACCOUNT > tap the trash icon. It deletes the user profile and data from our database and revokes the Apple Sign In authorization.

If you have any questions, please contact us at support@zmz.ca.`;

const METADATA = {
  description: `Zikaron3D is a hand-built 3D memory arcade for the whole family: seven toy-like worlds, seven different games and one calm place to play.

PLAY THREE WAYS
- TOYBOX: made for ages 4-7. No timers, gentle hints and no ads.
- ARCADE: combo streaks, streak shields and Prism Fever chains.
- SANCTUARY: slow, quiet practice with soft audio and no pressure.

SEVEN WORLDS, SEVEN GAMES
Meadow - Critter Burrows: match the critters peeking out of their holes.
Crystal - Prism Chorus: repeat glowing harmonic crystal melodies with light beams, chords and mirror echoes.
Deep Sea - Shell Shuffle: follow the shells as they shuffle.
Candy - Star Catcher: slide a resident under falling stars.
Grove - Vine Flow: turn the tiles to light every vine.
Circuit - Beat Circuit: hit the lanes on the beat of public-domain tunes.
Summit - Echo Peaks: repeat patterns of stars, tones and colours.

COLLECT AND DRESS UP
Meet fifteen animated critters, then unlock skins, hats, auras and trails. Everything you earn stays on your device; optional crystal packs buy cosmetics, world unlocks and streak shields - nothing is paywalled to play.

FAIR AND QUIET BY DESIGN
- No ads, no analytics SDKs, no tracking across apps or websites.
- Plays fully offline. Cloud save is optional and uses a private anonymous account (Sign in with Apple, no name or email requested).
- Delete your cloud data at any time in Profile > Settings & Account.
- In-App Purchases available.

Portrait, touch-first, designed for iPhone and iPad.`,
  keywords: 'memory,arcade,match,kids,family,brain,training,critters,puzzle,casual,relax,zen',
  promotionalText:
    'Seven worlds of memory and puzzle games, one kid-safe mode and offline play. No ads, no tracking.',
  supportUrl: 'https://zmz.ca/zikaron3d/support.html',
  marketingUrl: 'https://zmz.ca/zikaron3d/',
  whatsNew: `New World 2 memory game: Prism Chorus! Watch and listen as glowing crystals sing cumulative harmonic melodies, chain light beams to ignite Prism Fever, and master twin chords and mirror echoes.

Memory games first: Deep Sea (Shell Shuffle) is now World 3 right alongside Meadow and Crystal Cavern.

Upgraded Hub & Profile: live world indicator and dedicated Levels button on the hub, animated character showcase with custom naming, owned-assets closet, music/SFX controls, and 500 Crystal friend invite QR rewards.`,
};

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
    const detail = JSON.stringify(parsed?.errors ?? parsed ?? '').slice(0, 500);
    const error = new Error(`${method} ${pathAndQuery} -> ${res.status} ${detail}`);
    error.detail = detail;
    throw error;
  }
  return parsed;
}

const limits = { description: 4000, keywords: 100, promotionalText: 170, whatsNew: 4000, subtitle: 30 };


async function main() {
  console.log(`App ${APP_ID} -> version ${VERSION}${DRY ? '  (DRY RUN)' : ''}\n`);

  for (const [field, max] of Object.entries(limits)) {
    const value = field === 'subtitle' ? SUBTITLE : METADATA[field];
    if (value && value.length > max) {
      console.error(`✖ ${field} is ${value.length} chars (limit ${max})`);
      process.exit(1);
    }
  }
  console.log('Copy lengths:', Object.entries(limits)
    .map(([field, max]) => `${field} ${(field === 'subtitle' ? SUBTITLE : METADATA[field]).length}/${max}`)
    .join(' | '));

  const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=20&filter[platform]=IOS`);
  let version = (versions.data ?? []).find((v) => v.attributes.versionString === VERSION);
  if (version) {
    console.log(`\nVersion ${VERSION} already exists (id ${version.id}, state ${version.attributes.appStoreState}) - updating it.`);
  } else if (DRY) {
    console.log(`\nWould create version ${VERSION} (platform IOS, releaseType MANUAL, copyright 2026 ZMZ Softwares).`);
  } else {
    const created = await api('/v1/appStoreVersions', {
      method: 'POST',
      body: {
        data: {
          type: 'appStoreVersions',
          attributes: { platform: 'IOS', versionString: VERSION, releaseType: 'MANUAL', copyright: '2026 ZMZ Softwares' },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      },
    });
    version = created.data;
    console.log(`\nCreated version ${VERSION} (id ${version.id}).`);
  }

  const versionId = version?.id ?? '<new>';
  const locs = version ? await api(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=20`) : { data: [] };
  const en = (locs.data ?? []).find((l) => l.attributes.locale === 'en-US');

  if (DRY) {
    console.log(`Would ${en ? 'update' : 'create'} the en-US localization (description, keywords, promo, support URL, marketing URL, What's New).`);
  } else if (en) {
    await api(`/v1/appStoreVersionLocalizations/${en.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appStoreVersionLocalizations', id: en.id, attributes: METADATA } },
    });
    console.log('Updated the en-US localization.');
  } else {
    await api('/v1/appStoreVersionLocalizations', {
      method: 'POST',
      body: {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale: 'en-US', ...METADATA },
          relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
        },
      },
    });
    console.log('Created the en-US localization.');
  }

  // Update review notes on the version's review detail if present.
  if (!DRY && versionId !== '<new>') {
    try {
      const rev = await api(`/v1/appStoreVersions/${versionId}/appStoreReviewDetail`);
      if (rev.data?.id) {
        await api(`/v1/appStoreReviewDetails/${rev.data.id}`, {
          method: 'PATCH',
          body: { data: { type: 'appStoreReviewDetails', id: rev.data.id, attributes: { notes: REVIEW_NOTES } } },
        });
        console.log('Updated App Review notes.');
      }
    } catch (error) {
      console.log(`⚠ review notes not updated: ${String(error.detail ?? error.message).slice(0, 260)}`);
    }
  }

  // App info: Apple keeps one record per state. The live version's record is
  // locked (READY_FOR_DISTRIBUTION); the new version's record is editable.
  const infos = await api(`/v1/apps/${APP_ID}/appInfos?limit=10`);
  const editableInfo = (infos.data ?? []).find((i) => i.attributes.state === 'PREPARE_FOR_SUBMISSION');
  const infoId = (editableInfo ?? infos.data?.[0])?.id;
  if (editableInfo) console.log(`\nUsing the editable app info ${infoId} (state PREPARE_FOR_SUBMISSION).`);
  const infoLocs = infoId ? await api(`/v1/appInfos/${infoId}/appInfoLocalizations?limit=20`) : { data: [] };
  const infoEn = (infoLocs.data ?? []).find((l) => l.attributes.locale === 'en-US');

  if (DRY) {
    console.log(`Would set subtitle "${SUBTITLE}" and privacy URL ${PRIVACY_URL} on ${infoEn?.id ?? '(missing appInfoLocalization)'}.`);
  } else if (infoEn) {
    console.log(`\nApp info before: subtitle=${infoEn.attributes.subtitle ?? '(empty)'} privacy=${infoEn.attributes.privacyPolicyUrl ?? '(not set)'}`);
    try {
      await api(`/v1/appInfoLocalizations/${infoEn.id}`, {
        method: 'PATCH',
        body: { data: { type: 'appInfoLocalizations', id: infoEn.id, attributes: { subtitle: SUBTITLE, privacyPolicyUrl: PRIVACY_URL } } },
      });
      console.log('Set subtitle + privacy policy URL on the app info.');
    } catch (error) {
      console.log(`⚠ app info not updated: ${String(error.detail).slice(0, 260)}`);
    }
  }

  if (!DRY) {
    const check = await api(`/v1/appStoreVersions/${versionId}?include=appStoreVersionLocalizations`);
    const v = check.data;
    console.log(`\nVersion ${v.attributes.versionString}: state=${v.attributes.appStoreState} release=${v.attributes.releaseType} copyright=${v.attributes.copyright ?? '-'}`);
    for (const loc of check.included ?? []) {
      if (loc.type !== 'appStoreVersionLocalizations') continue;
      const a = loc.attributes;
      console.log(`  [${a.locale}] description=${(a.description ?? '').length} keywords=${(a.keywords ?? '').length} promo=${(a.promotionalText ?? '').length} whatsNew=${(a.whatsNew ?? '').length}`);
      console.log(`      support=${a.supportUrl ?? '-'}`);
      console.log(`      marketing=${a.marketingUrl ?? '-'}`);
    }
    const infoAfter = await api(`/v1/appInfos/${infoId}/appInfoLocalizations?limit=20`);
    const after = (infoAfter.data ?? []).find((l) => l.attributes.locale === 'en-US');
    console.log(`  app info: subtitle="${after?.attributes.subtitle ?? ''}" privacy=${after?.attributes.privacyPolicyUrl ?? '(not set)'}`);
  } else {
    console.log('\nDry run only. Re-run without --dry-run to write.');
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
