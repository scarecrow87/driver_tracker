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

> ⚠️ **Warning:** The app currently requires an active server connection for all check-in, check-out, and admin actions. Going offline will block these features.

The PWA service worker caches static assets so the shell loads without a network connection, but API calls (check-in, check-out, location lists, etc.) will fail. Planned improvements to support offline workflows:

- **Offline queue** – Use the [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) (already available in the service worker context) to queue check-in/check-out actions and replay them when connectivity is restored.
- **Local cache** – Store location data in `IndexedDB` (e.g. via [idb](https://github.com/jakearchibald/idb)) so drivers can still select a location while offline.
- **User-visible warning** – Detect `navigator.onLine` and the `online`/`offline` window events to display a banner warning the driver that their actions will be queued until reconnected.
- **Conflict resolution** – Define a clear strategy (last-write-wins, server-authoritative, etc.) for resolving queued check-ins that arrive out of order after reconnection.

### Extensibility – Other Tracking Methods & Integrations

The check-in model is intentionally simple (location + timestamp + optional GPS co-ordinates) so it can be extended without breaking existing data:

- **GPS / live tracking** – Add a `trackingPoints` table linked to a `CheckIn` and POST coordinates at regular intervals from the driver's device using the [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) or a dedicated SDK.
- **NFC / QR codes** – Generate a unique QR code per location. Scanning it triggers a check-in automatically, no manual selection needed. NFC tags can trigger the same API endpoint via the [Web NFC API](https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API) on supported Android devices.
- **Barcode / RFID** – Scanners that act as HID keyboards can pre-fill the location field; RFID readers can POST directly to the `/api/checkin` endpoint.
- **Third-party fleet / telematics** – Expose a webhook receiver endpoint (e.g. `/api/webhooks/fleet`) to ingest events from platforms such as Samsara, Geotab, or Verizon Connect, mapping them onto the existing `CheckIn` model.
- **Calendar / shift integration** – Integrate with Microsoft 365 or Google Calendar to automatically open a check-in when a shift starts and close it when the shift ends.
- **Slack / Teams notifications** – Add an additional notification channel alongside email/SMS in `src/lib/notifications.ts` using incoming webhooks.
- **Analytics export** – Add a CSV/JSON export endpoint for the check-in history so data can be loaded into BI tools (Power BI, Looker, etc.) or shared with payroll systems.
