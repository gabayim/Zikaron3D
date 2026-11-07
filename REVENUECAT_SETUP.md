# RevenueCat setup for Zikaron3D — exact steps

Verified against RevenueCat's current docs (links inline). Your values are filled
in; anything `<LIKE THIS>` you supply from the dashboard.

**Order matters:** App Store Connect products must exist **before** RevenueCat can
import them, and Apple blocks creating them via API — so step 4 happens in App
Store Connect first.

---

## 0. Before you start — what you already have

| Value | Where it is |
|---|---|
| Bundle ID | `com.AdvBig.Zikaron3D` |
| App Store Connect app id | `475133336` |
| ASC API key | `C:\Users\EREZ\Documents\AuthKey_9F3C3BR5Z2.p8` (Key ID `9F3C3BR5Z2`) |
| Issuer ID | `69a6de73-a0be-47e3-e053-5b8c7c11a4d1` (same for IAP + ASC keys) |
| Supabase webhook URL | `https://ggkrbyjabsihzdskdbrt.supabase.co/functions/v1/revenuecat-webhook` |
| Webhook secret | the `REVENUECAT_WEBHOOK_SECRET` in Supabase → Edge Functions → Secrets |

You still need one credential RevenueCat treats as **required**: an **In-App
Purchase key** (a different key type from the ASC API key). Step 2 creates it.

---

## 1. Create the project

1. RevenueCat dashboard → project switcher (top left) → **+ New project**.
2. Name: `Zikaron3D`.

A **Test Store** app exists in every new project by default — ignore it; a
production build never uses it.

---

## 2. Add the App Store app + credentials

Docs: <https://www.revenuecat.com/docs/projects/connect-a-store>

1. Project dashboard → **Apps** (lower section) → **+ Add app config** → **Apple
   App Store**.
2. Fill in:
   - **App name**: `Zikaron3D`
   - **Bundle ID**: `com.AdvBig.Zikaron3D` (exact capitalisation)
   - **Shared Secret**: App Store Connect → **App Information** → *App-Specific
     Shared Secret* → *Manage* → *Generate* (or copy).
3. **In-App Purchase key** (required — StoreKit 2 transactions are not recorded
   without it):
   - App Store Connect → **Users and Access** → **Integrations** →
     **In-App Purchase** → **Generate In-App Purchase Key** (or **+** next to
     *Active*) → name it `Zikaron3D RevenueCat` → **Download API Key**
     (`SubscriptionKey_XXXXXXXXXX.p8`, one download only).
   - In RevenueCat, open the app → tab **In-app purchase key configuration** →
     upload that `.p8` → paste **Issuer ID** `69a6de73-a0be-47e3-e053-5b8c7c11a4d1`
     → **Save changes** → confirm **"Valid credentials"**.
4. **App Store Connect API key** (recommended — lets RevenueCat import your
   products and prices automatically):
   app settings → **App Store Connect API Key** → upload
   `AuthKey_9F3C3BR5Z2.p8`, Key ID `9F3C3BR5Z2`, Issuer ID
   `69a6de73-a0be-47e3-e053-5b8c7c11a4d1`.

---

## 3. Copy the PUBLIC SDK key (this is what I need)

Docs: <https://www.revenuecat.com/docs/projects/authentication>

Project → **API keys** → section **Public platform-specific API keys** → the
**Apple** row. It starts with **`appl_`**. (Also shown in the app's own settings.)

Send me that `appl_…` value — or run:

```powershell
node scripts/deploy/rc-wire.mjs --public-key appl_xxxxxxxxxxxxxxxx
```


---

## 4. Create the five products in App Store Connect first

App Store Connect → your app → **In-App Purchases** → **+**, five times, type
**Consumable**, using exactly these ids (Apple cannot be automated here):

| Reference name | Product ID | Price |
|---|---|---|
| Crystals 100 | `crystals_100` | $0.99 |
| Crystals 500 | `crystals_500` | $3.99 |
| Crystals 1200 | `crystals_1200` | $7.99 |
| Starter Pack | `starter_pack` | $2.99 |
| 10 Streak Shields | `shield_pack_10` | $0.99 |

Each needs a review screenshot (the Gems tab) before it can be attached to a
version.

---

## 5. Import those products into RevenueCat

Docs: <https://www.revenuecat.com/docs/projects/configuring-products>

1. **Product catalog → Products** → tab **App Store**.
2. **Import** (needs the ASC API key from step 2.4) — or **+ New** and enter the
   store identifier manually for each of the five ids above.
3. They should appear as type **consumable**.

**Skip entitlements**: all five are consumables (currency/shields), not
access-granting. Access is decided by our own ledger + local grants, so there is
no entitlement to attach. (RevenueCat's docs assume subscriptions; that part does
not apply.)

**Offerings are optional** for this app — it calls `Purchases.getProducts`
directly, so nothing reads `currentOffering`. Create a `default` offering only if
you want dashboard parity for later paywalls.

---

## 6. Add the webhook (Pro-plan feature)

Docs: <https://www.revenuecat.com/docs/integrations/webhooks>

1. Project → left menu **Integrations** → **Webhooks** → **+ Add new
   configuration**.
2. Name: `Zikaron3D Supabase`.
3. **URL**: `https://ggkrbyjabsihzdskdbrt.supabase.co/functions/v1/revenuecat-webhook`
4. **Authorization header**: `Bearer <REVENUECAT_WEBHOOK_SECRET>` — the exact
   value stored in Supabase → Edge Functions → Secrets.
5. Environment: **Production and Sandbox** (both, so TestFlight purchases land).
6. App scope: **Zikaron3D** only.
7. Event filter: `INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`, `RENEWAL`
   (the function ignores everything else).

Verified from our side: an unsigned call to that URL returns **401**; a call with
the correct secret returns **200**.

---

## 7. Check it end to end (after the build is on TestFlight)

- Buy `crystals_100` with a sandbox Apple ID in the Arcade shop.
- RevenueCat → **Customers**: the purchase appears under the Supabase user id
  (proves `Purchases.logIn` linking).
- Supabase → table **purchases**: a new row with that `user_id` and a unique
  `transaction_id` (proves the webhook → ledger).

---

## Optional: let me do steps 5–6 for you

Create a **project-scoped secret key** in the Zikaron3D project (API keys →
*+ New secret API key*) and send it once: I can then create/import the five
products, add the `default` offering and register the webhook through the
RevenueCat v2 API, then you revoke that key. Do **not** use the Retriva key — it
is scoped to that project and cannot see Zikaron3D (verified: `POST /v2/projects`
→ 401).

which validates it, writes the git-ignored `.env`, sets the **sensitive** EAS
production variable and re-runs the release preflight.

> Never send or ship the `sk_…` secret keys here. `scripts/deploy/rc-wire.mjs`
> and the release preflight both refuse them, and the app refuses to start the
> SDK with one.
