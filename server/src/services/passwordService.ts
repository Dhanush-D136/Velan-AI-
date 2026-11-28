import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { DEFAULT_PASSWORD } from '../config/passwordDefaults';
import { invalidateUserAuthCache } from '../middleware/auth';

export async function validateNewPassword(
  newPassword: string,
  user: {
    id: string;
    mustChangePassword?: boolean;
  }
): Promise<{ valid: boolean; error?: string }> {
  const pwd = newPassword || '';
  if (pwd.trim().length === 0) {
    return { valid: false, error: 'Password cannot be empty.' };
  }

  // On forced change: must not be the default password 1234
  if (user.mustChangePassword && pwd.trim() === DEFAULT_PASSWORD) {
    return {
      valid: false,
      error: 'Please choose a new password. It cannot be 1234.',
    };
  }

  return { valid: true };
}

export async function setDefaultPassword(
  userId: string,
  options: { by?: 'admin' | 'system'; actorUserId?: string } = {}
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!existing) throw new Error('User not found');
  if (existing.role === 'ADMIN') throw new Error('Admin account cannot be reset to the default password');

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const by = options.by || 'admin';

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: defaultHash,
        mustChangePassword: true,
        passwordSetBy: by,
        tempPasswordExpiresAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: options.actorUserId || userId,
        action: 'PASSWORD_RESET_DEFAULT',
        details: JSON.stringify({ targetUserId: userId, by }),
      },
    });
  });

  invalidateUserAuthCache(userId);
}

export async function getDefaultPasswordStats() {
  const count = await prisma.user.count({
    where: {
      role: { in: ['STUDENT', 'FACULTY'] },
      status: 'ACTIVE',
      deletedAt: null,
      mustChangePassword: true,
    },
  });
  return { count };
}

export async function previewDefaultPasswordMigration() {
  const count = await prisma.user.count({
    where: {
      role: { in: ['STUDENT', 'FACULTY'] },
      deletedAt: null,
      mustChangePassword: true,
      passwordSetBy: { not: 'self' },
    },
  });
  return { count };
}

export async function applyDefaultPasswordMigration(adminUserId: string) {
  const targets = await prisma.user.findMany({
    where: {
      role: { in: ['STUDENT', 'FACULTY'] },
      deletedAt: null,
      mustChangePassword: true,
      passwordSetBy: { not: 'self' },
    },
    select: { id: true },
  });
  if (targets.length === 0) return { updatedCount: 0 };

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const ids = targets.map((t) => t.id);

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: { in: ids } },
      data: {
        passwordHash: defaultHash,
        mustChangePassword: true,
        passwordSetBy: 'admin',
        tempPasswordExpiresAt: null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'DEFAULT_PASSWORD_MIGRATION',
        details: JSON.stringify({ count: ids.length }),
      },
    });
  });

  for (const id of ids) invalidateUserAuthCache(id);
  return { updatedCount: ids.length };
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
  const expiresAt = options.mustChange ? (options.expiresAt ?? null) : null;

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

    await tx.auditLog.create({
      data: {
        userId: options.actorUserId || userId,
        action: options.by === 'self' ? 'PASSWORD_CHANGED' : 'PASSWORD_RESET',
        details: JSON.stringify({
          targetUserId: userId,
          by: options.by,
          mustChange: options.mustChange,
        }),
      },
    });
  });

  invalidateUserAuthCache(userId);
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
