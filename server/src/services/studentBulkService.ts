import bcrypt from 'bcryptjs';
import { prisma, prismaDirect, TX_OPTIONS } from '../lib/prisma';
import { DEFAULT_PASSWORD } from '../config/passwordDefaults';
import { invalidateUserAuthCache } from '../middleware/auth';
import { sortStudentsByRegisterNo } from '../utils/studentSort';

const BATCH_SIZE = 500;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Soft-deletes students in a single DB transaction (batched in chunks of 500).
 * - Sets StudentProfile.deletedAt + deletedBy and User.deletedAt + status = 'DELETED'
 * - Removes them from any currently OPEN attendance sessions and emits live Socket.IO updates
 * - Keeps historical AttendanceRecord / AcademicSemester intact for 30-day Recycle Bin restore
 */
export async function softDeleteStudents(
  studentIds: string[],
  adminUserId: string,
  io?: any
) {
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { deletedCount: 0, affectedClassIds: [] as string[] };

  const targets = await prisma.studentProfile.findMany({
    where: { id: { in: uniqueIds }, deletedAt: null },
    select: {
      id: true,
      userId: true,
      registerNo: true,
      classId: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
    },
  });

  if (targets.length === 0) return { deletedCount: 0, affectedClassIds: [] as string[] };

  const targetIds = targets.map((t) => t.id);
  const targetUserIds = targets.map((t) => t.userId);
  const affectedClassIds = Array.from(new Set(targets.map((t) => t.classId)));
  const now = new Date();

  // Class breakdown for audit log
  const breakdown: Record<string, number> = {};
  for (const t of targets) {
    const cname = t.class?.name || t.classId;
    breakdown[cname] = (breakdown[cname] || 0) + 1;
  }

  await prismaDirect.$transaction(async (tx) => {
    for (const idBatch of chunkArray(targetIds, BATCH_SIZE)) {
      await tx.studentProfile.updateMany({
        where: { id: { in: idBatch } },
        data: { deletedAt: now, deletedBy: adminUserId },
      });
      await tx.classRepresentative.deleteMany({
        where: { studentId: { in: idBatch } },
      });

      // Remove from OPEN (active) attendance sessions so live rosters/percentages update immediately
      await tx.attendanceRecord.deleteMany({
        where: {
          studentId: { in: idBatch },
          session: { isActive: true },
        },
      });
    }

    for (const uidBatch of chunkArray(targetUserIds, BATCH_SIZE)) {
      await tx.user.updateMany({
        where: { id: { in: uidBatch } },
        data: { deletedAt: now, status: 'INACTIVE' },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'STUDENTS_SOFT_DELETED',
        details: JSON.stringify({
          count: targets.length,
          classBreakdown: breakdown,
          registerNumbers: targets.map((t) => t.registerNo).slice(0, 100),
          deletedAt: now.toISOString(),
        }),
      },
    });
  }, { timeout: 30000 });

  for (const uid of targetUserIds) {
    invalidateUserAuthCache(uid);
  }

  if (io) {
    io.emit('data:updated', { resource: 'students' });
    for (const cid of affectedClassIds) {
      io.to(`class_${cid}`).emit('data:updated', { resource: 'attendance', classId: cid });
    }
  }

  return {
    deletedCount: targets.length,
    deletedIds: targetIds,
    affectedClassIds,
    classBreakdown: breakdown,
  };
}

/**
 * Restores soft-deleted students from the Recycle Bin.
 */
export async function restoreStudents(studentIds: string[], adminUserId: string, io?: any) {
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { restoredCount: 0 };

  const targets = await prisma.studentProfile.findMany({
    where: { id: { in: uniqueIds }, deletedAt: { not: null } },
    select: { id: true, userId: true, registerNo: true, classId: true },
  });
  if (targets.length === 0) return { restoredCount: 0 };

  const targetIds = targets.map((t) => t.id);
  const targetUserIds = targets.map((t) => t.userId);

  await prismaDirect.$transaction(async (tx) => {
    for (const idBatch of chunkArray(targetIds, BATCH_SIZE)) {
      await tx.studentProfile.updateMany({
        where: { id: { in: idBatch } },
        data: { deletedAt: null, deletedBy: null },
      });
    }
    for (const uidBatch of chunkArray(targetUserIds, BATCH_SIZE)) {
      await tx.user.updateMany({
        where: { id: { in: uidBatch } },
        data: { deletedAt: null, status: 'ACTIVE' },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'STUDENTS_RESTORED',
        details: JSON.stringify({
          count: targets.length,
          registerNumbers: targets.map((t) => t.registerNo).slice(0, 100),
        }),
      },
    });
  }, { timeout: 30000 });

  for (const uid of targetUserIds) {
    invalidateUserAuthCache(uid);
  }

  if (io) {
    io.emit('data:updated', { resource: 'students' });
  }

  return { restoredCount: targets.length };
}

/**
 * Permanently deletes students (and their User accounts + cascading records).
 */
export async function permanentDeleteStudents(studentIds: string[], adminUserId: string, io?: any) {
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { purgedCount: 0 };

  const targets = await prisma.studentProfile.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, userId: true, registerNo: true },
  });
  if (targets.length === 0) return { purgedCount: 0 };

  const userIds = targets.map((t) => t.userId);

  await prismaDirect.$transaction(async (tx) => {
    for (const uidBatch of chunkArray(userIds, BATCH_SIZE)) {
      await tx.user.deleteMany({ where: { id: { in: uidBatch } } });
    }
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'STUDENTS_PERMANENTLY_DELETED',
        details: JSON.stringify({
          count: targets.length,
          registerNumbers: targets.map((t) => t.registerNo).slice(0, 100),
        }),
      },
    });
  }, { timeout: 30000 });

  for (const uid of userIds) {
    invalidateUserAuthCache(uid);
  }

  if (io) io.emit('data:updated', { resource: 'students' });
  return { purgedCount: targets.length };
}

/**
 * Scheduled job: permanently purges Recycle Bin students deleted > 30 days ago.
 */
export async function purgeExpiredDeletedStudents(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const expired = await prisma.studentProfile.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { userId: true },
  });
  if (expired.length === 0) return 0;

  const userIds = expired.map((e) => e.userId);
  for (const batch of chunkArray(userIds, BATCH_SIZE)) {
    await prisma.user.deleteMany({ where: { id: { in: batch } } });
  }
  return expired.length;
}

/**
 * Bulk reset passwords for selected students back to DEFAULT_PASSWORD (1234).
 */
export async function bulkResetStudentPasswords(studentIds: string[], adminUserId: string) {
  const targets = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds }, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (targets.length === 0) return { resetCount: 0 };

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIds = targets.map((t) => t.userId);

  await prismaDirect.$transaction(async (tx) => {
    for (const uidBatch of chunkArray(userIds, BATCH_SIZE)) {
      await tx.user.updateMany({
        where: { id: { in: uidBatch } },
        data: {
          passwordHash: defaultHash,
          mustChangePassword: true,
          passwordSetBy: 'admin',
          tempPasswordExpiresAt: null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'BULK_PASSWORD_RESET_DEFAULT',
        details: JSON.stringify({ count: targets.length }),
      },
    });
  });

  for (const uid of userIds) invalidateUserAuthCache(uid);
  return { resetCount: targets.length };
}

/**
 * Bulk move selected students to a target class in one transaction (checks rollNo conflicts).
 */
export async function bulkMoveStudentsToClass(
  studentIds: string[],
  targetClassId: string,
  adminUserId: string,
  io?: any
) {
  const targetClass = await prisma.class.findUnique({ where: { id: targetClassId } });
  if (!targetClass) throw new Error('Target class not found');

  const moving = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds }, deletedAt: null },
    select: { id: true, registerNo: true, rollNo: true, classId: true },
  });
  if (moving.length === 0) return { movedCount: 0, conflicts: [] as string[] };

  const existingInTarget = await prisma.studentProfile.findMany({
    where: { classId: targetClassId, deletedAt: null },
    select: { rollNo: true },
  });
  const takenRolls = new Set(existingInTarget.map((e) => e.rollNo.toUpperCase()));
  const conflicts = moving
    .filter((m) => m.classId !== targetClassId && takenRolls.has(m.rollNo.toUpperCase()))
    .map((m) => `${m.registerNo} (Roll ${m.rollNo})`);

  if (conflicts.length > 0) {
    return { movedCount: 0, conflicts };
  }

  await prismaDirect.$transaction(async (tx) => {
    await tx.studentProfile.updateMany({
      where: { id: { in: moving.map((m) => m.id) } },
      data: { classId: targetClassId },
    });
    await tx.classRepresentative.deleteMany({
      where: { studentId: { in: moving.map((m) => m.id) } },
    });
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'BULK_MOVE_CLASS',
        details: JSON.stringify({ count: moving.length, targetClassId, targetClassName: targetClass.name }),
      },
    });
  });

  if (io) io.emit('data:updated', { resource: 'students' });
  return { movedCount: moving.length, conflicts: [] as string[] };
}
