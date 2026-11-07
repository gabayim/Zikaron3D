# Apple API keys for Zikaron3D releases (what to create, and why)

There are three different Apple keys people mix up, and they are not
interchangeable.

| Key | Where it is created | What it unlocks | Status |
|---|---|---|---|
| **App Store Connect API key** | App Store Connect → Users and Access → **Integrations** | Reading/writing the app record, TestFlight, **iOS signing credentials**, uploads | **DONE — `AuthKey_9F3C3BR5Z2.p8`, verified working** |
| **In-App Purchase key** (App Store Server API) | App Store Connect → Integrations → In-App Purchase | Server-side receipt/transaction verification only | Optional |
| **Sign in with Apple key** | Developer Portal → Certificates, Identifiers & Profiles → Keys | The `APPLE_CLIENT_SECRET` client-secret JWT for Supabase Apple sign-in and token revocation | Needed for account-deletion revocation |

## Verified credentials (do not paste these anywhere public)

```
Key file   C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8
Key ID     9F3C3BR5Z2
Issuer ID  69a6de73-a0be-47e3-e053-5b8c7c11a4d1
Role       ACCOUNT_HOLDER + ADMIN  (read from GET /v1/users)
```

A key alone cannot authenticate: the JWT's `iss` claim must be the account-wide
**Issuer ID**. With a wrong/missing issuer the API answers `401 NOT_AUTHORIZED`
even for a perfectly valid key — that is exactly what happened the first time.

## Verified capability matrix (App Store Connect API, this key)

| Operation | Allowed | Evidence |
|---|---|---|
| Read app, versions, app info, IAPs | ✅ | used by `asc-app-info.mjs` |
| Create app version / version localization | ✅ | `409 … ATTRIBUTE.REQUIRED` (i.e. only the body was wrong) |
| Create screenshots sets, review submissions | ✅ | `409 … REQUIRED`, so CREATE is permitted |
| Create in-app purchase localization / price schedule | ✅ | `409 … RELATIONSHIP.INVALID/REQUIRED` |
| **Create an in-app purchase itself** | ❌ | `403 "The resource 'inAppPurchases' does not allow 'CREATE'. Allowed operation is: GET_INSTANCE"` |

Consequence: the five consumables must be created once in the web UI
(`scripts/deploy/asc-iaps.mjs` prints the exact rows, then finishes the
localizations and prices over the API). Everything else can be automated.

## Creating a Sign in with Apple key (for account-deletion revocation)

Developer Portal → **Certificates, Identifiers & Profiles** → **Keys** → **+** →
"Sign in with Apple" → download `AuthKey_<KEYID>.p8`, note the Key ID, then:

```bash
node scripts/deploy/apple-client-secret.mjs \
  --team-id DAVRE4G59N --key-id <KEYID> \
  --client-id com.AdvBig.Zikaron3D --p8 ./AuthKey_<KEYID>.p8
```

Set the output as the `APPLE_CLIENT_SECRET` function secret and add
`APPLE_CLIENT_ID=com.AdvBig.Zikaron3D`.

## Only if a *new* ASC API key is ever needed

1. <https://appstoreconnect.apple.com> → **Users and Access** → **Integrations**
   → **App Store Connect API** (Team Keys tab).
2. Press **+** (Generate Key).
3. Name: `Zikaron3D EAS`. **Access/Role: Admin.**
   Admin is required: Expo's docs say EAS needs an "ASC API token with Admin
   access to check and update Apple credentials". App Manager only works if that
   person additionally has *Access to Certificates, Identifiers, and Profiles*
   enabled, and it still cannot create keys/profiles reliably from CI.
4. **Generate** → **Download** the `.p8` (Apple lets you download it exactly
   once) → save it next to the other key, e.g.
   `C:\Users\EREZ\Documents\AuthKey_<NEWKEYID>.p8`.
5. Copy the two values now shown at the top of the page:
   - **Issuer ID** — one UUID for the whole account, e.g. `69a6de8c-…`
   - **Key ID** — 10 characters, matches the filename `AuthKey_<KEYID>.p8`

Both values are recorded above. The `.p8` never leaves this machine (git-ignored) —
I read it from disk and it is never committed.

## 2. What I do with them (all non-interactive, no Apple password/2FA)

```powershell
$env:EXPO_ASC_API_KEY_PATH = "C:\Users\EREZ\Documents\AuthKey_<KEYID>.p8"
$env:EXPO_ASC_KEY_ID       = "<KEYID>"
$env:EXPO_ASC_ISSUER_ID    = "<ISSUER-UUID>"
```

1. **Read the live record** (read-only, answers "what is on the store now"):
   ```powershell
   node scripts/deploy/asc-app-info.mjs --key-path $env:EXPO_ASC_API_KEY_PATH `
     --key-id $env:EXPO_ASC_KEY_ID --issuer-id $env:EXPO_ASC_ISSUER_ID
   ```
   Prints: app id/bundle/SKU, name + subtitle, privacy policy URL, primary
   category, every iOS version with its state, and the in-app purchase product
   ids (flagging any of the five the code requires that are missing).

2. **Build** (EAS creates/reuses the distribution certificate and provisioning
   profile through the key):
   ```powershell
   npx eas-cli@latest build --platform ios --profile production --non-interactive
   ```

3. **Submit** to App Store Connect / TestFlight:
   ```powershell
   npx eas-cli@latest submit --platform ios --profile production --non-interactive
   ```
   `eas.json` already carries `submit.production.ios.ascAppId = "475133336"`, which
   non-interactive submit requires.

Still needed from you for the build itself (they are compiled into the app, not
secrets of the release process):

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |
| `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` | RevenueCat → Project → API keys → Apple **public** SDK key (`appl_…`) |

Once those exist I run (one time):
```powershell
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "<url>" --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon>" --visibility sensitive
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_REVENUECAT_APPLE_KEY --value "appl_…" --visibility sensitive
```

## 3. Alternative if you would rather not create an Admin key

Run once, interactively, on your machine (Apple ID + 2FA):

```powershell
npx eas-cli@latest credentials --platform ios
```
Choose the `production` profile → **App Store Connect: Manage your API Key** →
**Set up your project to use an API Key for Expo Submit**, and follow the prompts
(this stores a key on EAS servers, so later builds/submits are non-interactive).
The downside: only you can do it, and it still requires an Apple login.

## 4. Security notes

- `.p8` files are git-ignored patterns (`.gitignore` blocks `*.p8`), and the
  preflight refuses a `service_role` key.
- If you ever post a `.p8` value anywhere, revoke that key in App Store Connect
  and generate a new one; keys cannot be re-downloaded, only replaced.
- `EXPO_ASC_*` values live only in your shell session — nothing is committed.
