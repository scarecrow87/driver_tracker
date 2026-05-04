# Docker Compose Development Setup - Implementation Summary

## Issue: Authentication Broken

**Status:** The Docker Compose setup is functional. The first authentication fix is to bind the App Router NextAuth route to the configured `authOptions`.

### Symptoms
- Login via frontend returns HTTP 500
- Error in Next.js server logs: `TypeError: Cannot read properties of undefined (reading 'secret')`
- Stack trace points to NextAuth JWT handler (`/app/.next/server/chunks/571.js`)
- Affects: `/api/auth/callback/credentials` and JWT session signing

### Likely Root Cause
The auth route imported `authOptions` but exported raw `NextAuth`. That meant `/api/auth/*` ran without the credentials provider, JWT callbacks, or explicit secret configuration. Verify this fix before migrating away from JWT sessions or standalone output.

### Investigation Results
Recommended checks:

1. Confirm `frontend/src/app/api/auth/[...nextauth]/route.ts` uses `const handler = NextAuth(authOptions)`
2. Confirm `authOptions.secret` reads `process.env.NEXTAUTH_SECRET`
3. Confirm Docker provides `INTERNAL_API_URL=http://backend:3001/api` for server-side auth calls
4. Rebuild the frontend container before retesting

### Solutions (Recommended in Priority Order)

#### Option 1: Bind the NextAuth Handler (Recommended)
Pass `authOptions` into `NextAuth` in the route handler:
```typescript
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

#### Option 2: Use Database Sessions
If the bound-handler fix fails, remove JWT strategy and use NextAuth's database session management with the Prisma adapter.

#### Option 3: Disable Standalone Output
Use `next start` instead of standalone output as a comparison test.

#### Option 4: Use NextAuth 5.x
Upgrade only after confirming the v4 configuration is actually bound and still failing.

## Implementation Details

### Files Created
1. **`docker-compose.dev.yaml`** - Development stack with frontend (Nginx+Next.js), backend (Node/Express), database (PostgreSQL)
2. **`frontend/Dockerfile`** - Multi-stage build: Node builder + runtime with Nginx
3. **`frontend/nginx.conf`** - Nginx config serving static assets + proxying to Next.js
4. **`frontend/docker-entrypoint.sh`** - Starts Nginx + Next.js server
5. **`.dockerignore`** - Excludes node_modules, .next, etc. from Docker context

### Files Modified
1. **`backend/Dockerfile`** - Fixed `COPY` paths for project-root build context
2. **`docker-compose.yml`** - Updated backend build context consistency  
3. **`frontend/package.json`** - Added `@types/leaflet` for TypeScript
4. **`frontend/src/lib/auth.ts`** - Modified `authorize` to use `INTERNAL_API_URL` for internal calls
5. **`frontend/src/app/api/auth/[...nextauth]/route.ts`** - Bound NextAuth to `authOptions`

### Key Implementation Notes

#### Separate Origins Architecture
- Frontend (port 3000) and backend (port 3001) run as separate Docker services
- Browser calls backend directly via `NEXT_PUBLIC_API_URL` (CORS enabled)
- Frontend container calls backend internally via `INTERNAL_API_URL`
- Matches production multi-domain deployment pattern

#### Nginx + Next.js Setup
- Nginx serves static assets (`/_next/static/`, `/*.css`, `/*.js`) with caching
- Nginx proxies SSR/hydration requests to Next.js (port 3000)
- Next.js runs in standalone mode for smaller image size

#### Database Seeding
- PostgreSQL seeded with test users and locations
- Credentials: `driver@example.com` / `driver123`
- Seed runs automatically on container startup if `AUTO_SEED_ON_EMPTY_DB=true`

## Verification Results

✅ Docker images build successfully  
✅ All containers start and health checks pass  
✅ Frontend accessible at http://localhost:3000  
✅ Static assets (JS, CSS) load correctly  
✅ Backend API responds at http://localhost:3001  
✅ Database seeded with test data  
✅ Database connection verified  
Authentication must be retested after the frontend image is rebuilt.

## Known Limitations

1. **Authentication requires verification** - Rebuild frontend before retesting
2. **No HTTPS** - HTTP only for local development
3. **Development mode** - Uses production build for realistic testing but lacks dev hot-reload
4. **Shared secrets** - Default secrets should be changed for production

## Quick Start

```bash
# Start all services
docker compose -f docker-compose.dev.yaml up -d --build

# Wait for healthy status
docker compose -f docker-compose.dev.yaml ps

# Access application
open http://localhost:3000

# View logs
docker compose -f docker-compose.dev.yaml logs -f

# Stop services
docker compose -f docker-compose.dev.yaml down
```

## Testing Without Auth

Since auth is broken, test backend APIs directly:
```bash
# Get locations (unauthorized - returns 401)
curl http://localhost:3001/api/locations

# Login (returns JWT token)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"driver@example.com","password":"driver123"}'
```

## Next Steps

To verify authentication:
1. Rebuild and restart the frontend container
2. POST to `http://localhost:3001/api/auth/login`
3. POST to `http://localhost:3000/api/auth/callback/credentials`
4. Login in the browser at `http://localhost:3000/login`

See individual service READMEs for more details:
- `docs/deployment-coolify.md`
- `docs/azure-deployment.md`
- `docs/api-reference.md`
