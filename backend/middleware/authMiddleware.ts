import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isAdmin, isSuperuser, isAdminOrSuperuser } from '../../src/lib/auth';

// Middleware to authenticate JWT and attach user to req.session
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.NEXTAUTH_SECRET || 'changeme';
    const payload = jwt.verify(token, secret);
    (req as any).session = { user: payload };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// RBAC helpers for Express
export function requireAdminOrSuperuser(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (!isAdminOrSuperuser(session)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function requireSuperuser(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (!isSuperuser(session)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
