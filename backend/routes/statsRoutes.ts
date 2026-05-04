import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireAdminOrSuperuser } from '../middleware/authMiddleware';

const router = Router();

// GET /api/admin/stats
router.get('/', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const [totalDrivers, totalLocations, activeCheckIns, totalCheckIns] =
      await Promise.all([
        prisma.user.count({ where: { role: 'DRIVER' } }),
        prisma.location.count(),
        prisma.checkIn.count({ where: { checkOutTime: null } }),
        prisma.checkIn.count(),
      ]);

    res.json({
      totalDrivers,
      totalLocations,
      activeCheckIns,
      totalCheckIns,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;