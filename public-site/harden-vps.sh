#!/usr/bin/env bash
# Zikaron3D VPS hardening — idempotent, safe to re-run.
#
#   sudo bash harden-vps.sh
#
# Installs: ufw (22/80/443 only), hardened sshd (keys only), fail2ban,
# unattended security upgrades, and a daily backup of the site + Caddy config.
# Requires an SSH key to already be installed for a non-root admin user, or you
# will lock yourself out when password auth is disabled.
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/zikaron3d}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/zikaron3d}"
ADMIN_USER="${ADMIN_USER:-${SUDO_USER:-root}}"
SSHD_HARDENING=/etc/ssh/sshd_config.d/99-zikaron3d.conf

log() { printf '\n==> %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo bash harden-vps.sh)." >&2
  exit 1
fi

if [[ ! -s "/home/${ADMIN_USER}/.ssh/authorized_keys" && $ADMIN_USER != root ]] \
  && [[ ! -s /root/.ssh/authorized_keys ]]; then
  echo "No authorized_keys found for ${ADMIN_USER} or root." >&2
  echo "Install your SSH key first, otherwise key-only login locks you out." >&2
  exit 1
fi

log "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades apt-listchanges rsync

log "Firewall (22/80/443 only)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

log "SSH hardening (keys only, no root password login)"
mkdir -p /etc/ssh/sshd_config.d
cat > "$SSHD_HARDENING" <<'EOF'
# Managed by public-site/harden-vps.sh
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
MaxAuthTries 4
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
if command -v sshd >/dev/null 2>&1 && sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  echo "sshd config test failed or sshd missing; review $SSHD_HARDENING" >&2
fi

log "fail2ban (sshd jail)"
cat > /etc/fail2ban/jail.d/zikaron3d.local <<'EOF'
[DEFAULT]
bantime  = 10m
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban
fail2ban-client status sshd || true

log "Unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades || true

log "Site directory and daily backups"
mkdir -p "$SITE_ROOT" "$BACKUP_DIR"
chown -R www-data:www-data "$SITE_ROOT" 2>/dev/null || true

cat > /usr/local/bin/zikaron3d-backup <<EOF
#!/usr/bin/env bash
# Tar the site and Caddy config; keep 14 days.
set -euo pipefail
stamp=\$(date +%F)
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/site-\$stamp.tar.gz" -C / "$SITE_ROOT" etc/caddy 2>/dev/null || true
chmod 600 "$BACKUP_DIR"/*.tar.gz 2>/dev/null || true
find "$BACKUP_DIR" -name 'site-*.tar.gz' -mtime +14 -delete
EOF
chmod 750 /usr/local/bin/zikaron3d-backup

cat > /etc/cron.d/zikaron3d-backup <<EOF
# Daily site + Caddy backup (installed by harden-vps.sh)
17 3 * * * root /usr/local/bin/zikaron3d-backup
EOF
chmod 644 /etc/cron.d/zikaron3d-backup

log "Done. Next: deploy public-site/ (see README.md) and verify HTTPS."
