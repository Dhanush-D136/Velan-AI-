import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { timetableSlotCreateSchema } from '@velan/shared';
import { notifyUsers } from './notificationController';

// Get weekly timetable for a class
export const getClassTimetable = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;

    const slots = await prisma.timetableSlot.findMany({
      where: { classId },
      include: {
        classSubject: { include: { subject: true, faculty: { include: { user: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    return res.json({ slots });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch timetable' });
  }
};

// Check for timetable conflicts before saving
export const checkConflicts = async (req: Request, res: Response) => {
  try {
    const { facultyId, roomNumber, dayOfWeek, periodNumber, currentClassId } = req.body;

    const conflicts: string[] = [];

    // 1. Faculty double-booked across ANY class in this period
    const facultyClash = await prisma.timetableSlot.findFirst({
      where: {
        facultyId,
        dayOfWeek,
        periodNumber,
        NOT: currentClassId ? { classId: currentClassId } : undefined,
      },
      include: { class: true },
    });

    if (facultyClash) {
      conflicts.push(
        `Faculty Conflict: Faculty is already assigned to ${facultyClash.class.name} on ${dayOfWeek} Period ${periodNumber}`
      );
    }

    // 2. Room occupied by another class in this period
    const roomClash = await prisma.timetableSlot.findFirst({
      where: {
        roomNumber,
        dayOfWeek,
        periodNumber,
        NOT: currentClassId ? { classId: currentClassId } : undefined,
      },
      include: { class: true },
    });

    if (roomClash) {
      conflicts.push(
        `Room Collision: Room ${roomNumber} is occupied by ${roomClash.class.name} on ${dayOfWeek} Period ${periodNumber}`
      );
    }

    return res.json({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Conflict check failed' });
  }
};

// Create or update timetable slot
export const saveSlot = async (req: Request, res: Response) => {
  try {
    const parseResult = timetableSlotCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { classId, subjectId, facultyId, dayOfWeek, periodNumber, startTime, endTime, roomNumber, isLabBlock } =
      parseResult.data;

    // Check conflict
    const facultyClash = await prisma.timetableSlot.findFirst({
      where: {
        facultyId,
        dayOfWeek,
        periodNumber,
        NOT: { classId },
      },
      include: { class: true },
    });

    if (facultyClash) {
      return res.status(409).json({
        error: `Faculty Conflict: Already scheduled in ${facultyClash.class.name} during this period`,
      });
    }

    // Ensure ClassSubject link exists
    let classSubject = await prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
    });

    if (!classSubject) {
      classSubject = await prisma.classSubject.create({
        data: { classId, subjectId, facultyId },
      });
    }

    const slot = await prisma.timetableSlot.upsert({
      where: {
        classId_dayOfWeek_periodNumber: { classId, dayOfWeek, periodNumber },
      },
      update: {
        classSubjectId: classSubject.id,
        facultyId,
        roomNumber,
        startTime,
        endTime,
        isLabBlock,
      },
      create: {
        classId,
        classSubjectId: classSubject.id,
        facultyId,
        dayOfWeek,
        periodNumber,
        startTime,
        endTime,
        roomNumber,
        isLabBlock,
      },
    });

    // Notify connected clients via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('timetable:updated', { classId, slot });
      io.emit('data:updated', { resource: 'timetable', classId });
    }

    // Notify students of this class and the assigned faculty
    const [students, facultyProfile] = await Promise.all([
      prisma.studentProfile.findMany({ where: { classId }, select: { userId: true } }),
      prisma.facultyProfile.findUnique({ where: { id: facultyId }, select: { userId: true } }),
    ]);
    const targetUserIds = [
      ...students.map((s) => s.userId),
      ...(facultyProfile ? [facultyProfile.userId] : []),
    ];
    await notifyUsers(
      io,
      targetUserIds,
      {
        title: 'Timetable Updated',
        message: `${dayOfWeek} Period ${periodNumber} (${startTime}–${endTime}) has been updated.`,
        type: 'TIMETABLE',
      },
      'timetableAlerts'
    );

    return res.json({ message: 'Timetable slot saved successfully', slot });
  } catch (error: any) {
    console.error('saveSlot error:', error);
    return res.status(500).json({ error: 'Failed to save timetable slot' });
  }
};

// Delete timetable slot (Admin only)
export const deleteSlot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const slot = await prisma.timetableSlot.findUnique({ where: { id } });
    if (!slot) return res.status(404).json({ error: 'Timetable slot not found' });

    await prisma.timetableSlot.delete({ where: { id } });

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${slot.classId}`).emit('timetable:updated', { classId: slot.classId, deletedId: id });
      io.emit('data:updated', { resource: 'timetable', classId: slot.classId });
    }

    const [students, facultyProfile] = await Promise.all([
      prisma.studentProfile.findMany({ where: { classId: slot.classId }, select: { userId: true } }),
      prisma.facultyProfile.findUnique({ where: { id: slot.facultyId }, select: { userId: true } }),
    ]);
    const targetUserIds = [
      ...students.map((s) => s.userId),
      ...(facultyProfile ? [facultyProfile.userId] : []),
    ];
    await notifyUsers(
      io,
      targetUserIds,
      {
        title: 'Timetable Slot Cleared',
        message: `${slot.dayOfWeek} Period ${slot.periodNumber} was removed from the timetable.`,
        type: 'TIMETABLE',
      },
      'timetableAlerts'
    );

    return res.json({ message: 'Timetable slot cleared successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete timetable slot' });
  }
};

// Faculty read-only "My Timetable" across all assigned classes
export const getFacultyTimetable = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!faculty) return res.status(404).json({ error: 'Faculty profile not found' });

    const slots = await prisma.timetableSlot.findMany({
      where: { facultyId: faculty.id },
      include: {
        class: true,
        classSubject: { include: { subject: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    return res.json({ slots });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch faculty timetable' });
  }
};

// Student read-only timetable for THEIR class only
export const getStudentTimetable = async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: { class: true },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const slots = await prisma.timetableSlot.findMany({
      where: { classId: student.classId },
      include: {
        classSubject: { include: { subject: true, faculty: { include: { user: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    return res.json({ class: student.class, slots });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch student timetable' });
  }
};
