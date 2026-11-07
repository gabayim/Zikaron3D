# Zikaron3D public site (privacy, terms, support, marketing)

These pages are **live on the zmz.ca host** (aaPanel/nginx at `/www/wwwroot/zmz.ca`,
served through Cloudflare) under the `/zikaron3d/` path. They are the App Store
Connect **Privacy Policy URL**, **Support URL** and **Marketing URL**, and the same
pages the app opens from Settings and the Shop footer (`src/legal.ts`, overridable
with `EXPO_PUBLIC_SITE_URL`).

| File | Purpose | Live URL |
|---|---|---|
| `index.html` | Marketing page | `https://zmz.ca/zikaron3d/` |
| `privacy.html` | Privacy policy incl. COPPA / GDPR-K children's section | `https://zmz.ca/zikaron3d/privacy.html` |
| `terms.html` | Terms of use (virtual items, refunds, parental responsibility) | `https://zmz.ca/zikaron3d/terms.html` |
| `support.html` | Support / contact + FAQ (restore, deletion, TOYBOX) | `https://zmz.ca/zikaron3d/support.html` |
| `Caddyfile` | Site block for a **dedicated** Caddy host (not used on zmz.ca) | — |
| `harden-vps.sh` | Hardening for a **dedicated** VPS (not for the zmz.ca host) | — |

## 1. Where it is hosted

- The `zmz.ca` vhost belongs to the aaPanel/nginx install on the shared production
  host (`root /www/wwwroot/zmz.ca`), with TLS terminated for Cloudflare.
- The game's pages live in `/www/wwwroot/zmz.ca/zikaron3d/` (owner `www:www`).
- No vhost edits are needed: nginx serves the static files and the site's rewrite
  config is empty, so a plain subfolder just works.

> **Do not** run `harden-vps.sh` on the zmz.ca host. It is shared infrastructure
> (mail, MariaDB, Redis, several Docker tenants); `ufw` would cut off mail/FTP and
> the panel ports. Only use it on a dedicated VPS that serves nothing else.

If the pages are ever moved to a dedicated VPS instead, `Caddyfile` +
`harden-vps.sh` are the standalone path: point an `A`/`AAAA` record at that host,
deploy, and the Caddy site block obtains its certificate automatically.

## 2. Harden a dedicated VPS (optional, not zmz.ca)

```bash
sudo bash harden-vps.sh
```

Idempotent: `ufw` (22/80/443 only), keys-only SSH, `fail2ban` sshd jail,
`unattended-upgrades`, and a daily backup cron. Requires your SSH key to be
installed first, or it refuses to run.

## 3. Deploy the pages

```powershell
# from the repo root — publishes into the zmz.ca docroot, leaves nginx untouched
$env:VPS_HOST    = "new-vps"                     # ssh alias (or the IP)
$env:VPS_PATH    = "/www/wwwroot/zmz.ca/zikaron3d"
$env:VPS_SKIP_CADDY = "1"                          # nginx/aaPanel already serves it
$env:VPS_OWNER   = "www:www"
node scripts/deploy/deploy-site.mjs --dry-run
node scripts/deploy/deploy-site.mjs
```

That is equivalent to:

```bash
mkdir -p /www/wwwroot/zmz.ca/zikaron3d
scp public-site/{index,privacy,terms,support}.html root@62.84.178.215:/www/wwwroot/zmz.ca/zikaron3d/
ssh root@62.84.178.215 'chown -R www:www /www/wwwroot/zmz.ca/zikaron3d'
```

Cloudflare proxies `zmz.ca` to this host, so no DNS or certificate change is
needed for new files under the vhost. The app must be built with
`EXPO_PUBLIC_SITE_URL=https://zmz.ca/zikaron3d` (already the default in
`src/legal.ts`) so Settings/Shop open the same pages.

## 4. Support email

`support@zmz.ca` is the address used in the app, the store listing and the privacy
policy; it is served by the existing Postfix/Dovecot setup on this host (the same
mailbox the ZMZ site already advertises). If you prefer a dedicated alias, add
`zikaron3d@zmz.ca` as an alias to `support@zmz.ca` in the panel's mail aliases.

## 5. Backups

The pages are static files inside the vhost, so they are covered by whatever panel
backup policy `/www/wwwroot` already has. Copy the four files somewhere else too:

```bash
tar -czf /var/backups/zikaron3d-site-$(date +%F).tar.gz -C /www/wwwroot/zmz.ca zikaron3d
```

The app itself does not depend on the site being up — only the store listing links
and the in-app legal links do.

## 6. Verify

```bash
curl -sI https://zmz.ca/zikaron3d/privacy.html   # 200 + HSTS
curl -sI http://zmz.ca/zikaron3d/privacy.html     # 301 to https
curl -s  https://zmz.ca/zikaron3d/support.html | grep -i support@zmz.ca
# origin check without Cloudflare:
curl -sk --resolve zmz.ca:443:62.84.178.215 https://zmz.ca/zikaron3d/ | grep -i '<title>'
```

Last verified: 2026-11-07 — all four pages return 200 both at the origin and
through Cloudflare.

Then set in App Store Connect: Privacy Policy URL `…/privacy.html`, Support URL
`…/support.html`, Marketing URL `…/` (see `APP_STORE_CONNECT_CHECKLIST.md`).
