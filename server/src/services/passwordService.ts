import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { revokeSessionToken, invalidateUserAuthCache } from '../middleware/auth';
import { presenceService } from './presenceService';

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  if (!/[A-Za-z]/.test(out)) out = 'A' + out.slice(1);
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + '7';
  return out;
}

export async function validateNewPassword(
  newPassword: string,
  user: {
    id: string;
    mustChangePassword?: boolean;
    passwordHash?: string;
  }
): Promise<{ valid: boolean; error?: string }> {
  const pwd = newPassword || '';
  if (pwd.trim().length === 0) {
    return { valid: false, error: 'Password cannot be empty.' };
  }

  // Only on forced first-login / temp-password change: must differ from the temporary password
  if (user.mustChangePassword && user.passwordHash) {
    const sameAsTemp = await bcrypt.compare(pwd, user.passwordHash);
    if (sameAsTemp) {
      return {
        valid: false,
        error: 'New password must be different from your temporary password.',
      };
    }
  }

  return { valid: true };
}

export async function setPassword(
  userId: string,
  newPassword: string,
  options: {
    by: 'self' | 'admin' | 'system';
    mustChange: boolean;
    expiresAt?: Date | null;
    keepSessionId?: string;
    actorUserId?: string;
    io?: any;
  }
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, passwordHistory: true },
  });
  if (!existing) throw new Error('User not found');

  const newHash = await bcrypt.hash(newPassword, 10);

  let history: string[] = [];
  try {
    const parsed = existing.passwordHistory ? JSON.parse(existing.passwordHistory) : [];
    if (Array.isArray(parsed)) history = parsed.filter((x) => typeof x === 'string');
  } catch {
    history = [];
  }
  history = [newHash, ...history.filter((h) => h !== newHash)].slice(0, 3);

  const now = new Date();
  const expiresAt = options.mustChange
    ? options.expiresAt ?? new Date(Date.now() + 7 * 86400000)
    : null;

  const activeSessions = await prisma.userSession.findMany({
    where: {
      userId,
      endedAt: null,
      ...(options.keepSessionId ? { NOT: { id: options.keepSessionId } } : {}),
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: options.mustChange,
        passwordChangedAt: now,
        passwordSetBy: options.by,
        tempPasswordExpiresAt: expiresAt,
        passwordHistory: JSON.stringify(history),
      },
    });

    await tx.userSession.updateMany({
      where: {
        userId,
        endedAt: null,
        ...(options.keepSessionId ? { NOT: { id: options.keepSessionId } } : {}),
      },
      data: { endedAt: now, endReason: 'password_reset' },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.keepSessionId ? { NOT: { sessionId: options.keepSessionId } } : {}),
      },
      data: { revokedAt: now },
    });

    await tx.auditLog.create({
      data: {
        userId: options.actorUserId || userId,
        action: options.by === 'self' ? 'PASSWORD_CHANGED' : 'PASSWORD_RESET',
        details: JSON.stringify({
          targetUserId: userId,
          by: options.by,
          mustChange: options.mustChange,
          revokedSessions: activeSessions.length,
        }),
      },
    });
  });

  for (const s of activeSessions) {
    revokeSessionToken(s.id);
    presenceService.removeSession(s.id);
  }
  invalidateUserAuthCache(userId);

  if (options.io && activeSessions.length > 0 && !options.keepSessionId) {
    options.io.to(`user_${userId}`).emit('auth:forced_logout', {
      reason: 'Your password was reset. Please sign in with your new temporary password.',
    });
  }
}

export async function flagDefaultPasswordAccounts(): Promise<number> {
  try {
    const users = await prisma.user.findMany({
      where: { mustChangePassword: false, status: 'ACTIVE' },
      include: { studentProfile: true, facultyProfile: true },
    });
    let flagged = 0;
    for (const u of users) {
      const candidates = [
        '1234',
        'student123',
        'faculty123',
        'admin123',
        u.studentProfile?.registerNo,
        u.studentProfile?.rollNo,
      ].filter((c): c is string => !!c);

      let matchesDefault = false;
      for (const c of candidates) {
        if (await bcrypt.compare(c, u.passwordHash)) {
          matchesDefault = true;
          break;
        }
      }
      if (matchesDefault) {
        await prisma.user.update({
          where: { id: u.id },
          data: { mustChangePassword: true, passwordSetBy: 'system' },
        });
        flagged++;
      }
    }
    if (flagged > 0) {
      await prisma.setting.upsert({
        where: { key: 'FLAGGED_DEFAULT_PASSWORDS_COUNT' },
        update: { value: String(flagged) },
        create: { key: 'FLAGGED_DEFAULT_PASSWORDS_COUNT', value: String(flagged) },
      });
    }
    return flagged;
  } catch {
    return 0;
  }
}
