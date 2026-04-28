import { Router } from 'express';
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  geocodeLocation,
} from '../controllers/locationController';

const router = Router();

// GET /api/locations
router.get('/', listLocations);
// POST /api/locations
router.post('/', createLocation);
// PUT /api/locations/:id
router.put('/:id', updateLocation);
// DELETE /api/locations/:id
router.delete('/:id', deleteLocation);
// POST /api/locations/geocode
router.post('/geocode', geocodeLocation);

export default router;
