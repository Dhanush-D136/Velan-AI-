import { prisma } from '../lib/prisma';
import { invalidateUserAuthCache } from '../middleware/auth';

export async function getFacultyDependencies(facultyId: string) {
  const profile = await prisma.facultyProfile.findUnique({
    where: { id: facultyId },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
      department: { select: { id: true, name: true, code: true } },
      timetableSlots: {
        include: {
          class: { select: { id: true, name: true } },
          classSubject: { include: { subject: { select: { name: true, code: true } } } },
        },
      },
      advisedClasses: { select: { id: true, name: true } },
      classMentors: {
        include: { class: { select: { id: true, name: true } } },
      },
      classSubjects: {
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!profile) return null;

  const classSubjectIds = profile.classSubjects.map((cs) => cs.id);
  const [
    openSessionsCount,
    totalSessionsCount,
    assignmentsCount,
    materialsCount,
    chatMessages,
    notifications,
    sessions,
    devices,
    pushSubscriptions,
  ] = await Promise.all([
    prisma.attendanceSession.count({ where: { facultyId, isActive: true } }),
    prisma.attendanceSession.count({ where: { facultyId } }),
    classSubjectIds.length
      ? prisma.assignment.count({ where: { classSubjectId: { in: classSubjectIds } } })
      : Promise.resolve(0),
    classSubjectIds.length
      ? prisma.material.count({ where: { classSubjectId: { in: classSubjectIds } } })
      : Promise.resolve(0),
    prisma.chatMessage.count({ where: { senderId: profile.userId } }),
    prisma.notification.count({ where: { userId: profile.userId } }),
    prisma.userSession.count({ where: { userId: profile.userId } }),
    prisma.userDevice.count({ where: { userId: profile.userId } }),
    prisma.pushSubscription.count({ where: { userId: profile.userId } }),
  ]);

  return {
    faculty: {
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name,
      employeeId: profile.employeeId,
      email: profile.user.email,
      status: profile.user.status,
      departmentName: profile.department.name,
    },
    timetableSlots: profile.timetableSlots.map((s) => ({
      id: s.id,
      classId: s.classId,
      className: s.class.name,
      dayOfWeek: s.dayOfWeek,
      periodNumber: s.periodNumber,
      subjectName: s.classSubject.subject.name,
      subjectCode: s.classSubject.subject.code,
    })),
    advisedClasses: profile.advisedClasses,
    mentoredClasses: profile.classMentors.map((m) => ({
      classId: m.classId,
      className: m.class.name,
      role: m.role,
    })),
    classSubjects: profile.classSubjects.map((cs) => ({
      id: cs.id,
      classId: cs.classId,
      className: cs.class.name,
      subjectName: cs.subject.name,
      subjectCode: cs.subject.code,
    })),
    openSessionsCount,
    totalSessionsCount,
    assignmentsCount,
    materialsCount,
    counts: {
      chatMessages,
      notifications,
      sessions,
      devices,
      pushSubscriptions,
    },
  };
}

export interface FacultyHandoverOptions {
  confirmEmployeeId: string;
  timetableAction?: 'replace' | 'clear';
  timetableReplacementFacultyId?: string;
  advisorAction?: 'replace' | 'unassign';
  advisorReplacements?: Record<string, string>;
  mentorAction?: 'replace' | 'unassign';
  mentorReplacements?: Record<string, string>;
  assignmentsAction?: 'transfer' | 'delete';
  assignmentsTransferFacultyId?: string;
}

export async function executeFacultyDeleteWithHandover(
  facultyId: string,
  actorUserId: string,
  options: FacultyHandoverOptions
) {
  const profile = await prisma.facultyProfile.findUnique({
    where: { id: facultyId },
    include: {
      user: true,
      timetableSlots: { include: { class: true } },
      advisedClasses: true,
      classMentors: true,
      classSubjects: true,
    },
  });

  if (!profile) {
    const err: any = new Error('Faculty not found');
    err.status = 404;
    throw err;
  }

  if (
    String(options.confirmEmployeeId || '').trim().toUpperCase() !==
    profile.employeeId.toUpperCase()
  ) {
    const err: any = new Error(`Please type "${profile.employeeId}" to confirm permanent deletion.`);
    err.status = 400;
    throw err;
  }

  // Clash check if replacing timetable slots
  if (
    options.timetableAction === 'replace' &&
    options.timetableReplacementFacultyId &&
    profile.timetableSlots.length > 0
  ) {
    const repSlots = await prisma.timetableSlot.findMany({
      where: { facultyId: options.timetableReplacementFacultyId },
      include: { class: { select: { name: true } } },
    });
    const conflicts: string[] = [];
    for (const s of profile.timetableSlots) {
      const clash = repSlots.find(
        (r) => r.dayOfWeek === s.dayOfWeek && r.periodNumber === s.periodNumber
      );
      if (clash) {
        conflicts.push(`${s.dayOfWeek} P${s.periodNumber} (already teaching ${clash.class.name})`);
      }
    }
    if (conflicts.length > 0) {
      const err: any = new Error(
        `Timetable clash with replacement faculty: ${conflicts.slice(0, 4).join(', ')}`
      );
      err.status = 409;
      err.conflicts = conflicts;
      throw err;
    }
  }

  const formerLabel = `${profile.user.name} (former faculty)`;

  await prisma.$transaction(async (tx) => {
    // 1. Preserve attendance history with name snapshot + set facultyId to null
    await tx.attendanceSession.updateMany({
      where: { facultyId },
      data: { facultyId: null, facultyName: formerLabel },
    });

    // 2. Preserve chat messages with name snapshot + set senderId to null
    await tx.chatMessage.updateMany({
      where: { senderId: profile.userId },
      data: { senderId: null, senderName: formerLabel },
    });

    // 3. Handle advised classes
    for (const cls of profile.advisedClasses) {
      const repId =
        options.advisorAction === 'replace' ? options.advisorReplacements?.[cls.id] || null : null;
      await tx.class.update({
        where: { id: cls.id },
        data: { advisorId: repId },
      });
    }

    // 4. Handle mentor roles
    if (options.mentorAction === 'replace' && options.mentorReplacements) {
      for (const m of profile.classMentors) {
        const repId = options.mentorReplacements[m.classId];
        if (repId && repId !== facultyId) {
          const exists = await tx.classMentor.findFirst({
            where: { classId: m.classId, facultyId: repId },
          });
          if (!exists) {
            await tx.classMentor.update({
              where: { id: m.id },
              data: { facultyId: repId },
            });
          } else {
            await tx.classMentor.delete({ where: { id: m.id } });
          }
        } else {
          await tx.classMentor.delete({ where: { id: m.id } });
        }
      }
    } else {
      await tx.classMentor.deleteMany({ where: { facultyId } });
    }

    // 5. Handle timetable slots
    if (options.timetableAction === 'replace' && options.timetableReplacementFacultyId) {
      await tx.timetableSlot.updateMany({
        where: { facultyId },
        data: { facultyId: options.timetableReplacementFacultyId },
      });
    } else {
      await tx.timetableSlot.deleteMany({ where: { facultyId } });
    }

    // 6. Handle ClassSubject + Assignments + Materials
    const csIds = profile.classSubjects.map((cs) => cs.id);
    if (
      options.assignmentsAction === 'transfer' &&
      options.assignmentsTransferFacultyId &&
      options.assignmentsTransferFacultyId !== facultyId
    ) {
      await tx.classSubject.updateMany({
        where: { facultyId },
        data: { facultyId: options.assignmentsTransferFacultyId },
      });
    } else if (csIds.length > 0) {
      await tx.assignment.deleteMany({ where: { classSubjectId: { in: csIds } } });
      await tx.material.deleteMany({ where: { classSubjectId: { in: csIds } } });
      await tx.classSubject.deleteMany({ where: { facultyId } });
    }

    // 7. Hard delete sessions, tokens, devices, notifications, push subscriptions, profile & user
    await tx.userSession.deleteMany({ where: { userId: profile.userId } });
    await tx.refreshToken.deleteMany({ where: { userId: profile.userId } });
    await tx.userDevice.deleteMany({ where: { userId: profile.userId } });
    await tx.notification.deleteMany({ where: { userId: profile.userId } });
    await tx.pushSubscription.deleteMany({ where: { userId: profile.userId } });
    await tx.chatRead.deleteMany({ where: { userId: profile.userId } });
    await tx.passwordResetRequest.deleteMany({ where: { userId: profile.userId } });
    await tx.deviceChangeRequest.deleteMany({ where: { userId: profile.userId } });
    await tx.auditLog.deleteMany({ where: { userId: profile.userId } });

    await tx.facultyProfile.delete({ where: { id: facultyId } });
    await tx.user.delete({ where: { id: profile.userId } });

    // 8. Server-side post-check: verify no row still references facultyId or userId
    const [remFac, remUser, remSlots, remAdv, remMentor, remCs, remSess] = await Promise.all([
      tx.facultyProfile.count({ where: { id: facultyId } }),
      tx.user.count({ where: { id: profile.userId } }),
      tx.timetableSlot.count({ where: { facultyId } }),
      tx.class.count({ where: { advisorId: facultyId } }),
      tx.classMentor.count({ where: { facultyId } }),
      tx.classSubject.count({ where: { facultyId } }),
      tx.attendanceSession.count({ where: { facultyId } }),
    ]);

    if (remFac + remUser + remSlots + remAdv + remMentor + remCs + remSess > 0) {
      throw new Error('Post-delete integrity check failed: remaining references found');
    }

    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'FACULTY_DELETED_WITH_HANDOVER',
        details: JSON.stringify({
          deletedFacultyId: facultyId,
          deletedEmployeeId: profile.employeeId,
          deletedName: profile.user.name,
        }),
      },
    });
  });

  invalidateUserAuthCache(profile.userId);
  return { message: `Faculty ${profile.user.name} permanently deleted and history preserved.` };
}

export async function setFacultyActiveStatus(
  facultyId: string,
  isActive: boolean,
  actorUserId: string
) {
  const profile = await prisma.facultyProfile.findUnique({
    where: { id: facultyId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!profile) {
    const err: any = new Error('Faculty not found');
    err.status = 404;
    throw err;
  }

  const newStatus = isActive ? 'ACTIVE' : 'INACTIVE';
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: profile.userId },
      data: { status: newStatus },
    });
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: isActive ? 'FACULTY_REACTIVATED' : 'FACULTY_DEACTIVATED',
        details: JSON.stringify({ facultyId, employeeId: profile.employeeId, status: newStatus }),
      },
    });
  });

  invalidateUserAuthCache(profile.userId);
  return { status: newStatus, message: `${profile.user.name} is now ${newStatus.toLowerCase()}.` };
}
