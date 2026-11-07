# Deploy & verify — backend, site, and store checks

Everything the app cannot do at runtime is scripted here. All commands run from
the repo root and work on Windows (PowerShell), macOS and Linux.

| Goal | Command |
|---|---|
| Show the backend plan without touching anything | `node scripts/deploy/deploy-backend.mjs --dry-run` |
| Deploy schema + secrets + Edge Functions | `node scripts/deploy/deploy-backend.mjs` |
| Re-deploy only the functions | `node scripts/deploy/deploy-backend.mjs --skip-schema` |
| Verify live RLS, anon key and the anti-cheat triggers | `node scripts/deploy/verify-live.mjs` |
| Show the VPS plan | `node scripts/deploy/deploy-site.mjs --dry-run` |
| Publish the legal/marketing site | `node scripts/deploy/deploy-site.mjs --domain zikaron3d.app` |
| Publish **and** harden a fresh VPS | `node scripts/deploy/deploy-site.mjs --harden` |

## 1. Backend (`deploy-backend.mjs`)

Needs Node 20+ (fetch is built in) and network access; the Supabase CLI is pulled
through `npx` so nothing is installed globally and Docker is not required.

Values go in `.env` (git-ignored) or the shell environment:

| Variable | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Dashboard → Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | project URL `https://<ref>.supabase.co` (auto-detected from `EXPO_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database |
| `REVENUECAT_WEBHOOK_SECRET` | any long random string; paste the **same** value into the RevenueCat webhook's `Authorization` header |
| `APPLE_CLIENT_ID` | `com.AdvBig.Zikaron3D` |
| `APPLE_CLIENT_SECRET` | ES256 client-secret JWT signed with the Apple `.p8` key (see below) |

The script then, in order:

1. `supabase link` to the project;
2. `supabase secrets set` for whichever of the three secrets are present;
3. applies `supabase/schema.sql` by generating a temporary migration and running
   `supabase db push --remote` (`schema.sql` is idempotent, so re-running is safe —
   the temporary file is deleted afterwards, keeping `schema.sql` the only copy);
4. deploys `revenuecat-webhook` (`--no-verify-jwt`) plus `link-apple` and
   `delete-account` (JWT on), matching `supabase/config.toml`;
5. smoke-tests the webhook: an unsigned call must answer **401**.

Apple client secret (only needed for Apple token revocation on account deletion):

```bash
node scripts/deploy/apple-client-secret.mjs \
  --team-id DAVRE4G59N --key-id <Key ID of the Sign in with Apple key> \
  --client-id com.AdvBig.Zikaron3D --p8 ./AuthKey_XXXXXXXXXX.p8
```

It prints the ES256 JWT for `APPLE_CLIENT_SECRET`; Apple caps it at 6 months, so
regenerate before it expires. The `.p8` stays on your machine.

## 2. Live verification (`verify-live.mjs`)

Uses `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`, so it
tests exactly what the shipped app can do with the anon key:

- the key is the anon key, never `service_role`/`sb_secret_*`;
- anonymous reads of `profiles`, `weekly_scores` and `purchases` return no rows;
- anonymous writes to `purchases` / `weekly_scores` are refused;
- with `SUPABASE_TEST_ACCESS_TOKEN` set (a real user token) it also proves the
  triggers: a forged score jump is rejected, a score decrease is rejected, and a
  client-side ledger insert is refused;
- no `service_role` string exists anywhere in `src/`.

Getting a token for that optional block: run the app, sign in with Apple, and copy
the access token from the Supabase session (`supabase.auth.getSession()` in a debug
build) into `SUPABASE_TEST_ACCESS_TOKEN`, or temporarily use a throwaway email
user created in Dashboard → Authentication.

## 3. Site (`deploy-site.mjs`)

**The live site is on the zmz.ca host** (aaPanel/nginx, shared production box).
Publish into its vhost — nginx already serves it, so Caddy is skipped:

```powershell
$env:VPS_HOST = "new-vps"
$env:VPS_PATH = "/www/wwwroot/zmz.ca/zikaron3d"
$env:VPS_SKIP_CADDY = "1"
$env:VPS_OWNER = "www:www"
node scripts/deploy/deploy-site.mjs
```

Live URLs: `https://zmz.ca/zikaron3d/{,privacy,terms,support}.html` (Cloudflare in
front; no DNS or certificate work needed for new files in the vhost).

Never run `public-site/harden-vps.sh` on that host — it is shared with mail,
MariaDB, Redis and several Docker tenants. The hardening script is only for a
dedicated game VPS.

| Variable | Default |
|---|---|
| `VPS_HOST` (required) | — |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` |
| `VPS_PATH` | `/var/www/zikaron3d` (zmz.ca: `/www/wwwroot/zmz.ca/zikaron3d`) |
| `CADDY_PATH` | `/etc/caddy/Caddyfile` |
| `VPS_SSH_KEY` | agent/default key |
| `VPS_SKIP_CADDY` | unset — set to `1` when nginx/aaPanel already serves the path |
| `VPS_OWNER` | unset — e.g. `www:www`, applied with `chown -R` after upload |
| `VPS_PUBLIC_URL` | unset — base URL printed at the end (e.g. `https://zmz.ca/zikaron3d`) |

`--domain <name>` rewrites the Caddy site block (dedicated-Caddy hosts only).

## 4. Order of operations for a release

1. `node scripts/deploy/deploy-backend.mjs`
2. `node scripts/deploy/verify-live.mjs`
3. `node scripts/deploy/deploy-site.mjs --domain <domain> --harden`
4. Create the products/offering in App Store Connect + RevenueCat
   (`APP_STORE_CONNECT_CHECKLIST.md` §5 and §10), point the webhook at
   `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`.
5. `npx eas-cli@latest build --platform ios --profile production` → TestFlight, then run
   `TESTFLIGHT_TEST_PLAN.md`.
