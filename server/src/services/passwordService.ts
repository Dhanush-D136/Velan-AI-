import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { revokeSessionToken } from '../middleware/auth';
import { presenceService } from './presenceService';

const COMMON_PASSWORDS = new Set([
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  'password',
  'password1',
  'password123',
  'qwerty',
  'qwerty123',
  'admin123',
  'student123',
  'faculty123',
  'welcome1',
  'letmein1',
]);

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  // Guarantee at least 1 letter and 1 digit
  if (!/[A-Za-z]/.test(out)) out = 'A' + out.slice(1);
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + '7';
  return out;
}

export async function validateNewPassword(
  newPassword: string,
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    phone?: string | null;
    passwordHash?: string;
    passwordHistory?: string | null;
    studentProfile?: { registerNo?: string | null; rollNo?: string | null; phone?: string | null } | null;
    facultyProfile?: { employeeId?: string | null } | null;
  },
  minLength = 8
): Promise<{ valid: boolean; error?: string }> {
  const pwd = newPassword || '';
  if (pwd.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters long.` };
  }
  if (!/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return { valid: false, error: 'Password must contain at least one letter and one number.' };
  }

  const lower = pwd.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(lower)) {
    return { valid: false, error: 'This password is too common. Please choose a stronger password.' };
  }

  const forbiddenTokens = [
    user.username,
    user.name,
    user.phone,
    user.studentProfile?.registerNo,
    user.studentProfile?.rollNo,
    user.studentProfile?.phone,
    user.facultyProfile?.employeeId,
  ]
    .filter((t): t is string => !!t && t.trim().length >= 3)
    .map((t) => t.trim().toLowerCase());

  for (const tok of forbiddenTokens) {
    if (lower === tok || (tok.length >= 4 && lower.includes(tok))) {
      return {
        valid: false,
        error: 'Password cannot match or contain your name, login ID, register/roll number, or phone number.',
      };
    }
  }

  // Check current hash and last 3 hashes in passwordHistory
  const prevHashes: string[] = [];
  if (user.passwordHash) prevHashes.push(user.passwordHash);
  if (user.passwordHistory) {
    try {
      const parsed = JSON.parse(user.passwordHistory);
      if (Array.isArray(parsed)) {
        for (const h of parsed) {
          if (typeof h === 'string' && !prevHashes.includes(h)) prevHashes.push(h);
        }
      }
    } catch {
      // ignore malformed history
    }
  }

  for (const hash of prevHashes.slice(0, 3)) {
    const reused = await bcrypt.compare(pwd, hash);
    if (reused) {
      return { valid: false, error: 'You cannot reuse your current or recent 3 passwords.' };
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
