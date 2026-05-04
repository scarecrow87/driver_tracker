
# Driver Tracker (Split Architecture)

Driver Tracker is now split into two independently deployable services:

- **Frontend**: Next.js PWA on a plain VPS with nginx (in `frontend/`)
- **Backend**: Node.js/Express API (in `backend/`)

## Features
  
- Driver check-in/check-out, admin dashboard, superuser config, alert notifications
- Role-based authentication (SUPERUSER / ADMIN / DRIVER)
- Offline-ready PWA frontend
- PostgreSQL database (Prisma)
- Dockerized for local and production use
  
---

## API Documentation
  
For complete API documentation, see [API Reference](docs/api-reference.md).
  
---

## Quick Start

### 1. Backend API

See [backend/README.md](backend/README.md) for backend API setup, Docker, and environment variables.

### 2. Frontend (PWA)

See [frontend/README.md](frontend/README.md) for frontend-only setup, build, and deployment on a plain VPS with nginx.

---

## API Testing

You can test the backend API directly using curl:

1. **Login and save the session cookie:**
   ```bash
   curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"superuser@example.com","password":"super123"}'
   ```

2. **Test admin stats endpoint:**
   ```bash
   curl -b cookies.txt -X GET http://localhost:3001/api/admin/stats
   ```

3. **Test driver check-in:**
   ```bash
   # First get locations
   curl -b cookies.txt -X GET http://localhost:3001/api/locations
   ```
   Then use a location ID:
   ```bash
   curl -b cookies.txt -X POST http://localhost:3001/api/checkin \
     -H "Content-Type: application/json" \
     -d '{"locationId":"loc-123"}'
   ```

4. **Test driver check-out:**
   ```bash
   curl -b cookies.txt -X POST http://localhost:3001/api/checkin/checkout \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

---

## Local Development (Split)

1. Start the backend API:
   ```bash
   cd backend
   npm install
   npm run build
   npm start
   # or use Docker Compose
   docker compose up -d
   ```
2. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Configure `.env` files in both `backend/` and `frontend/` as needed.

---

## Deployment

- **Frontend**: Deploy `frontend/` to a VPS with nginx and a local Node.js standalone process. See [frontend/README.md](frontend/README.md).
- **Backend**: Deploy `backend/` as a standalone Node.js API (Docker recommended). See [backend/README.md](backend/README.md).

---

## Project Structure

- `frontend/` – Next.js PWA (UI only)
- `backend/` – Node.js/Express API
- `prisma/` – Database schema and migrations
- `docker-compose.yml` – Local dev stack (backend + Postgres)

---

## Migration Notes

- All old monolithic app code is archived in `_archive_pre_split/`.
- Only `frontend/` and `backend/` are active for new development.

---

For more, see the individual `README.md` files in each service folder.
