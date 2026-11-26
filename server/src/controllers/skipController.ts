import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { semesterDateSchema, holidaySchema } from '@velan/shared';
import { calculateSkipMetrics } from '../utils/skipMath';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function countRemainingSlotsBySubject(
  slots: Array<{ dayOfWeek: string; classSubject: { subjectId: string } }>,
  endDate: Date | null,
  holidayDates: Set<string>
) {
  const counts = new Map<string, number>();
  let totalRemaining = 0;
  if (!endDate) return { counts, totalRemaining };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1); // remaining from tomorrow onward

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (start > end) return { counts, totalRemaining };

  const slotsByDay = new Map<string, string[]>();
  for (const s of slots) {
    const arr = slotsByDay.get(s.dayOfWeek) || [];
    arr.push(s.classSubject.subjectId);
    slotsByDay.set(s.dayOfWeek, arr);
  }

  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 365) {
    guard++;
    const dateKey = cursor.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[cursor.getDay()];
    if (dayName !== 'SUNDAY' && !holidayDates.has(dateKey)) {
      const daySubjects = slotsByDay.get(dayName) || [];
      for (const subjId of daySubjects) {
        counts.set(subjId, (counts.get(subjId) || 0) + 1);
        totalRemaining++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { counts, totalRemaining };
}

export const getSkipOverview = async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        class: {
          include: {
            academicYear: { include: { department: true } },
            classSubjects: { include: { subject: true } },
          },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const [minSetting, condSetting, semesterDates, holidays, timetableSlots, closedRecords] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'MIN_ATTENDANCE_PERCENT' } }),
      prisma.setting.findUnique({ where: { key: 'CONDONATION_PERCENT' } }),
      prisma.semesterDate.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
      prisma.timetableSlot.findMany({
        where: { classId: student.classId },
        include: { classSubject: { include: { subject: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          session: { isActive: false },
        },
        include: {
          session: {
            include: {
              classSubject: { include: { subject: true } },
            },
          },
        },
      }),
    ]);

    const requiredPercent = minSetting ? Number(minSetting.value) || 75 : 75;
    const condonationPercent = condSetting ? Number(condSetting.value) || 65 : 65;

    const matchingSem =
      semesterDates.find(
        (s) =>
          s.academicYearId === student.class.academicYearId ||
          s.departmentId === student.class.academicYear.departmentId
      ) ||
      semesterDates.find((s) => !s.departmentId && !s.academicYearId) ||
      semesterDates[0] ||
      null;

    const holidaySet = new Set(holidays.map((h) => new Date(h.date).toISOString().slice(0, 10)));
    const { counts: remainingBySubject, totalRemaining } = countRemainingSlotsBySubject(
      timetableSlots,
      matchingSem ? new Date(matchingSem.endDate) : null,
      holidaySet
    );

    // Aggregate present/total overall and per subject
    let overallPresent = 0;
    let overallTotal = 0;
    const subjectStats = new Map<string, { subjectId: string; code: string; name: string; present: number; total: number }>();

    for (const cs of student.class.classSubjects) {
      subjectStats.set(cs.subjectId, {
        subjectId: cs.subjectId,
        code: cs.subject.code,
        name: cs.subject.name,
        present: 0,
        total: 0,
      });
    }

    for (const rec of closedRecords) {
      const subj = rec.session.classSubject.subject;
      const isPresent = rec.status === 'PRESENT' || rec.status === 'LATE';
      overallTotal++;
      if (isPresent) overallPresent++;

      const entry = subjectStats.get(subj.id) || {
        subjectId: subj.id,
        code: subj.code,
        name: subj.name,
        present: 0,
        total: 0,
      };
      entry.total++;
      if (isPresent) entry.present++;
      subjectStats.set(subj.id, entry);
    }

    const overall = calculateSkipMetrics({
      present: overallPresent,
      total: overallTotal,
      requiredPercent,
      condonationPercent,
      remainingScheduled: totalRemaining,
    });

    const subjects = Array.from(subjectStats.values()).map((s) => ({
      subjectId: s.subjectId,
      code: s.code,
      name: s.name,
      ...calculateSkipMetrics({
        present: s.present,
        total: s.total,
        requiredPercent,
        condonationPercent,
        remainingScheduled: remainingBySubject.get(s.subjectId) || 0,
        subjectLabel: s.name,
      }),
    }));

    // Tomorrow's scheduled periods for "skip tomorrow" simulation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    const tomorrowDay = DAY_NAMES[tomorrow.getDay()];
    const tomorrowSlots =
      tomorrowDay === 'SUNDAY' || holidaySet.has(tomorrowKey)
        ? []
        : timetableSlots
            .filter((s) => s.dayOfWeek === tomorrowDay)
            .map((s) => ({
              periodNumber: s.periodNumber,
              subjectId: s.classSubject.subjectId,
              subjectCode: s.classSubject.subject.code,
              subjectName: s.classSubject.subject.name,
            }));

    return res.json({
      requiredPercent,
      condonationPercent,
      semesterDate: matchingSem,
      holidaysCount: holidays.length,
      overall,
      subjects,
      tomorrowDay,
      tomorrowIsHoliday: tomorrowDay === 'SUNDAY' || holidaySet.has(tomorrowKey),
      tomorrowSlots,
      timetableSlotsCount: timetableSlots.length,
    });
  } catch (error: any) {
    console.error('getSkipOverview error:', error);
    return res.status(500).json({ error: 'Failed to calculate skip metrics' });
  }
};

export const getSemesterDates = async (_req: Request, res: Response) => {
  try {
    const semesterDates = await prisma.semesterDate.findMany({ orderBy: { startDate: 'desc' } });
    return res.json({ semesterDates });
  } catch {
    return res.status(500).json({ error: 'Failed to load semester dates' });
  }
};

export const upsertSemesterDate = async (req: Request, res: Response) => {
  try {
    const parse = semesterDateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { label, startDate, endDate, departmentId, academicYearId, isActive } = parse.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ error: 'Semester start date must be before end date' });
    }

    const id = req.params.id;
    const semesterDate = id
      ? await prisma.semesterDate.update({
          where: { id },
          data: { label, startDate: start, endDate: end, departmentId: departmentId || null, academicYearId: academicYearId || null, isActive },
        })
      : await prisma.semesterDate.create({
          data: { label, startDate: start, endDate: end, departmentId: departmentId || null, academicYearId: academicYearId || null, isActive },
        });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'semester_dates' });

    return res.json({ message: 'Semester dates saved', semesterDate });
  } catch {
    return res.status(500).json({ error: 'Failed to save semester dates' });
  }
};

export const deleteSemesterDate = async (req: Request, res: Response) => {
  try {
    await prisma.semesterDate.delete({ where: { id: req.params.id } });
    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'semester_dates' });
    return res.json({ message: 'Semester date removed' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete semester date' });
  }
};

export const getHolidays = async (_req: Request, res: Response) => {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
    return res.json({ holidays });
  } catch {
    return res.status(500).json({ error: 'Failed to load holidays' });
  }
};

export const createHoliday = async (req: Request, res: Response) => {
  try {
    const parse = holidaySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const holiday = await prisma.holiday.create({
      data: {
        name: parse.data.name.trim(),
        date: new Date(parse.data.date),
        type: 'ACADEMIC',
      },
    });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'holidays' });

    return res.status(201).json({ message: 'Holiday added', holiday });
  } catch {
    return res.status(500).json({ error: 'Failed to add holiday' });
  }
};

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    await prisma.holiday.delete({ where: { id: req.params.id } });
    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'holidays' });
    return res.json({ message: 'Holiday deleted' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete holiday' });
  }
};

export const updateThresholds = async (req: Request, res: Response) => {
  try {
    const { requiredPercent, condonationPercent } = req.body;
    const reqNum = Number(requiredPercent);
    const condNum = Number(condonationPercent);

    if (Number.isNaN(reqNum) || reqNum < 1 || reqNum > 100) {
      return res.status(400).json({ error: 'Required percentage must be between 1 and 100' });
    }
    if (Number.isNaN(condNum) || condNum < 0 || condNum > reqNum) {
      return res.status(400).json({ error: 'Condonation percentage must be between 0 and required percentage' });
    }

    await Promise.all([
      prisma.setting.upsert({
        where: { key: 'MIN_ATTENDANCE_PERCENT' },
        update: { value: String(reqNum) },
        create: { key: 'MIN_ATTENDANCE_PERCENT', value: String(reqNum), description: 'Minimum required attendance %' },
      }),
      prisma.setting.upsert({
        where: { key: 'CONDONATION_PERCENT' },
        update: { value: String(condNum) },
        create: { key: 'CONDONATION_PERCENT', value: String(condNum), description: 'Minimum condonation attendance %' },
      }),
    ]);

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'settings' });

    return res.json({ message: 'Attendance thresholds updated', requiredPercent: reqNum, condonationPercent: condNum });
  } catch {
    return res.status(500).json({ error: 'Failed to update thresholds' });
  }
};
