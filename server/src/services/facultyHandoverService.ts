import { prisma, runTransaction } from '../lib/prisma';
import { invalidateUserAuthCache } from '../middleware/auth';

export async function getFacultyDeleteSummary(facultyId: string) {
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
  const [assignmentsCount, materialsCount, totalSessionsCount, chatMessagesCount] = await Promise.all([
    classSubjectIds.length
      ? prisma.assignment.count({ where: { classSubjectId: { in: classSubjectIds } } })
      : Promise.resolve(0),
    classSubjectIds.length
      ? prisma.material.count({ where: { classSubjectId: { in: classSubjectIds } } })
      : Promise.resolve(0),
    prisma.attendanceSession.count({ where: { facultyId } }),
    prisma.chatMessage.count({ where: { senderId: profile.userId } }),
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
    assignmentsCount,
    materialsCount,
    totalSessionsCount,
    chatMessagesCount,
  };
}

export async function deleteFacultyPermanently(facultyId: string, actorUserId: string) {
  const profile = await prisma.facultyProfile.findUnique({
    where: { id: facultyId },
    include: {
      user: { select: { id: true, name: true } },
      classSubjects: { select: { id: true } },
    },
  });

  if (!profile) {
    const err: any = new Error('Faculty not found');
    err.status = 404;
    throw err;
  }

  const formerLabel = `${profile.user.name} (former faculty)`;
  const csIds = profile.classSubjects.map((cs) => cs.id);

  await runTransaction(async (tx) => {
    // 1. Preserve attendance history & chat messages with name snapshots
    await Promise.all([
      tx.attendanceSession.updateMany({
        where: { facultyId },
        data: { facultyId: null, facultyName: formerLabel },
      }),
      tx.chatMessage.updateMany({
        where: { senderId: profile.userId },
        data: { senderId: null, senderName: formerLabel },
      }),
      tx.class.updateMany({
        where: { advisorId: facultyId },
        data: { advisorId: null },
      }),
      tx.classSubject.updateMany({
        where: { facultyId },
        data: { facultyId: null },
      }),
      tx.timetableSlot.deleteMany({ where: { facultyId } }),
      tx.auditLog.deleteMany({ where: { userId: profile.userId } }),
      ...(csIds.length > 0
        ? [
            tx.assignment.deleteMany({ where: { classSubjectId: { in: csIds } } }),
            tx.material.deleteMany({ where: { classSubjectId: { in: csIds } } }),
          ]
        : []),
    ]);

    // 2. Hard-delete User (DB ON DELETE CASCADE removes FacultyProfile, ClassMentor,
    //    UserSession, RefreshToken, UserDevice, DeviceChangeRequest, Notification,
    //    PushSubscription, NotificationPref, ChatRead, PasswordResetRequest)
    await tx.user.delete({ where: { id: profile.userId } });

    // 3. Post-check: verify zero references remain
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
      throw new Error('Could not complete deletion cleanly because references remained.');
    }

    // 4. Minimal audit log entry (admin, time, faculty ID)
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'FACULTY_DELETED',
        details: JSON.stringify({
          deletedFacultyId: facultyId,
          deletedEmployeeId: profile.employeeId,
        }),
      },
    });
  });

  invalidateUserAuthCache(profile.userId);
  return { message: `${profile.user.name} was permanently deleted.` };
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
  await runTransaction(async (tx) => {
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
