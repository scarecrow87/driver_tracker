import { Request, Response } from 'express';

// Extend Express Request type to include session
interface SessionRequest extends Request {
  session: any;
}
import { prisma } from '../lib/prisma';
import { geocodeAddress } from '../lib/geocode';
import { z } from 'zod';
import { isAdminOrSuperuser } from '../lib/auth';

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

const geocodeSchema = z.object({
  address: z.string().min(1),
});

export const listLocations = async (req: Request, res: Response) => {
  const session = (req as SessionRequest).session;
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const includeInactive = req.query.includeInactive === 'true';
  const canViewAll = isAdminOrSuperuser(session);
  const locations = await prisma.location.findMany({
    where: canViewAll && includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
  return res.json(locations);
};

export const createLocation = async (req: Request, res: Response) => {
  const session = (req as SessionRequest).session;
  if (!isAdminOrSuperuser(session)) return res.status(403).json({ error: 'Forbidden' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // Ensure name is present for Prisma
  const { name, latitude, longitude, ...rest } = parsed.data;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const hasManualCoords = latitude !== undefined && longitude !== undefined;
  let location = await prisma.location.create({ data: hasManualCoords ? { name, ...rest, latitude, longitude } : { name, ...rest } });
  if (!hasManualCoords && parsed.data.address) {
    const coords = await geocodeAddress(parsed.data.address);
    if (coords) {
      await prisma.location.update({ where: { id: location.id }, data: coords });
      location = { ...location, ...coords };
    }
  }
  return res.status(201).json(location);
};

export const updateLocation = async (req: Request, res: Response) => {
  const session = (req as SessionRequest).session;
  if (!isAdminOrSuperuser(session)) return res.status(403).json({ error: 'Forbidden' });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    const hasManualCoords = 'latitude' in parsed.data || 'longitude' in parsed.data;
    if ('address' in parsed.data && !hasManualCoords) {
      if (parsed.data.address) {
        const coords = await geocodeAddress(parsed.data.address);
        if (coords) {
          updateData.latitude = coords.latitude;
          updateData.longitude = coords.longitude;
        }
      } else {
        updateData.latitude = null;
        updateData.longitude = null;
      }
    }
    // Ensure id is string
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const location = await prisma.location.update({ where: { id }, data: updateData });
    return res.json(location);
  } catch {
    return res.status(404).json({ error: 'Location not found' });
  }
};

export const deleteLocation = async (req: Request, res: Response) => {
  const session = (req as SessionRequest).session;
  if (!isAdminOrSuperuser(session)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await prisma.location.delete({ where: { id } });
    return res.json({ success: true });
  } catch {
    return res.status(404).json({ error: 'Location not found' });
  }
};

export const geocodeLocation = async (req: Request, res: Response) => {
  const session = (req as SessionRequest).session;
  if (!isAdminOrSuperuser(session)) return res.status(403).json({ error: 'Forbidden' });
  const parsed = geocodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const coords = await geocodeAddress(parsed.data.address);
  if (!coords) return res.status(404).json({ error: 'Could not geocode address' });
  return res.json(coords);
};
