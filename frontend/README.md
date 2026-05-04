# Driver Tracker Frontend

Frontend-only deployment for Driver Tracker PWA. This project is split from the main Driver Tracker application to allow separate deployment on a different server.

## Architecture

- **Frontend**: Next.js 14 (standalone output) - serves UI only
- **Backend**: Proxied under the same public origin at `/api`
- **Authentication**: Backend-issued HTTP-only session cookie

## Setup

1. **Install dependencies**

```bash
cd frontend
npm install
```

2. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` with your values:

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

### Option 1: Direct Node.js

```bash
# Copy standalone output to server
scp -r .next/standalone user@server:/var/www/driver-tracker-frontend/
scp -r .next/static user@server:/var/www/driver-tracker-frontend/.next/static
scp -r public user@server:/var/www/driver-tracker-frontend/

# Start
cd /var/www/driver-tracker-frontend
node server.js
```

### Option 2: Nginx

See `docs/nginx-frontend-config.md` for sample nginx configuration.

### Option 3: Cloudflare Pages

1. Build output: `.next/standalone/`
2. Set `NEXT_PUBLIC_API_URL` environment variable
3. Deploy as Cloudflare Pages function

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `INTERNAL_API_URL` | Server-side backend API base URL for rewrites |

## API Calls

All API calls are proxied to the backend server. The frontend uses `src/lib/api.ts` for fetching data.

## PWA Notifications

Browser push requires HTTPS outside localhost. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the backend, then enable browser push for the current device from the superuser notification settings page.

## Troubleshooting

- **Login fails**: Ensure nginx proxies `/api/*` to the backend and backend `NEXTAUTH_SECRET` is set
- **API errors**: Check `NEXT_PUBLIC_API_URL` is correct
- **Session not persisting**: Verify cookies are allowed
