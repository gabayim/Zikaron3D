# TestFlight test plan — App Store compliance & security

Run after `node scripts/deploy/deploy-backend.mjs` and `node scripts/deploy/verify-live.mjs`
have passed, on a **production** EAS build installed through TestFlight (sandbox
Apple ID signed into the device). Tick each row; anything that fails is a blocker.

## 0. Build & install

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production   # or upload via Transporter
```

- [ ] Build finishes with `ITSAppUsesNonExemptEncryption` already answered (no
      compliance prompt at upload time).
- [ ] App launches on a device that has never seen it before.

## 1. No developer-only permissions (audit blocker #4)

- [ ] First launch shows **no** "Local Network" permission alert.
- [ ] Settings → *Zikaron3D* lists no Local Network switch.
- [ ] First launch asks for nothing else (no notifications, no tracking, no ATT).

## 2. Parental gate (audit blockers #1–#2, high #3–#5)

- [ ] TOYBOX → ARCADE requires the math gate; wrong answers do not switch modes.
- [ ] Three wrong answers lock the gate for ~30 s (digits replaced by a countdown).
- [ ] Passing the mode gate does **not** then allow a purchase without a new gate.
- [ ] In TOYBOX, shop entry, SKIP LVL, world unlock and skin purchase each ask
      again (no reuse of an earlier approval).
- [ ] Mid-level in TOYBOX, the currency bar / shop shortcut is hidden.

## 3. Real purchases (audit blocker #1)

Sign in with a sandbox Apple ID. In **Arcade → Shop → Gems**:

- [ ] Every pack shows the **localized App Store price** (not a hardcoded `$`).
- [ ] `crystals_100` charges and grants exactly 100 crystals.
- [ ] `crystals_500` / `crystals_1200` do the same.
- [ ] `shield_pack_10` grants +10 shields (capped at 30).
- [ ] `starter_pack` grants 500 crystals **and** the 3 skins (Chrome Pip, Crystal
      Bloop, Velvet Fuzz) and then reads `OWNED` and cannot be bought twice.
- [ ] Cancelling the store sheet grants nothing and shows no error pop-up.
- [ ] Airplane mode → purchase fails gracefully (no grant, no crash).
- [ ] **No promo/coupon UI** exists anywhere (Profile modal, Shop).

## 4. Ledger + restore (audit blocker #1 / medium "no Restore")

- [ ] After a purchase, Supabase → Table editor → `purchases` has one row with the
      signed-in `user_id`, the product id and a unique `transaction_id`
      (proves the RevenueCat webhook fired).
- [ ] Delete the app, reinstall, sign in with the same Apple ID → **RESTORE
      PURCHASES** (Shop → Gems, and Settings) re-grants paid crystals that this
      device never applied.
- [ ] Restore twice in a row grants nothing the second time (idempotent).
- [ ] A second device signing in with the same account does not double-grant.

## 5. Account deletion + Apple revocation (audit medium)

- [ ] Settings → delete → confirm. The app signs out and cloud rows
      (`profiles`, `weekly_scores`, `purchases`) are gone for that user id.
- [ ] On the device: Settings → Apple ID → *Sign in with Apple* → Zikaron3D is no
      longer listed (the `link-apple` token was revoked by `delete-account`).
- [ ] Local progress (levels, cosmetics) still opens after deletion.

## 6. Anti-cheat (audit high "trivially cheatable")

- [ ] `node scripts/deploy/verify-live.mjs` with `SUPABASE_TEST_ACCESS_TOKEN`
      passes: forged score jumps and decreases are rejected by the trigger.
- [ ] On device: play Arcade, force-quit mid-run, relaunch → the synced score is
      never lower than the server's, and the app handles the rejection silently
      (no crash, no lost XP).

## 7. Offline behaviour (audit medium "fake bots")

- [ ] Airplane mode → Leaderboard shows the **PRACTICE** rivals labelled as such
      (no human-looking fake players).
- [ ] Signed out and online → the board invites sign-in instead of faking names.

## 8. Release hygiene

- [ ] Release build logs show no `console.warn` / `console.log` output (errors are
      still printed).
- [ ] No `service_role` key inside the shipped binary
      (`npx source-map-explorer` not needed; `strings Payload/Zikaron3D.app/Zikaron3D | grep service_role` returns nothing).
- [ ] Privacy/Terms/Support links open in the in-app browser from both Settings and
      the Shop footer, and the pages load over HTTPS.

## 9. Store metadata sanity

- [ ] Screenshots contain no prices and no promo codes.
- [ ] "In-App Purchases" is shown on the product page (App Store Connect → Pricing).
- [ ] Age rating computes to **4+** with the questionnaire answers in
      `APP_STORE_CONNECT_CHECKLIST.md` §2.

Sign off by recording the build number and the date each row passed in the
TestFlight "What to Test" notes.
