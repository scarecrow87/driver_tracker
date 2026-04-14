import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const checkInSchema = z.object({
  locationId: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  idempotencyKey: z.string().optional(),
  extendedStay: z.boolean().optional(),
  extendedStayReason: z.string().min(1).optional(),
});

// POST /api/checkin – create a check-in (driver only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeDriver = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!activeDriver?.isActive) {
    return NextResponse.json({ error: 'Driver account is inactive' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.extendedStay && !parsed.data.extendedStayReason) {
    return NextResponse.json(
      { error: 'A reason is required when selecting extended stay' },
      { status: 400 }
    );
  }

  if (parsed.data.idempotencyKey) {
    const deduped = await prisma.checkIn.findFirst({
      where: {
        driverId: session.user.id,
        checkInRequestKey: parsed.data.idempotencyKey,
      },
      include: { location: true },
    });

    if (deduped) {
      return NextResponse.json(deduped);
    }
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

  const location = await prisma.location.findUnique({
    where: { id: parsed.data.locationId },
    select: { id: true, isActive: true },
  });
  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }
  if (!location.isActive) {
    return NextResponse.json({ error: 'Selected location is inactive' }, { status: 400 });
  }

  const checkIn = await prisma.checkIn.create({
    data: {
      driverId: session.user.id,
      locationId: parsed.data.locationId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      checkInRequestKey: parsed.data.idempotencyKey,
      isExtendedStay: parsed.data.extendedStay ?? false,
      extendedStayReason: parsed.data.extendedStay ? parsed.data.extendedStayReason : null,
      extendedStayAt: parsed.data.extendedStay ? new Date() : null,
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

// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials
