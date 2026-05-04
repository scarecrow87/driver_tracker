# Frontend VPS Nginx + WireGuard Deployment

Use this when the frontend runs on a plain VPS with only nginx, and the backend is reached over a WireGuard private network.

If you are deploying onto an existing multi-domain VPS (nginx `conf.d` style), use `docs/frontend-vps-nginx-multidomain.md` instead.

## Summary

- Public browser origin: `https://<frontend-host>`
- Frontend process: Next.js standalone server on `127.0.0.1:3000`
- nginx: terminates TLS, serves the frontend, proxies `/api/*` to the backend over WireGuard
- Backend: private-only on WireGuard, still issues the HTTP-only session cookie

This keeps login same-origin for the browser, avoids CORS for normal app traffic, and keeps the PWA service worker paths under the frontend origin.

## Build On The VPS

Install Node.js 20, nginx, and the usual build tools on the frontend VPS.

Create `frontend/.env.production`:

```bash
NEXT_PUBLIC_API_URL=https://<frontend-host>/api
INTERNAL_API_URL=http://<backend-wireguard-ip>:3001/api
```

Build the frontend on the VPS:

```bash
cd frontend
npm ci
npm run build
```

Copy the standalone output into a runtime directory:

```bash
sudo mkdir -p /var/www/driver-tracker-frontend
sudo rsync -a .next/standalone/ /var/www/driver-tracker-frontend/
sudo rsync -a .next/static/ /var/www/driver-tracker-frontend/.next/static/
sudo rsync -a public/ /var/www/driver-tracker-frontend/public/
```

## Systemd Service

Create `/etc/systemd/system/driver-tracker-frontend.service`:

```ini
[Unit]
Description=Driver Tracker Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/driver-tracker-frontend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=https://<frontend-host>/api
Environment=INTERNAL_API_URL=http://<backend-wireguard-ip>:3001/api

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now driver-tracker-frontend
```

## nginx

Use the host nginx config in `frontend/docs/nginx-frontend-config.md` for the VPS site block.

The important part is:

- nginx listens on `80` and `443`
- it proxies `/api/` to `http://<backend-wireguard-ip>:3001/api/`
- it serves `sw.js`, `workbox-*.js`, `worker-*.js`, and `manifest.json` from the frontend `public/` directory
- it proxies everything else to `http://127.0.0.1:3000`

## Backend Settings

Set these on the backend service:

```bash
AUTH_COOKIE_SECURE=true
VAPID_PUBLIC_KEY=<web-push-public-key>
VAPID_PRIVATE_KEY=<web-push-private-key>
VAPID_SUBJECT=mailto:admin@example.com
```

`NEXTAUTH_SECRET` remains the shared JWT signing secret for the backend-issued session cookie.

## WireGuard Assumptions

- WireGuard provides a stable backend address that nginx can reach from the frontend VPS.
- Replace `<backend-wireguard-ip>` everywhere once the tunnel is established.
- The browser should never call the backend directly; it should only talk to the frontend origin.

## Verification

```bash
curl -I https://<frontend-host>/
curl -I https://<frontend-host>/manifest.json
curl -I https://<frontend-host>/sw.js
curl -i -X POST https://<frontend-host>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"driver@example.com","password":"driver123"}'
```

The login response should include `Set-Cookie: driver_tracker_session=...`, and `GET /api/auth/me` through the same frontend origin should succeed with that cookie.
