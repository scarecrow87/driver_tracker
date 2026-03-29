import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminOrSuperuser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { geocodeAddress } from '@/lib/geocode';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

// GET /api/locations – list all locations (authenticated users)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const includeInactive = new URL(req.url).searchParams.get('includeInactive') === 'true';
  const canViewAll = isAdminOrSuperuser(session);

  const locations = await prisma.location.findMany({
    where: canViewAll && includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(locations);
}

// POST /api/locations – create a location (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const location = await prisma.location.create({
    data: parsed.data,
  });

  if (parsed.data.address) {
    const coords = await geocodeAddress(parsed.data.address);
    if (coords) {
      await prisma.location.update({
        where: { id: location.id },
        data: coords,
      });
      location.latitude = coords.latitude;
      location.longitude = coords.longitude;
    }
  }

  return NextResponse.json(location, { status: 201 });
}
