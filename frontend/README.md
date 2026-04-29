# Driver Tracker Frontend

Frontend-only deployment for Driver Tracker PWA. This project is split from the main Driver Tracker application to allow separate deployment on a different server.

## Architecture

- **Frontend**: Next.js 14 (standalone output) - serves UI only
- **Backend**: Separate API server at `https://api.pelz-dt.shellshock.net.au`
- **Authentication**: NextAuth.js with session cookies

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
NEXTAUTH_URL=https://api.pelz-dt.shellshock.net.au
NEXTAUTH_SECRET=<same-secret-as-backend>
NEXT_PUBLIC_API_URL=https://api.pelz-dt.shellshock.net.au/api
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
| `NEXTAUTH_URL` | Backend API URL for auth |
| `NEXTAUTH_SECRET` | Session secret (must match backend) |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

## API Calls

All API calls are proxied to the backend server. The frontend uses `src/lib/api.ts` for fetching data.

## CORS

The backend must allow CORS from the frontend domain (`https://pelz-dt.shellshock.net.au`).

## Troubleshooting

- **Login fails**: Ensure `NEXTAUTH_SECRET` matches backend
- **API errors**: Check `NEXT_PUBLIC_API_URL` is correct
- **Session not persisting**: Verify cookies are allowed