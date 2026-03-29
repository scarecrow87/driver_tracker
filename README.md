# Driver Tracker

A driver safety tracking Progressive Web App (PWA) built with Next.js, TypeScript, Tailwind CSS, Prisma, NextAuth.js, and Docker.

## Features

- **Driver check-in / check-out** at specific locations
- **Optional geolocation capture** at check-in (if browser permission granted)
- **Admin dashboard** with location management, user management, check-in history, and last-location map view
- **Superuser settings panel** for email/SMS provider configuration
- **2-hour alert system**: background cron job sends email and SMS alerts when a driver has been checked in for more than 2 hours
- **Role-based authentication** (SUPERUSER / ADMIN / DRIVER)
- **Active / inactive controls** for drivers and locations
- **Offline-ready driver flow (initial implementation)** with IndexedDB location cache, offline action queue, reconnect replay fallback, and explicit “not logged until sync” warnings
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
   Startup runs `prisma migrate deploy` with retry logic (configurable via `MIGRATION_MAX_RETRIES` and `MIGRATION_RETRY_DELAY_SECONDS`).

3. **Seed initial data** (superuser + admin + driver users, sample locations)

   ```bash
   docker exec -it driver_tracker_app npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
   ```

4. **Open the app**

   Visit [http://localhost:3000](http://localhost:3000)

   Default credentials:
   - Superuser: `superuser@example.com` / `super123`
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

### DB Change Quick Checklist

Use this checklist whenever a change touches Prisma schema or DB-dependent behavior:

1. Update `prisma/schema.prisma`.
2. Create or update migration SQL under `prisma/migrations`.
3. Run `npx prisma generate`.
4. Apply migrations:
   - Local feature work: `npx prisma migrate dev`
   - Deployment/testing environments: `npx prisma migrate deploy`
5. Update this README if setup/run steps changed.

### Database Changes After Pulling Code Updates

When the schema or migrations change, run the DB steps before starting the app.

For local development:

```bash
# Apply committed migrations
npx prisma migrate deploy

# Regenerate Prisma client for updated types
npx prisma generate
```

When creating a new schema change in development:

```bash
# Create and apply a new migration
npx prisma migrate dev --name describe_change

# Regenerate Prisma client
npx prisma generate
```

If you are using Docker, the container startup script applies pending migrations automatically, but you should still run `npx prisma generate` locally after pulling schema changes so editor types stay in sync.

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for JWT signing |
| `NEXTAUTH_URL` | App base URL |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte key (raw or base64) used to encrypt notification provider secrets stored in DB |
| `MIGRATION_MAX_RETRIES` | Optional Docker startup retry count for `prisma migrate deploy` (default `10`) |
| `MIGRATION_RETRY_DELAY_SECONDS` | Optional wait between migration retries in seconds (default `5`) |

Optional fallback provider env vars (used only if superuser DB settings are empty): `EMAIL_TENANT_ID`, `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`, `EMAIL_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.

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

---

## Notes & Future Considerations

### Serverless Deployment

The app can be adapted to run fully serverless (e.g. Vercel, AWS Lambda, Cloudflare Workers) with a few changes:

- **Database** – Replace PostgreSQL + Prisma with a serverless-compatible database such as [Neon](https://neon.tech), [PlanetScale](https://planetscale.com), [Supabase](https://supabase.com), or [Turso](https://turso.tech). All support Prisma drivers or their own lightweight ORMs.
- **Background cron** – The in-process cron job (`src/lib/cron.ts`) cannot run on serverless platforms. Replace it with a scheduled function: Vercel Cron Jobs, AWS EventBridge + Lambda, or a third-party scheduler (e.g. [Trigger.dev](https://trigger.dev), [Inngest](https://www.inngest.com)) calling the existing `/api/admin/cron` endpoint.
- **Email / SMS** – Microsoft Graph and Twilio are already HTTP-based, so no changes needed.
- **Sessions** – Switch from database sessions to JWT sessions in NextAuth.js if you want to avoid a database call on every request.
- **Static export** – A fully static export (`output: 'export'` in `next.config.js`) is possible for the client-only parts, but API routes and server-side rendering would need to be moved to separate functions.

### Offline / Client-Side Operation

The app now includes an initial offline workflow for the driver dashboard:

- **Offline queue (implemented)** – Check-in/check-out actions are queued locally when offline or on transient network failure.
- **Reconnect replay fallback (implemented)** – Queued actions are replayed when connectivity returns and on app load while online.
- **Local cache (implemented)** – Active location list is cached in IndexedDB so drivers can still pick locations while offline.
- **User-visible warning (implemented)** – Drivers see a clear offline banner and explicit warnings that queued check-in/check-out actions are not logged server-side until sync succeeds.

Current limits and next hardening items:

- **Replay paths are now redundant by design** – Queue replay runs via both Background Sync service worker events and reconnect/app-load fallback.
- **Idempotent offline writes are now persisted** – Check-in/check-out queued payloads include idempotency keys persisted in DB-backed request key columns.
- **Conflict safety is enforced on checkout replay** – Checkout requests can target a specific check-in, and conflicting targets return explicit `409` responses.

### Extensibility – Other Tracking Methods & Integrations

The check-in model is intentionally simple (location + timestamp + optional GPS co-ordinates) so it can be extended without breaking existing data:

- **GPS / live tracking** – Add a `trackingPoints` table linked to a `CheckIn` and POST coordinates at regular intervals from the driver's device using the [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) or a dedicated SDK.
- **NFC / QR codes** – Generate a unique QR code per location. Scanning it triggers a check-in automatically, no manual selection needed. NFC tags can trigger the same API endpoint via the [Web NFC API](https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API) on supported Android devices.
- **Barcode / RFID** – Scanners that act as HID keyboards can pre-fill the location field; RFID readers can POST directly to the `/api/checkin` endpoint.
- **Third-party fleet / telematics** – Expose a webhook receiver endpoint (e.g. `/api/webhooks/fleet`) to ingest events from platforms such as Samsara, Geotab, or Verizon Connect, mapping them onto the existing `CheckIn` model.
- **Calendar / shift integration** – Integrate with Microsoft 365 or Google Calendar to automatically open a check-in when a shift starts and close it when the shift ends.
- **Slack / Teams notifications** – Add an additional notification channel alongside email/SMS in `src/lib/notifications.ts` using incoming webhooks.
- **Analytics export** – Add a CSV/JSON export endpoint for the check-in history so data can be loaded into BI tools (Power BI, Looker, etc.) or shared with payroll systems.
