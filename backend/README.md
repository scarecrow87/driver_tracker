# Driver Tracker Backend

Backend API for Driver Tracker. This service is now split from the frontend and runs independently.

## Features
- RESTful API for locations, check-ins, and admin operations
- JWT-based authentication and role-based access control
- Rate limiting, CORS, and security headers
- PostgreSQL database (via Prisma)
- Dockerized for local and production use

## Quick Start (Docker)

1. **Copy environment file**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your secrets (at minimum `DATABASE_URL`, `NEXTAUTH_SECRET`).

2. **Start services**
   ```bash
   docker compose up -d
   ```
   The backend container will wait for the database to be healthy before starting.

3. **Open the API**
   Visit [http://localhost:3001/api/locations](http://localhost:3001/api/locations) (requires JWT auth).

## Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15 (or use Docker)

### Setup
```bash
cd backend
npm install
```

### Build and Run
```bash
npm run build
npm start
```

### Environment Variables
See `.env.example` for all supported variables.

## Architecture
- `controllers/` – Express route handlers
- `middleware/` – Auth, RBAC, and other middleware
- `lib/` – Prisma client, helpers
- `routes/` – Express routers
- `server.ts` – App entrypoint

## API Usage
- All endpoints are under `/api/`
- Use JWT Bearer tokens for authentication
- For comprehensive API documentation, see [API Reference](../docs/api-reference.md)

## Testing with curl
You can test the API directly using curl:

1. **Login to get JWT token:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"superuser@example.com","password":"super123"}'
   ```
   Response:
   ```json
   {
     "id":"...",
     "email":"superuser@example.com",
     "name":"Super User",
     "role":"SUPERUSER",
     "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

2. **Save the token for reuse:**
   ```bash
   TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # from login response
   ```

3. **Test admin stats endpoint:**
   ```bash
   curl -X GET http://localhost:3001/api/admin/stats \
     -H "Authorization: Bearer $TOKEN"
   ```
   Response:
   ```json
   {
     "totalDrivers": 1,
     "totalLocations": 3,
     "activeCheckIns": 0,
     "totalCheckIns": 0
   }
   ```

4. **Test driver check-in (requires location ID):**
   ```bash
   # First get locations to find an active one
   curl -X GET http://localhost:3001/api/locations \
     -H "Authorization: Bearer $TOKEN"
   ```
   Then use a location ID from the response:
   ```bash
   curl -X POST http://localhost:3001/api/checkin \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"locationId":"loc-123"}'
   ```

5. **Test driver check-out:**
   ```bash
   curl -X POST http://localhost:3001/api/checkin/checkout \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
