import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const checkOutSchema = z.object({
  idempotencyKey: z.string().optional(),
  checkInId: z.string().optional(),
});

// POST /api/checkout – close the open check-in
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = checkOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.idempotencyKey) {
    const deduped = await prisma.checkIn.findFirst({
      where: {
        driverId: session.user.id,
        checkOutRequestKey: parsed.data.idempotencyKey,
      },
      include: { location: true },
    });

    if (deduped) {
      return NextResponse.json(deduped);
    }
  }

  const openCheckIn = await prisma.checkIn.findFirst({
    where: {
      driverId: session.user.id,
      checkOutTime: null,
    },
    include: { location: true },
  });

  if (!openCheckIn) {
    if (parsed.data.checkInId) {
      const target = await prisma.checkIn.findFirst({
        where: {
          id: parsed.data.checkInId,
          driverId: session.user.id,
        },
        include: { location: true },
      });

      if (target?.checkOutTime) {
        return NextResponse.json(target);
      }
    }

    return NextResponse.json({ error: 'No open check-in found' }, { status: 404 });
  }

  if (parsed.data.checkInId && parsed.data.checkInId !== openCheckIn.id) {
    return NextResponse.json(
      { error: 'Checkout target does not match current open check-in' },
      { status: 409 }
    );
  }

  const updated = await prisma.checkIn.update({
    where: { id: openCheckIn.id },
    data: {
      checkOutTime: new Date(),
      checkOutRequestKey: parsed.data.idempotencyKey,
    },
    include: { location: true },
  });

  return NextResponse.json(updated);
}

// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials
