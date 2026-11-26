import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { notifyUsers } from './notificationController';
import {
  startAttendanceSessionSchema,
  markAttendanceSchema,
  manualAttendanceSchema,
  verifyGeofence,
  detectSpoofingFlags,
} from '@velan/shared';
import crypto from 'crypto';

// 5.1 Faculty starts GPS attendance session
export const startSession = async (req: Request, res: Response) => {
  try {
    const parseResult = startAttendanceSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { classId, subjectId, anchorLat, anchorLng, radiusMeters, durationMinutes, mode } =
      parseResult.data;

    // Verify faculty owns this class+subject assignment
    const facultyUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { facultyProfile: true },
    });

    if (!facultyUser?.facultyProfile) {
      return res.status(403).json({ error: 'Only registered faculty can start attendance sessions' });
    }

    const classSubject = await prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
    });

    if (!classSubject || classSubject.facultyId !== facultyUser.facultyProfile.id) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject for this class' });
    }

    // Generate rotating cryptographically signed session token
    const rotatingToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const session = await prisma.attendanceSession.create({
      data: {
        classId,
        classSubjectId: classSubject.id,
        facultyId: facultyUser.facultyProfile.id,
        anchorLat,
        anchorLng,
        radiusMeters,
        mode,
        rotatingToken,
        isActive: true,
        expiresAt,
      },
      include: {
        class: true,
        classSubject: { include: { subject: true } },
      },
    });

    // Notify class students via Socket.IO & Web Push
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('attendance:session_started', {
        sessionId: session.id,
        className: session.class.name,
        subjectName: session.classSubject.subject.name,
        subjectCode: session.classSubject.subject.code,
        facultyName: facultyUser.name,
        radiusMeters,
        expiresAt: expiresAt.toISOString(),
      });
      io.emit('data:updated', { resource: 'attendance', sessionId: session.id, classId });
    }

    const classStudents = await prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });
    await notifyUsers(
      io,
      classStudents.map((s) => s.userId),
      {
        title: `Attendance Open: ${session.classSubject.subject.name}`,
        message: `${session.classSubject.subject.name}, ${facultyUser.name}. Mark within ${durationMinutes} min.`,
        type: 'ATTENDANCE',
        link: '/student/mark-attendance',
      },
      'attendanceAlerts'
    );

    return res.json({
      message: 'GPS Attendance Session initiated successfully',
      session,
    });
  } catch (error: any) {
    console.error('startSession error:', error);
    return res.status(500).json({ error: 'Failed to start attendance session' });
  }
};

// 5.3 Student marks GPS attendance
export const markAttendance = async (req: Request, res: Response) => {
  try {
    const parseResult = markAttendanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { sessionId, rotatingToken, latitude, longitude, accuracy, timestamp, deviceId, isMocked } =
      parseResult.data;

    // 1. Verify student profile
    const studentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { studentProfile: true, devices: true },
    });

    if (!studentUser?.studentProfile) {
      return res.status(403).json({ error: 'Only enrolled students can mark attendance' });
    }

    // 2. Hardware device lock check (prevent friend marking for friend)
    const boundDevice = studentUser.devices.find((d) => d.status === 'ACTIVE');
    if (boundDevice && boundDevice.deviceId !== deviceId) {
      return res.status(403).json({
        error: 'Attendance can only be marked from your registered device. Switch detected.',
      });
    }

    // 3. Find active session
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { class: true },
    });

    if (!session || !session.isActive) {
      return res.status(400).json({ error: 'This attendance session is no longer active' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      return res.status(400).json({ error: 'Attendance session has expired' });
    }

    // 4. Verify student belongs to this specific class
    if (studentUser.studentProfile.classId !== session.classId) {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }

    // 5. Idempotent check (already marked?)
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId: studentUser.studentProfile.id,
        },
      },
    });

    if (existingRecord) {
      return res.status(409).json({
        message: 'Attendance already recorded for this session',
        record: existingRecord,
      });
    }

    // 6. Anti-spoofing heuristics
    const spoofCheck = detectSpoofingFlags({
      accuracy,
      isMocked,
      timestamp,
      currentCoord: { lat: latitude, lng: longitude },
    });

    // 7. Server-side Haversine geofence calculation
    const geofence = verifyGeofence(
      session.anchorLat,
      session.anchorLng,
      latitude,
      longitude,
      session.radiusMeters,
      accuracy
    );

    if (!geofence.isWithinRadius) {
      return res.status(400).json({
        error: `Geofence boundary exceeded. You are ${Math.round(geofence.distanceMeters)}m away (Radius: ${session.radiusMeters}m).`,
        distanceMeters: geofence.distanceMeters,
        radiusMeters: session.radiusMeters,
      });
    }

    // 8. Save verified record
    const record = await prisma.attendanceRecord.create({
      data: {
        sessionId,
        studentId: studentUser.studentProfile.id,
        status: 'PRESENT',
        method: 'GPS',
        distanceMeters: geofence.distanceMeters,
        accuracy,
        deviceId,
        flags: spoofCheck.flags.length > 0 ? spoofCheck.flags.join(',') : null,
      },
      include: { student: true },
    });

    // 9. Real-time broadcast to faculty & admin live board
    const io = req.app.get('io');
    if (io) {
      io.to(`session_${sessionId}`).emit('attendance:marked', {
        studentId: studentUser.studentProfile.id,
        studentName: studentUser.name,
        rollNo: studentUser.studentProfile.rollNo,
        status: 'PRESENT',
        distanceMeters: geofence.distanceMeters,
        markedAt: record.markedAt,
      });
    }

    return res.json({
      message: 'Attendance verified and recorded successfully!',
      distanceMeters: geofence.distanceMeters,
      record,
    });
  } catch (error: any) {
    console.error('markAttendance error:', error);
    return res.status(500).json({ error: 'Failed to record attendance' });
  }
};

// 5.4 Faculty / Admin Live Session Board data
export const getSessionLiveBoard = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        class: {
          include: {
            students: { include: { user: true } },
          },
        },
        classSubject: { include: { subject: true } },
        faculty: { include: { user: true } },
        records: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const recordsMap = new Map(session.records.map((r) => [r.studentId, r]));

    const roster = session.class.students.map((stud) => {
      const record = recordsMap.get(stud.id);
      return {
        studentId: stud.id,
        name: stud.user.name,
        registerNo: stud.registerNo,
        rollNo: stud.rollNo,
        avatarUrl: stud.user.avatarUrl,
        status: record ? record.status : 'NOT_MARKED',
        method: record ? record.method : null,
        distanceMeters: record?.distanceMeters,
        accuracy: record?.accuracy,
        markedAt: record?.markedAt,
        flags: record?.flags,
      };
    });

    const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
    const absentCount = roster.filter((r) => r.status === 'ABSENT').length;
    const notMarkedCount = roster.filter((r) => r.status === 'NOT_MARKED').length;

    return res.json({
      session: {
        id: session.id,
        className: session.class.name,
        subjectName: session.classSubject.subject.name,
        subjectCode: session.classSubject.subject.code,
        facultyName: session.faculty.user.name,
        anchorLat: session.anchorLat,
        anchorLng: session.anchorLng,
        radiusMeters: session.radiusMeters,
        mode: session.mode,
        isActive: session.isActive,
        expiresAt: session.expiresAt,
        totalEnrolled: roster.length,
        presentCount,
        absentCount,
        notMarkedCount,
      },
      roster,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch session board' });
  }
};

// 5.5 Manual Fallback & Past/Present Attendance CRUD Editing (Faculty for own sessions, Admin for any session)
export const submitManualAttendance = async (req: Request, res: Response) => {
  try {
    const parseResult = manualAttendanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { sessionId, records } = parseResult.data;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { faculty: true },
    });
    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    if (req.user!.role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
      if (!fac || session.facultyId !== fac.id) {
        return res.status(403).json({ error: 'You can only edit attendance for your own sessions' });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const r of records) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: { sessionId, studentId: r.studentId },
          },
          update: {
            status: r.status,
            method: 'MANUAL',
            markedBy: req.user!.name,
            markedAt: new Date(),
            remarks: r.remarks || `Edited by ${req.user!.name}`,
          },
          create: {
            sessionId,
            studentId: r.studentId,
            status: r.status,
            method: 'MANUAL',
            markedBy: req.user!.name,
            remarks: r.remarks || `Marked by ${req.user!.name}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'ATTENDANCE_OVERRIDE',
          details: `Updated ${records.length} record(s) for session ${sessionId}`,
        },
      });
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`session_${sessionId}`).emit('attendance:marked', { sessionId, updated: true });
      io.to(`class_${session.classId}`).emit('data:updated', {
        resource: 'attendance',
        sessionId,
        classId: session.classId,
      });
      io.emit('data:updated', { resource: 'attendance', sessionId, classId: session.classId });
    }

    return res.json({ message: 'Attendance updated and synced across all profiles successfully' });
  } catch (error: any) {
    console.error('submitManualAttendance error:', error);
    return res.status(500).json({ error: 'Failed to update attendance' });
  }
};

// Get saved attendance sessions history (filterable by classId, subjectId, date)
export const getAttendanceSessionsHistory = async (req: Request, res: Response) => {
  try {
    const { classId, subjectId, date } = req.query;
    const where: any = {};

    if (req.user!.role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
      if (!fac) return res.status(404).json({ error: 'Faculty profile not found' });
      where.facultyId = fac.id;
    }

    if (classId && classId !== 'ALL') {
      where.classId = String(classId);
    }
    if (subjectId && subjectId !== 'ALL') {
      where.classSubject = { subjectId: String(subjectId) };
    }
    if (date) {
      const start = new Date(String(date));
      start.setHours(0, 0, 0, 0);
      const end = new Date(String(date));
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        class: { include: { _count: { select: { students: true } } } },
        classSubject: { include: { subject: true } },
        faculty: { include: { user: true } },
        records: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = sessions.map((s) => {
      const presentCount = s.records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absentCount = s.records.filter((r) => r.status === 'ABSENT').length;
      const totalEnrolled = s.class._count.students;
      return {
        id: s.id,
        classId: s.classId,
        className: s.class.name,
        subjectId: s.classSubject.subjectId,
        subjectName: s.classSubject.subject.name,
        subjectCode: s.classSubject.subject.code,
        facultyName: s.faculty.user.name,
        periodNumber: s.periodNumber,
        isActive: s.isActive,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        closedAt: s.closedAt,
        totalEnrolled,
        presentCount,
        absentCount,
        percentage: totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0,
      };
    });

    return res.json({ sessions: formatted });
  } catch (error: any) {
    console.error('getAttendanceSessionsHistory error:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance sessions' });
  }
};

// Close session early (auto-marks remaining as ABSENT)
export const closeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { include: { students: true } },
        records: true,
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    const markedIds = new Set(session.records.map((r) => r.studentId));

    // Auto mark remaining students as ABSENT
    for (const student of session.class.students) {
      if (!markedIds.has(student.id)) {
        await prisma.attendanceRecord.create({
          data: {
            sessionId,
            studentId: student.id,
            status: 'ABSENT',
            method: 'MANUAL',
            markedBy: 'SYSTEM_AUTOCLOSE',
          },
        });
      }
    }

    return res.json({ message: 'Attendance session closed successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to close session' });
  }
};

// Delete attendance session (Faculty who owns it or Admin) + AuditLog
export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        class: true,
        classSubject: { include: { subject: true } },
        _count: { select: { records: true } },
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (req.user!.role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
      if (!fac || session.facultyId !== fac.id) {
        return res.status(403).json({ error: 'You can only delete your own attendance sessions' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendanceSession.delete({ where: { id: sessionId } });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'SESSION_DELETED',
          details: `Deleted session ${sessionId} (${session.class.name} - ${session.classSubject.subject.code}, ${session._count.records} records) from ${new Date(session.createdAt).toISOString()}`,
        },
      });
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${session.classId}`).emit('data:updated', {
        resource: 'attendance',
        deletedSessionId: sessionId,
        classId: session.classId,
      });
      io.emit('data:updated', { resource: 'attendance', deletedSessionId: sessionId, classId: session.classId });
    }

    return res.json({
      message: 'Attendance session and all its records deleted successfully',
      deletedRecordsCount: session._count.records,
    });
  } catch (error: any) {
    console.error('deleteSession error:', error);
    return res.status(500).json({ error: 'Failed to delete session' });
  }
};

// Extend active session duration (+5 min default)
export const extendSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const minutes = Number(req.body?.minutes || 5);

    const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session || !session.isActive) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    const baseTime = Math.max(Date.now(), new Date(session.expiresAt).getTime());
    const newExpiresAt = new Date(baseTime + minutes * 60 * 1000);

    const updated = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { expiresAt: newExpiresAt },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`session_${sessionId}`).emit('attendance:session_extended', {
        sessionId,
        expiresAt: newExpiresAt.toISOString(),
      });
      io.to(`class_${session.classId}`).emit('attendance:session_extended', {
        sessionId,
        expiresAt: newExpiresAt.toISOString(),
      });
    }

    return res.json({ message: `Session extended by ${minutes} minutes`, session: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to extend session' });
  }
};

// Admin: Get all live active sessions
export const getLiveSessionsList = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const sessions = await prisma.attendanceSession.findMany({
      where: { isActive: true, expiresAt: { gt: now } },
      include: {
        class: { include: { _count: { select: { students: true } } } },
        classSubject: { include: { subject: true } },
        faculty: { include: { user: true } },
        records: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ sessions });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch live sessions' });
  }
};

// Faculty Portal Overview & Assigned Classes/Sessions
export const getFacultyDashboardData = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        department: true,
        classSubjects: {
          include: {
            class: { include: { _count: { select: { students: true } } } },
            subject: true,
          },
        },
      },
    });
    if (!faculty) return res.status(404).json({ error: 'Faculty profile not found' });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayDay = dayNames[now.getDay()];
    const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const [todaysSlotsRaw, todaysSessions, recentSessions, activeSession] = await Promise.all([
      prisma.timetableSlot.findMany({
        where: { facultyId: faculty.id, dayOfWeek: todayDay },
        include: {
          class: { include: { _count: { select: { students: true } } } },
          classSubject: { include: { subject: true } },
        },
        orderBy: { periodNumber: 'asc' },
      }),
      prisma.attendanceSession.findMany({
        where: { facultyId: faculty.id, createdAt: { gte: startOfDay } },
        include: { records: true },
      }),
      prisma.attendanceSession.findMany({
        where: { facultyId: faculty.id },
        take: 15,
        include: {
          class: { include: { _count: { select: { students: true } } } },
          classSubject: { include: { subject: true } },
          records: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceSession.findFirst({
        where: { facultyId: faculty.id, isActive: true, expiresAt: { gt: now } },
        include: {
          class: true,
          classSubject: { include: { subject: true } },
        },
      }),
    ]);

    const todaysSlots = todaysSlotsRaw.map((slot) => {
      const match = todaysSessions.find(
        (s) =>
          s.classId === slot.classId &&
          s.classSubjectId === slot.classSubjectId &&
          (s.periodNumber === null || s.periodNumber === slot.periodNumber)
      );
      let state: 'LIVE' | 'COMPLETED' | 'NOT_TAKEN' | 'UPCOMING' = 'UPCOMING';
      if (match) {
        state = match.isActive && match.expiresAt > now ? 'LIVE' : 'COMPLETED';
      } else if (slot.endTime < nowHHmm) {
        state = 'NOT_TAKEN';
      }
      return {
        ...slot,
        studentCount: slot.class._count.students,
        state,
        sessionId: match?.id || null,
      };
    });

    const uniqueClassIds = new Set(faculty.classSubjects.map((cs) => cs.classId));
    let totalAssignedStudents = 0;
    const countedClasses = new Set<string>();
    faculty.classSubjects.forEach((cs) => {
      if (!countedClasses.has(cs.classId)) {
        countedClasses.add(cs.classId);
        totalAssignedStudents += cs.class._count.students;
      }
    });

    let totalMarks = 0;
    let presentMarks = 0;
    recentSessions.forEach((s) => {
      s.records.forEach((r) => {
        totalMarks++;
        if (r.status === 'PRESENT' || r.status === 'LATE') presentMarks++;
      });
    });

    return res.json({
      faculty,
      stats: {
        todaysPeriodsCount: todaysSlots.length,
        assignedClassesCount: uniqueClassIds.size,
        totalAssignedStudents,
        averageAttendance: totalMarks > 0 ? Math.round((presentMarks / totalMarks) * 1000) / 10 : 0,
      },
      todaysSlots,
      classSubjects: faculty.classSubjects,
      activeSession,
      recentSessions,
    });
  } catch (error: any) {
    console.error('getFacultyDashboardData error:', error);
    return res.status(500).json({ error: 'Failed to load faculty dashboard' });
  }
};

// Student Portal Overview, Active GPS Session (without leaking radius/coords), & History
export const getStudentDashboardData = async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        class: {
          include: {
            academicYear: { include: { department: true } },
            advisor: { include: { user: true } },
          },
        },
        attendanceRecords: {
          include: {
            session: {
              include: {
                classSubject: { include: { subject: true } },
                faculty: { include: { user: true } },
              },
            },
          },
          orderBy: { markedAt: 'desc' },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const now = new Date();
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayDay = dayNames[now.getDay()];

    const [activeSessionRaw, todaysSlots, classSubjects, minThresholdSetting] = await Promise.all([
      prisma.attendanceSession.findFirst({
        where: { classId: student.classId, isActive: true, expiresAt: { gt: now } },
        include: {
          classSubject: { include: { subject: true } },
          faculty: { include: { user: true } },
          records: { where: { studentId: student.id } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.timetableSlot.findMany({
        where: { classId: student.classId, dayOfWeek: todayDay },
        include: { classSubject: { include: { subject: true, faculty: { include: { user: true } } } } },
        orderBy: { periodNumber: 'asc' },
      }),
      prisma.classSubject.findMany({
        where: { classId: student.classId },
        include: { subject: true, faculty: { include: { user: true } } },
      }),
      prisma.setting.findUnique({ where: { key: 'MIN_ATTENDANCE_PERCENT' } }),
    ]);

    const minThreshold = Number(minThresholdSetting?.value || 75);

    // Strip anchorLat, anchorLng, radiusMeters so students cannot see/spoof geofence parameters
    const activeSession = activeSessionRaw
      ? {
          id: activeSessionRaw.id,
          subjectName: activeSessionRaw.classSubject.subject.name,
          subjectCode: activeSessionRaw.classSubject.subject.code,
          facultyName: activeSessionRaw.faculty.user.name,
          className: student.class.name,
          expiresAt: activeSessionRaw.expiresAt,
          rotatingToken: activeSessionRaw.rotatingToken,
          alreadyMarked: activeSessionRaw.records.length > 0,
          myRecord: activeSessionRaw.records[0] || null,
        }
      : null;

    // Subject-wise attendance breakdown
    const subjectMap = new Map<
      string,
      { code: string; name: string; attended: number; total: number }
    >();
    classSubjects.forEach((cs) => {
      subjectMap.set(cs.subject.id, {
        code: cs.subject.code,
        name: cs.subject.name,
        attended: 0,
        total: 0,
      });
    });

    // Calculate attendance strictly from CLOSED sessions (isActive === false) of the student's class
    const closedRecords = student.attendanceRecords.filter(
      (rec) => rec.session.classId === student.classId && !rec.session.isActive
    );

    let totalAttended = 0;
    const totalSessions = closedRecords.length;
    closedRecords.forEach((rec) => {
      const subj = rec.session.classSubject.subject;
      if (!subjectMap.has(subj.id)) {
        subjectMap.set(subj.id, { code: subj.code, name: subj.name, attended: 0, total: 0 });
      }
      const entry = subjectMap.get(subj.id)!;
      entry.total++;
      if (rec.status === 'PRESENT' || rec.status === 'LATE') {
        entry.attended++;
        totalAttended++;
      }
    });

    // Day-wise attendance breakdown ("Attended X of Y periods = Z%" + P1..P8 chips)
    const dayMap = new Map<
      string,
      {
        date: string;
        attended: number;
        total: number;
        periods: { periodNumber: number | null; subjectCode: string; status: string }[];
      }
    >();

    closedRecords.forEach((rec) => {
      const dateStr = new Date(rec.session.createdAt).toISOString().split('T')[0];
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { date: dateStr, attended: 0, total: 0, periods: [] });
      }
      const dEntry = dayMap.get(dateStr)!;
      dEntry.total++;
      const isPresent = rec.status === 'PRESENT' || rec.status === 'LATE';
      if (isPresent) dEntry.attended++;
      dEntry.periods.push({
        periodNumber: rec.session.periodNumber ?? dEntry.periods.length + 1,
        subjectCode: rec.session.classSubject.subject.code,
        status: isPresent ? 'PRESENT' : 'ABSENT',
      });
    });

    const dayWiseAttendance = Array.from(dayMap.values())
      .map((d) => ({
        ...d,
        periods: d.periods.sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0)),
        percent: d.total > 0 ? Math.round((d.attended / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const subjectBreakdown = Array.from(subjectMap.values()).map((s) => ({
      ...s,
      percent: s.total > 0 ? Math.round((s.attended / s.total) * 1000) / 10 : 0,
    }));

    const overallPercent =
      totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 1000) / 10 : 0;

    return res.json({
      student: {
        id: student.id,
        registerNo: student.registerNo,
        rollNo: student.rollNo,
        class: {
          ...student.class,
          advisorName: student.class.advisor?.user?.name || null,
        },
      },
      activeSession,
      todaysSlots,
      stats: {
        totalAttended,
        totalSessions,
        overallPercent,
        minThreshold,
        belowThreshold: totalSessions > 0 && overallPercent < minThreshold,
      },
      subjectBreakdown,
      dayWiseAttendance,
      history: closedRecords.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        subjectName: r.session.classSubject.subject.name,
        subjectCode: r.session.classSubject.subject.code,
        facultyName: r.session.faculty.user.name,
        status: r.status,
        method: r.method,
        distanceMeters: r.distanceMeters,
        markedAt: r.markedAt,
      })),
    });
  } catch (error: any) {
    console.error('getStudentDashboardData error:', error);
    return res.status(500).json({ error: 'Failed to load student dashboard' });
  }
};
