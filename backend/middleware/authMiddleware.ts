import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isAdmin, isSuperuser, isAdminOrSuperuser } from '../lib/auth';

const AUTH_COOKIE_NAME = 'driver_tracker_session';

function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return undefined;
}

// Middleware to authenticate JWT and attach user to req.session
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const token = bearerToken ?? getCookie(req, AUTH_COOKIE_NAME);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET || 'changeme';
    const payload = jwt.verify(token, secret);
    req.session = { user: payload };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// RBAC helpers for Express
export function requireAdminOrSuperuser(req: Request, res: Response, next: NextFunction) {
  const session = req.session;
  if (!isAdminOrSuperuser(session)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function requireSuperuser(req: Request, res: Response, next: NextFunction) {
  const session = req.session;
  if (!isSuperuser(session)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
