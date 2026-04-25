# Geocode Location Addresses for Map Display

## Problem
When a driver checks in without GPS coordinates (geolocation denied/unavailable), the check-in has `null` lat/lng and is invisible on the admin dashboard map. The `Location` model stores an `address` field that is never used for mapping.

## Approach
Cache geocoded coordinates on the `Location` model. When a check-in lacks GPS, fall back to the Location's coordinates so the driver still appears on the map.

## Changes

### 1. Prisma Schema — `prisma/schema.prisma`
Add optional `latitude` and `longitude` fields to the `Location` model:
```prisma
model Location {
  id        String    @id @default(cuid())
  name      String
  address   String?
  latitude  Float?
  longitude Float?
  isActive  Boolean   @default(true)
  checkIns  CheckIn[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

### 2. Migration — `prisma/migrations/20260329000300_location_geocode_coords/migration.sql`
```sql
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
```

### 3. Geocoding Utility — `src/lib/geocode.ts` (new file)
Create a geocoding function using OpenStreetMap Nominatim API (free, no API key, consistent with existing OSM tile usage):
- `geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null>`
- Respects Nominatim rate limiting (1 req/sec) via simple delay
- Returns `null` on failure (graceful degradation — location just won't appear on map)
- Sets a descriptive User-Agent header per Nominatim usage policy

### 4. Location API — `src/app/api/locations/route.ts`
**POST (create)**: After creating the location, if an address was provided, call `geocodeAddress()` and update the record with the resulting coordinates. Do this after create returns (don't block the response on geocoding failure).

**PUT update** in `src/app/api/locations/[id]/route.ts`: If the address field changes, re-geocode and update lat/lng. If address is cleared, null out lat/lng.

### 5. Admin Dashboard Map Fallback — `src/app/admin/dashboard/page.tsx`
Update `fetchLatestLocations()` (line 133) to fall back to Location coordinates when CheckIn has no GPS:
```ts
const points = rows
  .filter((ci) =>
    (ci.latitude != null && ci.longitude != null) ||
    (ci.location?.latitude != null && ci.location?.longitude != null)
  )
  .map((ci) => ({
    id: ci.id,
    driverName: ci.driver?.name || ci.driverId,
    locationName: ci.location?.name,
    latitude: ci.latitude ?? ci.location!.latitude!,
    longitude: ci.longitude ?? ci.location!.longitude!,
    checkInTime: ci.checkInTime,
    checkOutTime: ci.checkOutTime,
  }));
```

Update `Location` interface (line 7) to include `latitude` and `longitude`:
```ts
interface Location {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}
```

### 6. Regenerate Prisma Client
Run `npx prisma generate` after schema changes.

## Files Modified
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `latitude`, `longitude` to Location |
| `prisma/migrations/20260329000300_location_geocode_coords/migration.sql` | New migration |
| `src/lib/geocode.ts` | New geocoding utility |
| `src/app/api/locations/route.ts` | Geocode on create |
| `src/app/api/locations/[id]/route.ts` | Geocode on update |
| `src/app/admin/dashboard/page.tsx` | Map fallback to Location coords |

## Validation
- Run `npx prisma generate` — client generation succeeds
- Run `npm run lint` — no lint errors
- Run `npm run build` — build succeeds
- Manual: create a location with an address → verify lat/lng populated in DB
- Manual: check in without GPS → verify marker appears on map at location coordinates
