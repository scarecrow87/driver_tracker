import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/checkout – close the open check-in
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const openCheckIn = await prisma.checkIn.findFirst({
    where: {
      driverId: session.user.id,
      checkOutTime: null,
    },
  });

  if (!openCheckIn) {
    return NextResponse.json({ error: 'No open check-in found' }, { status: 404 });
  }

  const updated = await prisma.checkIn.update({
    where: { id: openCheckIn.id },
    data: { checkOutTime: new Date() },
    include: { location: true },
  });

  return NextResponse.json(updated);
}
