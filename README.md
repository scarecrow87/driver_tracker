# Driver Tracker

A driver safety tracking Progressive Web App (PWA) built with Next.js, TypeScript, Tailwind CSS, Prisma, NextAuth.js, and Docker.

## Features

- **Driver check-in / check-out** at specific locations
- **Optional geolocation capture** at check-in (if browser permission granted)
- **Admin dashboard** with location management, user management, and check-in history
- **2-hour alert system**: background cron job sends email and SMS alerts when a driver has been checked in for more than 2 hours
- **Role-based authentication** (ADMIN / DRIVER)
- **PWA** – installable on mobile devices with offline support

## Quick Start (Docker)

1. **Copy environment file**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your secrets (at minimum `NEXTAUTH_SECRET`).

2. **Start services**

   ```bash
   docker-compose up -d
   ```

   The app container automatically applies any pending database migrations on startup.

3. **Seed initial data** (admin + driver user, sample locations)

   ```bash
   docker exec -it driver_tracker_app npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
   ```

4. **Open the app**

   Visit [http://localhost:3000](http://localhost:3000)

   Default credentials:
   - Admin: `admin@example.com` / `admin123`
   - Driver: `driver@example.com` / `driver123`

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15 (or use Docker)

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (dev)
npx prisma db push

# Seed data
npm run db:seed

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for JWT signing |
| `NEXTAUTH_URL` | App base URL |
| `EMAIL_TENANT_ID` | Microsoft Azure AD tenant ID |
| `EMAIL_CLIENT_ID` | Microsoft Azure AD app client ID |
| `EMAIL_CLIENT_SECRET` | Microsoft Azure AD app client secret |
| `EMAIL_FROM` | Sender email address (must be a licensed M365 mailbox) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio phone number (E.164 format) |

## Architecture

```
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

## Background Alerts

The cron job runs every 15 minutes inside the Next.js server process. It scans for open check-ins older than 2 hours and:

1. Sends an email alert via Microsoft Graph API (if configured)
2. Sends an SMS alert via Twilio (if configured)
3. Marks the check-in as `alertSent = true` to avoid duplicate alerts

Configure email/SMS credentials in `.env` to enable real notifications. Without credentials, alerts are logged to the console.

## PWA

The app is configured as a PWA using `next-pwa`. In production, a service worker is registered automatically to cache static assets. Users can install the app on their mobile device.
