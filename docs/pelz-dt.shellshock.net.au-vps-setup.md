# VPS Setup: `pelz-dt.shellshock.net.au` (nginx + Next.js standalone + Let’s Encrypt)

This guide deploys the **Driver Tracker frontend** as a Next.js standalone server on `127.0.0.1:3000`, fronted by nginx for:

- TLS termination (Let’s Encrypt / Certbot)
- Static PWA assets (`/manifest.json`, `/sw.js`, `/_next/static/*`)
- Proxy `/api/*` to the backend over VPN/WireGuard

## Target Assumptions

- VPS public IP: `20.167.41.239`
- SSH user: `shellshock`
- Hostname: `pelz-dt.shellshock.net.au`
- Backend reachable from VPS (VPN/WireGuard): `http://192.168.0.52:3001/api`
- systemd is present
- nginx user/group is `nginx:nginx` (adjust if your distro uses `www-data`)
- Runtime directory: `/var/www/pelz-dt.shellshock.net.au/app`
- Build checkout directory: `/home/shellshock/driver_tracker_deploy/frontend`
- Backup root: `/home/shellshock/driver-tracker-backups`

## 1) Prereqs On The VPS

Install:

- nginx
- Node.js 20+
- npm
- rsync
- certbot + nginx plugin (package name varies by distro; often `python3-certbot-nginx`)

On the deployed Debian 12 VPS, Debian's default `nodejs` package was Node 18, so Node 20 was installed from NodeSource:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg rsync
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

The VPS had pre-existing apt signature warnings for the nginx.org and Sury PHP repositories. Node 20 installation completed successfully despite those unrelated warnings.

## 2) DNS + Firewall

- Create an **A record** for `pelz-dt.shellshock.net.au` → `20.167.41.239`
- Allow inbound `80/tcp` and `443/tcp` to the VPS (Azure NSG / firewall)

## 3) Build Next.js Standalone (on VPS)

If deploying from a local Windows checkout, archive only the frontend source and upload it:

```powershell
tar --exclude=frontend/.next --exclude=frontend/node_modules --exclude=frontend/.env.local --exclude=frontend/.env.production -czf driver_tracker_frontend_src.tgz frontend
pscp -batch -i C:\projects\mindy.ppk C:\projects\driver_tracker\driver_tracker_frontend_src.tgz shellshock@20.167.41.239:/home/shellshock/driver_tracker_frontend_src.tgz
```

On the VPS:

```bash
rm -rf /home/shellshock/driver_tracker_deploy
mkdir -p /home/shellshock/driver_tracker_deploy
tar -xzf /home/shellshock/driver_tracker_frontend_src.tgz -C /home/shellshock/driver_tracker_deploy
```

In `frontend/`, create `frontend/.env.production`:

```bash
NEXT_PUBLIC_API_URL=https://pelz-dt.shellshock.net.au/api
INTERNAL_API_URL=http://192.168.0.52:3001/api
```

Build:

```bash
cd /path/to/driver_tracker/frontend
npm ci
npm run build
```

Stage runtime files:

```bash
sudo mkdir -p /var/www/pelz-dt.shellshock.net.au/app
sudo rsync -a --delete .next/standalone/ /var/www/pelz-dt.shellshock.net.au/app/
sudo rsync -a --delete .next/static/ /var/www/pelz-dt.shellshock.net.au/app/.next/static/
sudo rsync -a --delete public/ /var/www/pelz-dt.shellshock.net.au/app/public/
sudo chown -R nginx:nginx /var/www/pelz-dt.shellshock.net.au
```

## Backups Before Changing VPS Files

Before installing or replacing nginx/systemd/runtime files, create a timestamped backup:

```bash
ts=$(date -u +%Y%m%dT%H%M%SZ)
backup=/home/shellshock/driver-tracker-backups/$ts
sudo mkdir -p "$backup"
{
  echo backup_timestamp=$ts
  echo nginx_conf=/etc/nginx/conf.d/pelz-dt.shellshock.net.au.conf
  echo systemd_service=/etc/systemd/system/driver-tracker-frontend.service
  echo runtime_dir=/var/www/pelz-dt.shellshock.net.au
  echo deploy_dir=/home/shellshock/driver_tracker_deploy
} | sudo tee "$backup/manifest.txt" >/dev/null
sudo cp -a /etc/nginx/nginx.conf "$backup/nginx.conf"
sudo cp -a /etc/nginx/conf.d "$backup/conf.d"
sudo test -e /etc/nginx/conf.d/pelz-dt.shellshock.net.au.conf && sudo cp -a /etc/nginx/conf.d/pelz-dt.shellshock.net.au.conf "$backup/pelz-dt.shellshock.net.au.conf"
sudo test -e /etc/systemd/system/driver-tracker-frontend.service && sudo cp -a /etc/systemd/system/driver-tracker-frontend.service "$backup/driver-tracker-frontend.service"
sudo test -e /var/www/pelz-dt.shellshock.net.au && sudo rsync -a /var/www/pelz-dt.shellshock.net.au/ "$backup/var-www-pelz-dt.shellshock.net.au/"
sudo chown -R shellshock:shellshock /home/shellshock/driver-tracker-backups
```

The initial deployment backup was created at:

```text
/home/shellshock/driver-tracker-backups/20260504T120142Z
```

## 4) systemd Service

Start from `docs/templates/pelz-dt.shellshock.net.au-driver-tracker-frontend.service` and install it as:

- `/etc/systemd/system/driver-tracker-frontend.service`

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now driver-tracker-frontend
sudo systemctl status driver-tracker-frontend --no-pager
```

## 5) nginx Vhost

Start from `docs/templates/pelz-dt.shellshock.net.au.conf` and install it as:

- `/etc/nginx/conf.d/pelz-dt.shellshock.net.au.conf`

If Cloudflare proxying is enabled, copy the same **real-IP stanza** you use on other vhosts (for example `shellshockcomputer.com.au`) into the `server { ... }` block. The included template already matches the current `shellshockcomputer.com.au` Cloudflare ranges.

If Cloudflare SSL mode is **Flexible**, do not enable an nginx HTTP-to-HTTPS redirect on this vhost. Cloudflare will connect to the origin over HTTP and a forced origin redirect can produce a same-URL redirect loop.

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6) TLS (Let’s Encrypt / Certbot)

Once DNS resolves publicly:

```bash
sudo certbot --nginx -d pelz-dt.shellshock.net.au
```

On the initial deployment, Certbot added a second HTTP server block that forced `80 -> 443`. That was removed because the zone was behaving like Cloudflare Flexible SSL and produced a same-URL redirect loop through Cloudflare. If Cloudflare is later switched to **Full (strict)** for this hostname or zone, an origin HTTP-to-HTTPS redirect can be reintroduced deliberately.

## Verification

On the VPS:

```bash
sudo systemctl status driver-tracker-frontend --no-pager
sudo nginx -t
```

From anywhere:

```bash
curl -I https://pelz-dt.shellshock.net.au/
curl -I https://pelz-dt.shellshock.net.au/manifest.json
curl -I https://pelz-dt.shellshock.net.au/sw.js
curl -I https://pelz-dt.shellshock.net.au/api/push/public-key
```

Login/session verification:

```bash
rm -f /tmp/pelz-cookie.txt
printf %s '{"email":"superuser@example.com","password":"super123"}' \
  | curl -sS -c /tmp/pelz-cookie.txt https://pelz-dt.shellshock.net.au/api/auth/login \
      -H "Content-Type: application/json" \
      -d @-
curl -i -b /tmp/pelz-cookie.txt https://pelz-dt.shellshock.net.au/api/auth/me
rm -f /tmp/pelz-cookie.txt
```

Expected result: login returns `200`, and `/api/auth/me` returns `200` with the logged-in user when using a valid active account.
