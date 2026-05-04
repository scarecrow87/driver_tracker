import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/authMiddleware';
import * as bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const AUTH_COOKIE_NAME = 'driver_tracker_session';
const ONE_DAY_SECONDS = 24 * 60 * 60;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function cookieOptions() {
  const isSecure = process.env.AUTH_COOKIE_SECURE === 'true';
  return [
    `Max-Age=${ONE_DAY_SECONDS}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function clearCookieOptions() {
  const isSecure = process.env.AUTH_COOKIE_SECURE === 'true';
  return [
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '1d' }
    );

    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${token}; ${cookieOptions()}`);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; ${clearCookieOptions()}`);
  res.json({ ok: true });
});

async function currentUser(req: any, res: any) {
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({ user: dbUser });
}

// GET /api/auth/me - Get current user (protected)
router.get('/me', authenticateJWT, currentUser);
router.post('/me', authenticateJWT, currentUser);

export default router;
