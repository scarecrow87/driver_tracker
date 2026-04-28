import { Router } from 'express';

import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  geocodeLocation,
} from '../controllers/locationController';
import { authenticateJWT, requireAdminOrSuperuser } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// GET /api/locations (any authenticated user)
router.get('/', listLocations);
// POST /api/locations (admin/superuser only)
router.post('/', requireAdminOrSuperuser, createLocation);
// PUT /api/locations/:id (admin/superuser only)
router.put('/:id', requireAdminOrSuperuser, updateLocation);
// DELETE /api/locations/:id (admin/superuser only)
router.delete('/:id', requireAdminOrSuperuser, deleteLocation);
// POST /api/locations/geocode (admin/superuser only)
router.post('/geocode', requireAdminOrSuperuser, geocodeLocation);

export default router;
