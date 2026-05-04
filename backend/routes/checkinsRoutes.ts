import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isAdminOrSuperuser } from '../lib/auth';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

const checkinsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  from: z.string().optional(),
  to: z.string().optional(),
  driverId: z.string().optional(),
  status: z.enum(['all', 'active', 'completed']).optional(),
  locationId: z.string().optional(),
  includeLocation: z.string().optional(),
  includeDriver: z.string().optional(),
  latestOnly: z.string().optional(),
});

// All routes require authentication
router.use(authenticateJWT);

// GET /api/checkins - Paginated check-in list. Admins can filter broadly; drivers only see their own records.
router.get('/', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const canViewAll = isAdminOrSuperuser(req.session);
    if (!canViewAll && user.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const parsedQuery = checkinsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }

    const { page, limit, from, to, status, locationId, latestOnly } = parsedQuery.data;
    const driverId = canViewAll ? parsedQuery.data.driverId : user.id;

    // Build where clause
    const where: any = {};

    if (driverId) {
      where.driverId = driverId;
    }

    if (locationId) {
      where.locationId = locationId;
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
    // status === 'all' or undefined means no filter on checkOutTime

    if (latestOnly === 'true') {
      const rows = await prisma.checkIn.findMany({
        where,
        include: {
          location: true,
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { checkInTime: 'desc' },
      });
      const latestByDriver = Array.from(
        new Map(rows.map((checkin) => [checkin.driverId, checkin])).values()
      );
      const pagedCheckins = latestByDriver.slice((page - 1) * limit, page * limit);

      return res.json({
        data: pagedCheckins,
        total: latestByDriver.length,
        page,
        limit,
        totalPages: Math.ceil(latestByDriver.length / limit),
      });
    }

    // Get checkins with pagination
    const [checkins, total] = await Promise.all([
      prisma.checkIn.findMany({
        where,
        include: {
          location: true,
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { checkInTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.checkIn.count({ where }),
    ]);
    
    res.json({
      data: checkins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get checkins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
