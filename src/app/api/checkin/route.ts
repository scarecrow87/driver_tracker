import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const checkInSchema = z.object({
  locationId: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// POST /api/checkin – create a check-in (driver only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for existing open check-in
  const existing = await prisma.checkIn.findFirst({
    where: {
      driverId: session.user.id,
      checkOutTime: null,
    },
    include: { location: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'You already have an open check-in', checkIn: existing },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const checkIn = await prisma.checkIn.create({
    data: {
      driverId: session.user.id,
      locationId: parsed.data.locationId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    },
    include: { location: true },
  });

  return NextResponse.json(checkIn, { status: 201 });
}

// GET /api/checkin – get current open check-in for the driver
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkIn = await prisma.checkIn.findFirst({
    where: {
      driverId: session.user.id,
      checkOutTime: null,
    },
    include: { location: true },
  });

  return NextResponse.json(checkIn);
}
