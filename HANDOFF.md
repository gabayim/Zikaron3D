# HANDOFF — continue the Zikaron3D 2.15.0 release from the Mac

State as of the Windows session. Everything below is committed and pushed; the only
things missing from the repo are **secrets**, which are deliberately git-ignored.

## 1. Where the release stands

| Item | State |
|---|---|
| App Store version | **2.15.0**, `PREPARE_FOR_SUBMISSION`, manual release, copyright `2026 ZMZ Softwares` |
| Build | **2.15.0 (218)** — EAS `528d01e5-ced7-4856-911a-ef98b0539f39`, ASC build `663848ff-f406-4e74-8992-165681305c23`, `VALID`, export compliance false |
| Build attached to the version | **yes** |
| Copy | description 1570 chars, keywords 79/100, promo 111/170, What's New 688, support + marketing URLs |
| App info | subtitle `Memory arcade for families`, privacy `https://zmz.ca/zikaron3d/privacy.html`, 4+, content rights declared |
| Supabase | project `ggkrbyjabsihzdskdbrt` live: schema + RLS + rate-limit triggers, 3 edge functions, secrets set |
| RevenueCat | project `proj2c5f0c4c`, app `app4b4245257c`, 5 consumables active, webhook registered |
| Public SDK key in EAS | `appl_kWplgwYbfVofEdSBQyDDAzNlSly` (sensitive var, production) |
| Signing | cert `493QU94WFH`, profile `72P627HWV8` (minted via API), stored as EAS *local* credentials |

Run this any time to see exactly what still blocks submission:

```bash
node scripts/deploy/asc-submit-readiness.mjs \
  --key-path ~/Documents/AuthKey_9F3C3BR5Z2.p8 --key-id 9F3C3BR5Z2 \
  --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1
```

## 2. Setup on the Mac

```bash
git pull
npm ci
```

**Create `.env`** (git-ignored) with four values:

```
EXPO_PUBLIC_SUPABASE_URL=https://ggkrbyjabsihzdskdbrt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase > Project Settings > API > anon public>
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=appl_kWplgwYbfVofEdSBQyDDAzNlSly
EXPO_PUBLIC_SITE_URL=https://zmz.ca/zikaron3d
```

Never put a Supabase `service_role` key, a RevenueCat `sk_` key or the webhook
secret in it — the preflight and the app both refuse them.

Copy the ASC API key to the same path you use in `eas.json`:

```bash
# eas.json submit.production.ios.ascApiKeyPath points at
# C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8  (Windows path)
# On the Mac, put the key at ~/Documents/AuthKey_9F3C3BR5Z2.p8 and update that
# field to that path, or export it per-command:
#   --asc-api-key-path ~/Documents/AuthKey_9F3C3BR5Z2.p8
```

Then confirm the repo is release-ready:

```bash
node scripts/deploy/preflight-ios-release.mjs --live-version 2.14
```

## 3. Signing on the Mac — pick one

`eas.json` production currently has `"credentialsSource": "local"`, which expects
`credentials/` + `credentials.json` next to the project (both git-ignored, so they
are **not** in the clone).

**A. Let EAS manage it (simplest on a Mac).** Run once:

```bash
npx eas-cli@latest credentials --platform ios      # pick the production profile,
                                                   # log in with the Apple ID, let it
                                                   # create/reuse the distribution
                                                   # certificate + profile
```

then delete the `"credentialsSource": "local"` line from `eas.json` so future builds
use the EAS-managed credentials.

**B. Reuse the ones already minted.** Copy `credentials/` and `credentials.json`
from the Windows machine (the `.p12` password lives inside `credentials.json`).

**C. Regenerate them from the ASC API** (macOS openssl works out of the box now):

```bash
node scripts/deploy/asc-signing.mjs \
  --key-path ~/Documents/AuthKey_9F3C3BR5Z2.p8 --key-id 9F3C3BR5Z2 \
  --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1
```

It refuses to run if the account already has two active distribution
certificates — revoke one in the Developer Portal first.

## 4. The only things left before "Submit for Review"

Apple's API cannot do these, so they are yours — each is a few minutes:

1. **Screenshots** (2 checks). Apple rejects invented gameplay (2.3), so these must
   be real captures. Install the TestFlight build, capture the six screens listed in
   `assets/store/screenshots/README.txt` on a 6.9" iPhone and a 13" iPad, drop them
   in `assets/store/screenshots/source/`, then:

   ```bash
   python3 scripts/assets/buildScreenshots.py     # composites into 1320x2868 / 2064x2752
   ```

   Upload the six `final/iphone-*.png` and four `final/ipad-*.png` in App Store
   Connect (or ask me to push them via the API).

2. **The five consumables** (5 checks). App Store Connect → the app → **In-App
   Purchases → “+”**, type Consumable, ids exactly:

   `crystals_100` $0.99 · `crystals_500` $3.99 · `crystals_1200` $7.99 ·
   `starter_pack` $2.99 · `shield_pack_10` $0.99

   Apple's own response blocks automation: *"The resource 'inAppPurchases' does not
   allow 'CREATE'. Allowed operation is: GET_INSTANCE."*

3. **Review contact** (1 check). `appStoreReviewDetail` needs `contactPhone`;
   Apple rejects the create without it. Once you have a phone number, either create
   it in App Store Connect → App Review Information, or ask me to do it with the
   notes already drafted in `APP_STORE_SUBMISSION_ONBOARDING.txt` §8.

### Also still open (not submission-blocking)

- **RevenueCat → the App Store app → In-App Purchase key + shared secret.** The API
  reports `iapKeyConfigured: false`; StoreKit 2 purchases are **not recorded** until
  the In-App Purchase key (ASC → Users and Access → Integrations → In-App Purchase)
  and the App-Specific Shared Secret are uploaded there.
- Revoke the throwaway RevenueCat secret key used for the API setup and, if you shared it, the
  Supabase personal access token - both were used only for this setup.
- Optional tidy-up: archive the three leftover Test Store products
  (`monthly`, `yearly`, `lifetime`) in the RevenueCat project.

## 5. Cheat sheet

```bash
# is the repo ready to build?
node scripts/deploy/preflight-ios-release.mjs --live-version 2.14

# what still blocks submission? (read-only)
node scripts/deploy/asc-submit-readiness.mjs --key-path ~/Documents/AuthKey_9F3C3BR5Z2.p8 \
  --key-id 9F3C3BR5Z2 --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1

# live App Store Connect record (read-only)
node scripts/deploy/asc-app-info.mjs --key-path ~/Documents/AuthKey_9F3C3BR5Z2.p8 \
  --key-id 9F3C3BR5Z2 --issuer-id 69a6de73-a0be-47e3-e053-5b8c7c11a4d1

# build + upload (production profile, buildNumber auto-increments)
npx eas-cli@latest build  --platform ios --profile production --wait
npx eas-cli@latest submit --platform ios --profile production --latest

# release notes / checklist
#   APP_STORE_SUBMISSION_ONBOARDING.txt   field-by-field ASC guide
#   REVENUECAT_SETUP.md                  live RevenueCat ids + webhook URL
#   TESTFLIGHT_TEST_PLAN.md              device pass to run on the sandbox build
#   APP_STORE_CONNECT_CHECKLIST.md       short reference
```

## 6. Ids you will need

| Thing | Value |
|---|---|
| App Store Connect app | `475133336` |
| ASC API key | `AuthKey_9F3C3BR5Z2.p8` · Key `9F3C3BR5Z2` · Issuer `69a6de73-a0be-47e3-e053-5b8c7c11a4d1` |
| Version 2.15.0 id | `ceb9c393-79e0-4a0e-9e6d-90d4176e3dde` |
| Build 218 (ASC) | `663848ff-f406-4e74-8992-165681305c23` |
| Signing cert / profile | `493QU94WFH` / `72P627HWV8` |
| Supabase project | `ggkrbyjabsihzdskdbrt` (eu-west-1) |
| RevenueCat project / app / webhook | `proj2c5f0c4c` / `app4b4245257c` / `whintgr5e4955c5b0774054a098bde0a4d6939e` |
| RevenueCat public SDK key | `appl_kWplgwYbfVofEdSBQyDDAzNlSly` |
| Webhook endpoint | `…/functions/v1/revenuecat-webhook?token=<REVENUECAT_WEBHOOK_SECRET>` |
| Public site | `https://zmz.ca/zikaron3d/` |

