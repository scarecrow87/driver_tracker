import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireAdminOrSuperuser } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// GET /api/checkins - Admin list with pagination, filters (driver, date range, status, location)
router.get('/', requireAdminOrSuperuser, async (req, res) => {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    
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
    
    // Location filter
    const locationId = searchParams.get('locationId');
    
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