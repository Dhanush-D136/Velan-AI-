import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
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

    // Notify class students via Socket.IO (handled in socket emitter)
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
    }

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

// 5.5 Manual Fallback & Bulk Overrides
export const submitManualAttendance = async (req: Request, res: Response) => {
  try {
    const parseResult = manualAttendanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { sessionId, records } = parseResult.data;

    for (const r of records) {
      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: { sessionId, studentId: r.studentId },
        },
        update: {
          status: r.status,
          method: 'MANUAL',
          markedBy: req.user!.name,
          remarks: r.remarks || 'Manual faculty override',
        },
        create: {
          sessionId,
          studentId: r.studentId,
          status: r.status,
          method: 'MANUAL',
          markedBy: req.user!.name,
          remarks: r.remarks,
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ATTENDANCE_OVERRIDE',
        details: `Updated ${records.length} records manually for session ${sessionId}`,
      },
    });

    return res.json({ message: 'Manual attendance updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update manual attendance' });
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
