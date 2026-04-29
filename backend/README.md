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
- See frontend README for API contract
