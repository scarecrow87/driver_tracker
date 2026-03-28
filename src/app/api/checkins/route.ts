import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/checkins – list check-ins (admin sees all, driver sees own)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const includeLocation = searchParams.get('includeLocation') === 'true';
  const includeDriver = searchParams.get('includeDriver') === 'true';
  const openOnly = searchParams.get('openOnly') === 'true';

  const where =
    session.user.role === 'ADMIN'
      ? openOnly ? { checkOutTime: null } : {}
      : { driverId: session.user.id };

  const checkins = await prisma.checkIn.findMany({
    where,
    include: {
      location: includeLocation,
      driver: includeDriver ? { select: { id: true, name: true, email: true } } : false,
    },
    orderBy: { checkInTime: 'desc' },
    take: 100,
  });

  return NextResponse.json(checkins);
}
