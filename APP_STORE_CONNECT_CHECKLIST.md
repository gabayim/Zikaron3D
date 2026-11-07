# App Store Connect Submission Guide & Checklist for Zikaron3D

This document contains the exact answers and metadata needed when submitting **Zikaron3D** to App Store Connect.

> **Start with `APP_STORE_SUBMISSION_ONBOARDING.txt`** — it is the same information
> in App Store Connect screen order, with every field to paste and every value you
> still have to supply marked `<LIKE THIS>`. Use this file as the short reference
> and `TESTFLIGHT_TEST_PLAN.md` for the device pass.

---

## 1. App Information & Category

- **Primary Category:** Games > Casual (or Family)
- **Secondary Category:** Games > Puzzle
- **Content Rights:** Yes, you own or have licensed all rights.
- **Age Rating:** **4+** (Suitable for all ages)

---

## 2. Age Rating Questionnaire Answers

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None (0) |
| Realistic Violence | None (0) |
| Profanity or Crude Humor | None (0) |
| Mature / Suggestive Themes | None (0) |
| Horror / Fear Themes | None (0) |
| Medical / Treatment Information | None (0) |
| Alcohol, Tobacco, or Drug Use | None (0) |
| Simulated Gambling | None (0) |
| Sexual Content or Nudity | None (0) |
| Graphic Sexual Content and Nudity | None (0) |
| Unrestricted Web Access | No (0) |
| Gambling and Contests | No (0) |
| **Resulting Rating** | **4+** |

---

## 3. App Privacy Questionnaire (Nutrition Labels)

### Does the app collect data?
**Yes** (Anonymous User ID, Purchases, Gameplay diagnostics).

### Data Types:

1. **Identifiers (User ID)**
   - **Collected:** Yes (via Sign in with Apple anonymous identifier)
   - **Linked to User:** Yes (tied to user cloud progress)
   - **Used for Tracking:** **NO**
   - **Usage Purpose:** App Functionality (cloud sync & score progress)

2. **Purchases (Purchase History)**
   - **Collected:** Yes (via StoreKit & RevenueCat)
   - **Linked to User:** Yes (tied to player ledger for restoring items)
   - **Used for Tracking:** **NO**
   - **Usage Purpose:** App Functionality

3. **Gameplay Content (Other Data / High Scores)**
   - **Collected:** Yes (Level unlocks, weekly arcade scores, streak shields)
   - **Linked to User:** Yes
   - **Used for Tracking:** **NO**
   - **Usage Purpose:** App Functionality

### Tracking:
- "Does this app use data to track the user across apps and websites owned by other companies?"
  - **Answer: NO**

---

## 4. Export Compliance (Encryption)

- **Does your app use encryption?**
  - Select: **Yes**
- **Is your app exempt under Category 5, Part 2?**
  - Select: **Yes** (Exempt — uses only standard HTTPS encryption via TLS/SSL for secure network communications).
  - Note: `ITSAppUsesNonExemptEncryption: false` is already set in `app.json` so App Store Connect may skip prompting for this.

---

## 5. In-App Purchases (Consumables)

Create the following 5 Consumable In-App Purchases in App Store Connect:

| Reference Name | Product ID | Type | Recommended Tier / USD |
|---|---|---|---|
| Pouch of 100 Crystals | `crystals_100` | Consumable | Tier 1 ($0.99) |
| Chest of 500 Crystals | `crystals_500` | Consumable | Tier 4 ($3.99) |
| Vault of 1,200 Crystals | `crystals_1200` | Consumable | Tier 8 ($7.99) |
| Starter Pack (500 Crystals + 3 Skins) | `starter_pack` | Consumable* | Tier 3 ($2.99) |
| 10 Streak Shields | `shield_pack_10` | Consumable | Tier 1 ($0.99) |

*\*Note: The app enforces that `starter_pack` is purchasable only once per account.*

---

## 6. App Review Information & Notes

Paste this into the **App Review Notes** box:

```text
Thank you for reviewing Zikaron3D!

1. Play Modes:
- TOYBOX: Designed for young children (ages 4–7). All external links, in-app purchases, and mode switching are strictly protected by a parental gate (two-digit math challenge).
- ARCADE: Main competitive arcade memory experience with weekly leagues and combo streak shields.
- SANCTUARY: Zen, relaxing memory training mode.

2. Parental Gate:
To change modes from TOYBOX to ARCADE, tap the mode selector on the top left of the hub and solve the math equation presented on the screen.

3. In-App Purchases:
Please use the Apple StoreKit Sandbox account to test purchases in the Arcade Shop > Gems tab.
All purchases can be verified and restored via the "RESTORE PURCHASES" button.

4. Account Deletion:
In compliance with guideline 5.1.1(v), account deletion is available in Settings (tap the trash icon). It deletes the user profile and data immediately from our database and revokes the Apple Sign In authorization.

If you have any questions, please contact us at support@zmz.ca.
```

---

## 7. App Store URLs

Live on the zmz.ca host (see `public-site/README.md`):

- **Privacy Policy URL:** `https://zmz.ca/zikaron3d/privacy.html`
- **Terms of Service URL:** `https://zmz.ca/zikaron3d/terms.html`
- **Support URL:** `https://zmz.ca/zikaron3d/support.html`
- **Marketing URL:** `https://zmz.ca/zikaron3d/`

---

## 8. Backend deployment (do this before TestFlight)

One command (see `scripts/deploy/README.md` for the environment variables):

```bash
node scripts/deploy/deploy-backend.mjs --dry-run   # review the plan
node scripts/deploy/deploy-backend.mjs             # link, secrets, schema, functions
node scripts/deploy/verify-live.mjs                # RLS + anti-cheat checks
```

It runs the equivalent of the following, using the JWT settings from
`supabase/config.toml`:

```bash
# 1. Schema (idempotent): Dashboard > SQL Editor > paste supabase/schema.sql
# 2. Function secrets (Dashboard > Edge Functions > Secrets, or CLI):
supabase secrets set \
  REVENUECAT_WEBHOOK_SECRET="<random long string>" \
  APPLE_CLIENT_ID="com.AdvBig.Zikaron3D" \
  APPLE_CLIENT_SECRET="<ES256 client-secret JWT signed with the Apple .p8 key>"

# 3. Deploy (the JWT settings in supabase/config.toml mirror these flags)
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase functions deploy link-apple
supabase functions deploy delete-account

# 4. RevenueCat > Integrations > Webhooks
#    URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
#    Authorization header: <the same REVENUECAT_WEBHOOK_SECRET value>
```

Notes:

- `link-apple` stores the Apple refresh token on first sign-in; `delete-account`
  revokes every stored token and then deletes the user. Without
  `APPLE_CLIENT_ID`/`APPLE_CLIENT_SECRET` deletion still works, but Apple's grant
  is not revoked.
- The app only ever ships the Supabase **anon** key (a `service_role` key is
  rejected at startup in `src/services/supabase.ts`).
- Products and the offering live only in App Store Connect + RevenueCat; the app
  reads prices at runtime (`loadProductPrices`).

---

## 9. Privacy manifest verification (macOS only)

`npx expo prebuild` cannot run on Windows, so run this once on macOS (or in CI)
before the first production build:

```bash
npx expo prebuild --platform ios --no-install
cat ios/Zikaron3D/PrivacyInfo.xcprivacy   # check the merged API + reason list
```

`app.json > expo.ios.privacyManifests` already declares tracking = false and the
required-reason reasons used by MMKV, Expo and RevenueCat: UserDefaults
(`CA92.1`), file timestamp (`C617.1`), system boot time (`35F9.1`) and disk space
(`E174.1`). If the generated file shows an additional category, add it there
instead of editing `ios/` (that folder is generated and git-ignored).

The `development` EAS profile sets `developmentClient: true`, which needs
`expo-dev-client` (installed) — required for testing RevenueCat outside Expo Go.


---

## 10. RevenueCat configuration (dashboard steps)

The app charges through RevenueCat's StoreKit wrapper (`react-native-purchases`)
and reads prices at runtime, so the dashboard must match the ids in
`src/services/monetization.ts`.

1. **Project** `Zikaron3D` → **Apps** → *App Store* app with bundle id
   `com.AdvBig.Zikaron3D`.
2. **App Store Connect credentials**: upload the *In-App Purchase* API key (or the
   App-specific Shared Secret from App Store Connect → App Information) so receipts
   validate. Sandbox purchases fail to appear in RevenueCat without it.
3. **Products** → add the five ids, type *Consumable*:
   `crystals_100`, `crystals_500`, `crystals_1200`, `starter_pack`,
   `shield_pack_10`. (Consumables need no entitlement; the one-per-account rule for
   `starter_pack` is enforced in the app by the `starter` flag.)
4. **Offerings** → create `default` and add all five products as packages. The app
   currently calls `Purchases.getProducts` directly, so the offering is for the
   dashboard/analytics and any future paywall, but keep the ids in it.
5. **Integrations → Webhooks** → URL
   `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`,
   *Authorization header* = exactly the `REVENUECAT_WEBHOOK_SECRET` you gave the
   functions. Event types: `INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`, `RENEWAL`
   (the function ignores everything else, and any other call is rejected with 401).
6. **API keys** → copy the **public** Apple SDK key into
   `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` (EAS environment variable for the production
   profile, `.env` locally). Without it the app runs offline-only and every pack
   reads "unavailable" instead of granting for free.
7. **Sandbox testers**: App Store Connect → Users and Access → Sandbox → Testers.
   Use one for the TestFlight pass; no real card is charged.
8. **Promotions**: the hardcoded promo codes were removed for guideline 3.1.1. Use
   **Apple Offer Codes** (App Store Connect → Subscriptions/In-App Purchases →
   Offer Codes) if you want promotions later; RevenueCat picks them up automatically.

### Verify the wiring

```bash
node scripts/deploy/verify-live.mjs           # RLS, anon key, anti-cheat triggers
```

Then buy one pack in TestFlight and confirm a row appears in `public.purchases`
with the signed-in `user_id`. `TESTFLIGHT_TEST_PLAN.md` lists the full pass.

