# Plan: Add Default GPS Location to Check-In Locations

## Goal
Allow admins to set default GPS coordinates (lat/lng) on check-in locations, with auto-geocoding from address and manual override capability.

## Current State
- `Location` model already has `latitude`/`longitude` optional fields
- Geocoding via Nominatim happens server-side on create/update when address is provided
- Admin UI form has NO lat/lng fields — coordinates are invisible to admins
- If geocoding fails, coordinates stay null with no way to manually set them

## Changes

### 1. Add geocoding API endpoint
**File:** `src/app/api/locations/geocode/route.ts` (new)

- `POST /api/locations/geocode` — accepts `{ address: string }`, returns `{ latitude, longitude }` or error
- Admin/superuser only
- Uses existing `geocodeAddress()` from `src/lib/geocode.ts`

### 2. Update create location API to accept explicit coordinates
**File:** `src/app/api/locations/route.ts`

- Add optional `latitude` and `longitude` to `createSchema`
- If coordinates are provided in the request, use them directly (skip geocoding)
- If no coordinates but address is provided, geocode as before (existing behavior)

### 3. Update update location API to accept explicit coordinates
**File:** `src/app/api/locations/[id]/route.ts`

- Add optional `latitude` and `longitude` to `updateSchema`
- If coordinates are explicitly provided (including `null` to clear), use them
- If not provided, fall back to geocoding from address (existing behavior)

### 4. Update admin location form UI
**File:** `src/app/admin/dashboard/page.tsx`

- Add `latitude` and `longitude` to `locationForm` state (as string inputs for flexibility)
- Add two new input fields below the address field:
  - Read-only lat/lng fields showing geocoded or manually set values
  - "Edit" button to toggle manual override mode (makes fields editable)
  - "Lookup" button next to address field — calls geocode API and populates lat/lng
- When editing a location, populate lat/lng from existing data
- Show lat/lng in the location list (small text under address)
- Reset lat/lng fields when canceling edit or after successful create

### 5. Update Location interface
**File:** `src/app/admin/dashboard/page.tsx` (lines 7-14)

- Already has `latitude?: number` and `longitude?: number` — no change needed

## Implementation Order
1. API endpoints (geocode endpoint + schema updates)
2. Admin UI form changes
3. Validation: run `npm run lint` and `npm run build`

## Files to Modify
- `src/app/api/locations/route.ts` — add lat/lng to create schema
- `src/app/api/locations/[id]/route.ts` — add lat/lng to update schema
- `src/app/admin/dashboard/page.tsx` — form UI with lat/lng fields

## Files to Create
- `src/app/api/locations/geocode/route.ts` — geocode lookup endpoint

## Verification
- `npm run lint`
- `npm run build`
