# Deploy Frontend On Existing Multi-Domain VPS (nginx + Next.js)

Use this when you already host multiple domains on one VPS and want Driver Tracker to run on its own domain, without changing existing vhosts.

## Summary

- Browser origin: `https://<driver-tracker-domain>`
- Frontend process: Next.js standalone server on `127.0.0.1:3000` (systemd)
- nginx: terminates TLS, serves PWA static assets, proxies everything else to the Next.js server
- API: proxied from the frontend origin via either nginx (`/api/*`) or Next.js rewrites

## DNS

Point the domain at your VPS public IP (A/AAAA). If you use Cloudflare, enable the proxy (orange cloud) and copy your existing real-IP stanza into the new vhost.

## Build And Stage Runtime Files

On the VPS, build the frontend:

```bash
cd /path/to/driver_tracker/frontend
npm ci
npm run build
```

Create a runtime directory (mirroring the domain keeps vhosts tidy):

```bash
sudo mkdir -p /var/www/<driver-tracker-domain>/app
```

Copy standalone artifacts:

```bash
sudo rsync -a --delete .next/standalone/ /var/www/<driver-tracker-domain>/app/
sudo rsync -a --delete .next/static/ /var/www/<driver-tracker-domain>/app/.next/static/
sudo rsync -a --delete public/ /var/www/<driver-tracker-domain>/app/public/
```

Ensure ownership matches your VPS conventions (often `nginx:nginx` or `www-data:www-data`):

```bash
sudo chown -R nginx:nginx /var/www/<driver-tracker-domain>
```

## Environment Variables

Set these on the systemd service:

- `NEXT_PUBLIC_API_URL=https://<driver-tracker-domain>/api` (browser-facing, same-origin)
- `INTERNAL_API_URL=https://<backend-host>/api` (server-side rewrite target; can be public or private)

If you proxy `/api` in nginx directly to the backend, `INTERNAL_API_URL` can be omitted.

## systemd

Install the unit template from `docs/templates/driver-tracker-frontend.service` as:

- `/etc/systemd/system/driver-tracker-frontend.service`

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now driver-tracker-frontend
sudo systemctl status driver-tracker-frontend --no-pager
```

## nginx (new vhost in conf.d)

Create:

- `/etc/nginx/conf.d/<driver-tracker-domain>.conf`

Start from `docs/templates/nginx-driver-tracker-frontend.conf` and:

- Set `server_name`
- Set `$driver_tracker_root` to your runtime directory
- Copy your existing Cloudflare real-IP stanza (if applicable)
- Decide whether nginx should proxy `/api/` to the backend (recommended for simplicity)

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## TLS (Certbot)

Once DNS resolves to your VPS, provision TLS:

```bash
sudo certbot --nginx -d <driver-tracker-domain> -d www.<driver-tracker-domain>
```

## Verification

```bash
curl -I https://<driver-tracker-domain>/
curl -I https://<driver-tracker-domain>/manifest.json
curl -I https://<driver-tracker-domain>/sw.js
curl -I https://<driver-tracker-domain>/_next/static/
curl -I https://<driver-tracker-domain>/api/health
```

In a browser:

- Confirm login works
- Confirm the PWA installs and `Application -> Service Workers` shows the worker as active
- Confirm subsequent API calls use same-origin cookies

