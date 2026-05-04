# Driver Tracker Frontend

Frontend-only deployment for the Driver Tracker PWA. This project is split from the main Driver Tracker application so it can run on a plain VPS with nginx.

## Architecture

- **Frontend**: Next.js 14 standalone output on the VPS
- **Edge**: nginx terminates HTTPS and proxies `/api` to the backend over WireGuard
- **Authentication**: Backend-issued HTTP-only session cookie

## Setup

1. **Install dependencies**

```bash
cd frontend
npm install
```

2. **Configure environment**

Create `frontend/.env.production` with your values:

```bash
NEXT_PUBLIC_API_URL=https://driver-tracker.example.com/api
INTERNAL_API_URL=http://backend-host:3001/api
```

3. **Build**

```bash
npm run build
```

Output will be in `.next/standalone/`.

## Deployment

### VPS + nginx

Use [docs/frontend-vps-nginx-wireguard.md](../docs/frontend-vps-nginx-wireguard.md) for the full plain-VPS setup, including the systemd unit, nginx site block, and backend WireGuard proxy.

### Direct Node.js

```bash
# Copy standalone output to server
scp -r .next/standalone user@server:/var/www/driver-tracker-frontend/
scp -r .next/static user@server:/var/www/driver-tracker-frontend/.next/static
scp -r public user@server:/var/www/driver-tracker-frontend/

# Start
cd /var/www/driver-tracker-frontend
node server.js
```

### Nginx

See [docs/nginx-frontend-config.md](docs/nginx-frontend-config.md) for the nginx site block used by the VPS deployment.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Public browser API base URL, usually `https://<frontend-host>/api` |
| `INTERNAL_API_URL` | Server-side backend API base URL for rewrites, usually `http://<backend-wireguard-ip>:3001/api` |

## API Calls

Browser requests should stay on the frontend origin and use `/api/*`. Server-side rewrites should point at the backend WireGuard address.

## PWA Notifications

Browser push requires HTTPS outside localhost. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the backend, then enable browser push for the current device from the superuser notification settings page.

## Troubleshooting

- **Login fails**: Ensure nginx proxies `/api/*` to the backend WireGuard address and `AUTH_COOKIE_SECURE=true` is set on the backend
- **API errors**: Check `NEXT_PUBLIC_API_URL` is the public frontend origin plus `/api`
- **Session not persisting**: Verify the frontend is served over HTTPS and cookies are allowed
