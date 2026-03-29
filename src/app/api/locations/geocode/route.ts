import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminOrSuperuser } from '@/lib/auth';
import { geocodeAddress } from '@/lib/geocode';
import { z } from 'zod';

const geocodeSchema = z.object({
  address: z.string().min(1),
});

// POST /api/locations/geocode – look up lat/lng for an address (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = geocodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const coords = await geocodeAddress(parsed.data.address);
  if (!coords) {
    return NextResponse.json({ error: 'Could not geocode address' }, { status: 404 });
  }

  return NextResponse.json(coords);
}
