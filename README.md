src/
├── app/
│   ├── api/           # Next.js API routes
│   │   ├── auth/      # NextAuth handler
│   │   ├── checkin/   # Check-in create/read
│   │   ├── checkout/  # Check-out
│   │   ├── checkins/  # List check-ins
│   │   ├── locations/ # Location CRUD
│   │   └── admin/     # Admin-only APIs
│   ├── admin/         # Admin pages
│   ├── driver/        # Driver pages
│   ├── login/         # Login page
│   └── layout.tsx
├── lib/
│   ├── auth.ts        # NextAuth configuration
│   ├── cron.ts        # Background cron job
│   ├── notifications.ts # Email/SMS helpers
│   └── prisma.ts      # Prisma client singleton
├── middleware.ts       # Route protection
└── instrumentation.ts # Server startup hook
prisma/
├── schema.prisma      # Database schema
└── seed.ts            # Seed data
```

# Driver Tracker (Split Architecture)

Driver Tracker is now split into two independently deployable services:

- **Frontend**: Next.js PWA (in `frontend/`)
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

See [frontend/README.md](frontend/README.md) for frontend-only setup, build, and deployment (Cloudflare Pages, Nginx, or Node.js).

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

- **Frontend**: Deploy `frontend/` to Cloudflare Pages, Nginx, or Node.js server. See [frontend/README.md](frontend/README.md).
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
