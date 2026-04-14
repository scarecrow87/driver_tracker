import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const extendSchema = z.object({
  extendedStay: z.boolean(),
  reason: z.string().min(1).optional(),
});

// PATCH /api/checkin/[id]/extend – toggle extended stay on an active check-in
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = extendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.extendedStay && !parsed.data.reason) {
    return NextResponse.json(
      { error: 'A reason is required when selecting extended stay' },
      { status: 400 }
    );
  }

  const checkIn = await prisma.checkIn.findUnique({
    where: { id },
    select: { driverId: true, checkOutTime: true },
  });

  if (!checkIn) {
    return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
  }

  if (checkIn.driverId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (checkIn.checkOutTime) {
    return NextResponse.json(
      { error: 'Cannot modify a completed check-in' },
      { status: 400 }
    );
  }

  const updated = await prisma.checkIn.update({
    where: { id },
    data: {
      isExtendedStay: parsed.data.extendedStay,
      extendedStayReason: parsed.data.extendedStay ? parsed.data.reason : null,
      extendedStayAt: parsed.data.extendedStay ? new Date() : null,
    },
    include: { location: true },
  });

  return NextResponse.json(updated);
}
