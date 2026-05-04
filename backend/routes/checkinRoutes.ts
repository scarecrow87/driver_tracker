import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// POST /api/checkin
router.post('/', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { locationId, latitude, longitude, idempotencyKey, extendedStay, extendedStayReason } = req.body;

    // Validate required fields
    if (!locationId) {
      return res.status(400).json({ error: 'Location ID is required' });
    }

    // Check for existing open check-in
    const existingOpenCheckin = await prisma.checkIn.findFirst({
      where: {
        driverId: user.id,
        checkOutTime: null,
      },
    });

    if (existingOpenCheckin) {
      return res.status(409).json({ error: 'You already have an open check-in' });
    }

    // Check if idempotency key already used
    if (idempotencyKey) {
      const existingCheckin = await prisma.checkIn.findFirst({
        where: {
          driverId: user.id,
          checkInRequestKey: idempotencyKey,
        },
      });

      if (existingCheckin) {
        return res.json(existingCheckin);
      }
    }

    // Validate location exists and is active
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, isActive: true },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (!location.isActive) {
      return res.status(400).json({ error: 'Selected location is inactive' });
    }

    // Validate extended stay
    if (extendedStay && !extendedStayReason) {
      return res.status(400).json({ error: 'Extended stay reason is required when extended stay is true' });
    }

    // Create check-in
    const checkin = await prisma.checkIn.create({
      data: {
        driverId: user.id,
        locationId,
        latitude,
        longitude,
        checkInRequestKey: idempotencyKey,
        isExtendedStay: extendedStay ?? false,
        extendedStayReason: extendedStay ? extendedStayReason : null,
        extendedStayAt: extendedStay ? new Date() : null,
      },
      include: { location: true },
    });

    res.status(201).json(checkin);
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/checkin - Get current driver's open checkin
router.get('/', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const checkin = await prisma.checkIn.findFirst({
      where: {
        driverId: user.id,
        checkOutTime: null,
      },
      include: { location: true },
    });

    res.json(checkin || null);
  } catch (error) {
    console.error('Get checkin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/checkout
router.post('/checkout', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { idempotencyKey } = req.body;

    // Find open checkin for the user
    const openCheckin = await prisma.checkIn.findFirst({
      where: {
        driverId: user.id,
        checkOutTime: null,
      },
    });

    if (!openCheckin) {
      return res.status(404).json({ error: 'No open check-in found' });
    }

    // Check if idempotency key already used for checkout
    if (idempotencyKey) {
      const existingCheckout = await prisma.checkIn.findFirst({
        where: {
          id: openCheckin.id,
          checkOutRequestKey: idempotencyKey,
        },
      });

      if (existingCheckout) {
        return res.json(existingCheckout);
      }
    }

    // Update checkin with checkout time
    const checkedIn = await prisma.checkIn.update({
      where: { id: openCheckin.id },
      data: {
        checkOutTime: new Date(),
        checkOutRequestKey: idempotencyKey,
      },
      include: { location: true },
    });

    res.json(checkedIn);
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;