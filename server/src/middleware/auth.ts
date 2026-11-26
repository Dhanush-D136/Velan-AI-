import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  username?: string | null;
  role: string;
  status: string;
  name: string;
  deviceId?: string;
  sid?: string;
  scope?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const revokedSessionIds = new Set<string>();
export function revokeSessionToken(sessionId: string) {
  if (sessionId) revokedSessionIds.add(sessionId);
}

export function getJwtSecret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }
  return process.env.JWT_SECRET || 'velan_jwt_secret_dev_2026';
}

const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  '/me',
  '/api/me',
  '/auth/me',
  '/api/auth/me',
  '/auth/change-password',
  '/api/auth/change-password',
  '/logout',
  '/api/logout',
  '/auth/logout',
  '/api/auth/logout',
]);

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.cookies?.velan_access_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;

    if (decoded.sid) {
      if (revokedSessionIds.has(decoded.sid)) {
        return res.status(401).json({ error: 'Session has been logged out or expired' });
      }
      const sess = await prisma.userSession.findUnique({
        where: { id: decoded.sid },
        select: { endedAt: true },
      });
      if (!sess || sess.endedAt) {
        revokedSessionIds.add(decoded.sid);
        return res.status(401).json({ error: 'Session has been logged out or expired' });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        devices: true,
        facultyProfile: { include: { department: true } },
        studentProfile: { include: { class: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User account is inactive or suspended' });
    }

    // Server-enforced password change gate
    const fullPath = `${req.baseUrl || ''}${req.path || ''}`;
    if (decoded.scope === 'password_change_only' || user.mustChangePassword) {
      if (!PASSWORD_CHANGE_ALLOWED_PATHS.has(fullPath) && !PASSWORD_CHANGE_ALLOWED_PATHS.has(req.path)) {
        return res.status(403).json({
          code: 'PASSWORD_CHANGE_REQUIRED',
          error: 'Password change required before accessing this resource.',
        });
      }
    }

    // Hardware device lock check for students (supports up to 2 active devices)
    const requestDeviceId = (req.headers['x-device-id'] as string) || req.body?.deviceId;
    if (requestDeviceId && user.role === 'STUDENT') {
      const activeDevices = user.devices.filter((d) => d.status === 'ACTIVE');
      if (activeDevices.length > 0 && !activeDevices.some((d) => d.deviceId === requestDeviceId)) {
        return res.status(403).json({
          code: 'DEVICE_LOCKED',
          error: 'This account is bound to other devices. Request admin approval.',
        });
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      name: user.name,
      deviceId: requestDeviceId,
      sid: decoded.sid,
      scope: decoded.scope,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
};
