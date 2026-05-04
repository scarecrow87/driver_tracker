import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireAdminOrSuperuser, requireSuperuser } from '../middleware/authMiddleware';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/admin/users - List users
// Superusers see all roles. Admins see only ADMIN and DRIVER accounts.
router.get('/', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const session = (req as any).session;
    const isSuper = require('../lib/auth').isSuperuser(session);

    const roleFilter = isSuper
      ? undefined
      : { in: ['ADMIN', 'DRIVER'] as Role[] };

    const users = await prisma.user.findMany({
      where: roleFilter ? { role: roleFilter } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        adminPhone: true,
        adminEmail: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users - Create a user
router.post('/', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const session = (req as any).session;
    const isSuper = require('../lib/auth').isSuperuser(session);

    const createUserSchema = z.object({
      email: z.string().email().optional(),
      name: z.string().min(1),
      password: z.string().min(6),
      role: z.enum(['ADMIN', 'DRIVER', 'SUPERUSER']).default('DRIVER'),
      isActive: z.boolean().optional().default(true),
      adminPhone: z.string().optional(),
      adminEmail: z.string().email().optional(),
      driverPhone: z.string().optional(),
    });

    const body = req.body;
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (parsed.data.role === 'SUPERUSER' && !isSuper) {
      return res.status(403).json({ error: 'Only superusers can create superusers' });
    }

    const hashed = await bcrypt.hash(parsed.data.password, 10);
    // If role is DRIVER and email is not provided, set to empty string to satisfy Prisma
    const userData = {
      ...parsed.data,
      password: hashed,
      email: parsed.data.role === 'DRIVER' ? (parsed.data.email ?? '') : (parsed.data.email as string),
    };
    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        adminPhone: true,
        adminEmail: true,
        driverPhone: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/[id] - Update a user
router.put('/:id', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const session = (req as any).session;
    const isSuper = require('../lib/auth').isSuperuser(session);
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Get the user to update
    const userToUpdate = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent non-superusers from updating superusers
    if (userToUpdate.role === 'SUPERUSER' && !isSuper) {
      return res.status(403).json({ error: 'Only superusers can modify superusers' });
    }

    const updateUserSchema = z.object({
      email: z.string().email().optional(),
      name: z.string().min(1).optional(),
      role: z.enum(['ADMIN', 'DRIVER', 'SUPERUSER']).optional(),
      isActive: z.boolean().optional(),
      adminPhone: z.string().optional(),
      adminEmail: z.string().email().optional(),
      driverPhone: z.string().optional(),
      password: z.string().min(6).optional(),
    });

    const body = req.body;
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    // Prevent non-superusers from promoting to superuser
    if (parsed.data.role === 'SUPERUSER' && !isSuper) {
      return res.status(403).json({ error: 'Only superusers can grant superuser role' });
    }

    // Prepare update data
    const updateData: any = {
      ...parsed.data,
    };

    // If password is provided, hash it
    if (parsed.data.password) {
      updateData.password = await bcrypt.hash(parsed.data.password, 10);
    }

    // If role is DRIVER and email is not provided, set to empty string to satisfy Prisma
    if (updateData.role === 'DRIVER' && updateData.email === undefined) {
      updateData.email = userToUpdate.email ?? '';
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        adminPhone: true,
        adminEmail: true,
        driverPhone: true,
        createdAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users/[id] - Delete a user
router.delete('/:id', authenticateJWT, requireAdminOrSuperuser, async (req, res) => {
  try {
    const session = (req as any).session;
    const isSuper = require('../lib/auth').isSuperuser(session);
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const currentUserId = session.user.id;

    // Prevent users from deleting themselves
    if (userId === currentUserId) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    // Get the user to delete
    const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent non-superusers from deleting superusers
    if (userToDelete.role === 'SUPERUSER' && !isSuper) {
      return res.status(403).json({ error: 'Only superusers can delete superusers' });
    }

    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;