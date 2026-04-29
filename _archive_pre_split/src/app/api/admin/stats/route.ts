import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminOrSuperuser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/stats
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminOrSuperuser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [totalDrivers, totalLocations, activeCheckIns, totalCheckIns] =
    await Promise.all([
      prisma.user.count({ where: { role: 'DRIVER' } }),
      prisma.location.count(),
      prisma.checkIn.count({ where: { checkOutTime: null } }),
      prisma.checkIn.count(),
    ]);

  return NextResponse.json({
    totalDrivers,
    totalLocations,
    activeCheckIns,
    totalCheckIns,
  });
}
