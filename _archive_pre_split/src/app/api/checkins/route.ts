import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions, isAdminOrSuperuser } from '@/lib/auth';
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
  const latestOnly = searchParams.get('latestOnly') === 'true';
  const canViewAll = isAdminOrSuperuser(session);

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

  // Date range filters
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // Driver filter (admin only)
  const driverId = searchParams.get('driverId');

  // Status filter: 'all' | 'active' | 'completed'
  const status = searchParams.get('status');

  const where: Prisma.CheckInWhereInput = canViewAll
    ? {}
    : { driverId: session.user.id };

  if (openOnly) {
    where.checkOutTime = null;
  }

  if (canViewAll && driverId) {
    where.driverId = driverId;
  }

  if (from || to) {
    where.checkInTime = {};
    if (from) {
      where.checkInTime.gte = new Date(from);
    }
    if (to) {
      // Include the entire "to" day
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.checkInTime.lte = toDate;
    }
  }

  if (status === 'active') {
    where.checkOutTime = null;
  } else if (status === 'completed') {
    where.checkOutTime = { not: null };
  }

  // If pagination is requested (page > 1 or limit is explicitly set), use paginated response
  const usePagination = searchParams.has('page') || searchParams.has('limit');

  if (usePagination) {
    const [checkins, total] = await Promise.all([
      prisma.checkIn.findMany({
        where,
        include: {
          location: includeLocation,
          driver: includeDriver ? { select: { id: true, name: true, email: true } } : false,
        },
        orderBy: { checkInTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.checkIn.count({ where }),
    ]);

    return NextResponse.json({
      data: checkins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  // Legacy non-paginated response (backwards compatible)
  const checkins = await prisma.checkIn.findMany({
    where,
    include: {
      location: includeLocation,
      driver: includeDriver ? { select: { id: true, name: true, email: true } } : false,
    },
    orderBy: latestOnly
      ? [{ driverId: 'asc' }, { checkInTime: 'desc' }]
      : { checkInTime: 'desc' },
    distinct: latestOnly && canViewAll ? ['driverId'] : undefined,
    take: 100,
  });

  return NextResponse.json(checkins);
}
