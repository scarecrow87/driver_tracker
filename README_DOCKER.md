# Docker Compose Development Setup

## Overview
This project includes a `docker-compose.dev.yaml` file for running the full Driver Tracker stack locally with a production-like architecture using Nginx to serve the Next.js frontend.

## Architecture
- **Frontend** (Next.js PWA): Served via Nginx on port 3000, container port 80
- **Backend** (Node.js/Express API): Running on port 3001 
- **Database** (PostgreSQL 15): Running on port 5432

## Services

### Frontend (driver_tracker_frontend)
- Nginx serves static assets from `/app/.next/static/`
- Next.js standalone server runs on port 3000 (internal to container)
- Nginx proxies dynamic requests to Next.js server
- Browser connects to `http://localhost:3000`

### Backend (driver_tracker_backend)  
- Express API server
- Connects to PostgreSQL database
- Runs on `http://localhost:3001`

### Database (driver_tracker_db)
- PostgreSQL 15 Alpine
- Persistent volume: `postgres_data`
- Health check ensures DB is ready before backend starts

## Files Created/Modified

### New Files
- `docker-compose.dev.yaml` - Development stack definition
- `frontend/Dockerfile` - Multi-stage Next.js + Nginx build
- `frontend/nginx.conf` - Nginx configuration for Next.js
- `frontend/docker-entrypoint.sh` - Container startup script
- `.dockerignore` - Excludes node_modules, .next, etc. from Docker builds

### Modified Files  
- `backend/Dockerfile` - Fixed build paths for project-root context
- `docker-compose.yml` - Updated backend build context (consistency)
- `frontend/package.json` - Added `@types/leaflet` dependency

## Usage

### Start all services
```bash
docker compose -f docker-compose.dev.yaml up -d --build
```

### Stop all services
```bash
docker compose -f docker-compose.dev.yaml down
```

### View logs
```bash
docker compose -f docker-compose.dev.yaml logs -f [service]
```

### Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: localhost:5432

### Test credentials
- Superuser: superuser@example.com / super123
- Admin: admin@example.com / admin123  
- Driver: driver@example.com / driver123

### Run database seed
```bash
docker compose -f docker-compose.dev.yaml exec backend npx prisma db seed
```

## Known Issues

### Authentication

The backend owns authentication. `/api/auth/login` sets a `driver_tracker_session` HTTP-only cookie, and nginx keeps frontend/API traffic on the same browser origin.

## Network Configuration

### Separate Origins
The setup uses separate origins for frontend and backend:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

**Rationale:**
- Mirrors production deployment (different domains)
- Backend must have CORS enabled for frontend origin
- Frontend calls backend directly via `NEXT_PUBLIC_API_URL`

### Internal Docker Networking
- Frontend container calls backend via `http://backend:3001` (Docker service name)
- Browser calls backend via `http://localhost:3001` 
- Database accessible internally via service name `db`

## Environment Variables

### Frontend (.env or docker-compose)
- `NEXT_PUBLIC_API_URL` - Backend API base URL (default: `http://localhost:3001/api`)
- `INTERNAL_API_URL` - Server-side backend API base URL for Docker (default: `http://backend:3001/api`)
- `NEXTAUTH_SECRET` - Backend JWT signing secret (required)
- `AUTH_COOKIE_SECURE` - Set `false` for local HTTP, `true` behind HTTPS
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` - Browser push notification configuration

### Backend (.env or docker-compose)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (default: `production`)

### Docker Compose (.env or defaults)
- `POSTGRES_USER` - Database user (default: `postgres`)
- `POSTGRES_PASSWORD` - Database password (default: `password`)
- `POSTGRES_DB` - Database name (default: `driver_tracker`)
- `NEXTAUTH_SECRET` - Backend JWT signing secret (required)

## Verification Steps

1. All Docker images build without errors ✓
2. Frontend accessible at http://localhost:3000 ✓
3. Static assets (JS, CSS) load correctly ✓
4. Backend API responds at http://localhost:3001 ✓
5. Database health check passes ✓
6. Pages render without errors ✓
7. Authentication should be verified after rebuilding the frontend container

## Build Information

- Next.js: 14.2.35
- Node.js: 20.20.2
- Nginx: 1.28.3
- PostgreSQL: 15 Alpine
- React: 18.3.1

## Troubleshooting

### Login does not persist
Confirm `AUTH_COOKIE_SECURE=false` for local HTTP testing. Use `AUTH_COOKIE_SECURE=true` only when the public app URL is HTTPS.

### Database connection errors
Ensure the database container is healthy before making API calls:
```bash
docker compose -f docker-compose.dev.yaml ps
```

### Static files 404
Verify Nginx configuration is correct and the static files exist in `/app/.next/static/`.

### Port conflicts
Stop any services using ports 3000, 3001, or 5432 on your host machine.

## Next Steps

To verify authentication:
1. Rebuild and restart the frontend container
2. Confirm backend login works at `http://localhost:3001/api/auth/login`
3. Confirm backend cookie login works through frontend origin at `http://localhost:3000/api/auth/login`
4. Login at `http://localhost:3000/login`

For production deployment, see `docs/deployment-coolify.md` or `docs/azure-deployment.md`.
