import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { canViewStudent } from '../utils/studentAccess';
import { calculateSkipMetrics } from '../utils/skipMath';
import { computeCumulativeCGPA } from '../utils/gpaMath';
import { notifyUsers } from './notificationController';

const DEFAULT_ACADEMIC_YEAR = '2025-2026';

async function syncAdvisorInClassMentors(classId: string, advisorId: string | null) {
  if (!advisorId) return;
  await prisma.classMentor.deleteMany({
    where: { classId, role: 'advisor', academicYear: DEFAULT_ACADEMIC_YEAR, NOT: { facultyId: advisorId } },
  });
  await prisma.classMentor.upsert({
    where: {
      classId_facultyId_academicYear: { classId, facultyId: advisorId, academicYear: DEFAULT_ACADEMIC_YEAR },
    },
    update: { role: 'advisor' },
    create: { classId, facultyId: advisorId, role: 'advisor', academicYear: DEFAULT_ACADEMIC_YEAR },
  });
}

// ==========================================
// ADMIN: MENTOR OVERVIEW & CLASS ASSIGNMENT
// ==========================================

export const getAdminMentorsOverview = async (_req: Request, res: Response) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        advisor: { include: { user: true } },
        classMentors: { include: { faculty: { include: { user: true } } } },
        students: true,
        mentees: true,
      },
      orderBy: { name: 'asc' },
    });

    const summary = classes.map((c) => {
      const totalStudents = c.students.length;
      const assignedCount = c.mentees.length;
      const unassignedCount = Math.max(0, totalStudents - assignedCount);
      return {
        classId: c.id,
        className: c.name,
        advisorName: c.advisor?.user?.name || 'Unassigned',
        mentorsCount: c.classMentors.length,
        totalStudents,
        assignedCount,
        unassignedCount,
        isComplete: totalStudents > 0 && unassignedCount === 0,
      };
    });

    return res.json({ classes: summary });
  } catch (err) {
    console.error('getAdminMentorsOverview error:', err);
    return res.status(500).json({ error: 'Failed to load mentor overview' });
  }
};

export const getClassMentorBoard = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        advisor: { include: { user: true } },
        students: { include: { user: true }, orderBy: { rollNo: 'asc' } },
      },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    await syncAdvisorInClassMentors(classId, cls.advisorId);

    const [classMentors, assignments, allFaculty, history, menteeCounts] = await Promise.all([
      prisma.classMentor.findMany({
        where: { classId, academicYear: DEFAULT_ACADEMIC_YEAR },
        include: { faculty: { include: { user: true, department: true } } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.menteeAssignment.findMany({
        where: { classId, academicYear: DEFAULT_ACADEMIC_YEAR },
      }),
      prisma.facultyProfile.findMany({
        where: { user: { status: 'ACTIVE' } },
        include: { user: true, department: true },
        orderBy: { employeeId: 'asc' },
      }),
      prisma.mentorAssignmentHistory.findMany({
        where: { studentId: { in: cls.students.map((s) => s.id) } },
        orderBy: { at: 'desc' },
        take: 40,
      }),
      prisma.menteeAssignment.groupBy({
        by: ['mentorId'],
        _count: { studentId: true },
      }),
    ]);

    const totalMenteeMap = new Map(menteeCounts.map((m) => [m.mentorId, m._count.studentId]));
    const assignMap = new Map(assignments.map((a) => [a.studentId, a.mentorId]));
    const mentorCount = Math.max(1, classMentors.length || 3);
    const targetGroupSize = Math.ceil(cls.students.length / mentorCount);

    return res.json({
      classInfo: {
        id: cls.id,
        name: cls.name,
        advisorId: cls.advisorId,
        advisorName: cls.advisor?.user?.name || null,
      },
      mentors: classMentors.map((cm) => ({
        id: cm.id,
        facultyId: cm.facultyId,
        name: cm.faculty.user.name,
        employeeId: cm.faculty.employeeId,
        departmentCode: cm.faculty.department?.code,
        role: cm.role,
        classMenteeCount: assignments.filter((a) => a.mentorId === cm.facultyId).length,
        totalMenteesAcrossClasses: totalMenteeMap.get(cm.facultyId) || 0,
      })),
      students: cls.students.map((s) => ({
        studentId: s.id,
        rollNo: s.rollNo,
        registerNo: s.registerNo,
        name: s.user.name,
        mentorId: assignMap.get(s.id) || null,
      })),
      facultyDirectory: allFaculty.map((f) => ({
        facultyId: f.id,
        name: f.user.name,
        employeeId: f.employeeId,
        departmentCode: f.department?.code,
        totalMenteesAcrossClasses: totalMenteeMap.get(f.id) || 0,
      })),
      rules: {
        targetGroupSize,
        minGroupSize: 15,
        maxGroupSize: targetGroupSize + 2,
      },
      stats: {
        totalStudents: cls.students.length,
        assignedCount: assignments.length,
        unassignedCount: cls.students.length - assignments.length,
        isComplete: cls.students.length > 0 && assignments.length === cls.students.length,
      },
      history,
    });
  } catch (err) {
    console.error('getClassMentorBoard error:', err);
    return res.status(500).json({ error: 'Failed to load class mentor board' });
  }
};

export const setClassMentors = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const { facultyIds } = req.body as { facultyIds: string[] };
    if (!Array.isArray(facultyIds)) return res.status(400).json({ error: 'facultyIds array required' });

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const uniqueIds = Array.from(new Set(facultyIds.filter(Boolean)));
    if (cls.advisorId && !uniqueIds.includes(cls.advisorId)) {
      uniqueIds.unshift(cls.advisorId);
    }

    await prisma.$transaction(async (tx) => {
      await tx.classMentor.deleteMany({
        where: { classId, academicYear: DEFAULT_ACADEMIC_YEAR },
      });
      for (const fid of uniqueIds) {
        await tx.classMentor.create({
          data: {
            classId,
            facultyId: fid,
            role: fid === cls.advisorId ? 'advisor' : 'mentor',
            academicYear: DEFAULT_ACADEMIC_YEAR,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CLASS_MENTORS_UPDATED',
          details: JSON.stringify({ classId, facultyIds: uniqueIds }),
        },
      });
    });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'mentors', classId });

    return res.json({ message: 'Class mentors updated', facultyIds: uniqueIds });
  } catch (err) {
    console.error('setClassMentors error:', err);
    return res.status(500).json({ error: 'Failed to update class mentors' });
  }
};

export const bulkAssignMentees = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const { studentIds, mentorId, reason } = req.body as {
      studentIds: string[];
      mentorId: string;
      reason?: string;
    };

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !mentorId) {
      return res.status(400).json({ error: 'studentIds and mentorId are required' });
    }

    const [cls, mentor] = await Promise.all([
      prisma.class.findUnique({ where: { id: classId } }),
      prisma.facultyProfile.findUnique({ where: { id: mentorId }, include: { user: true } }),
    ]);
    if (!cls || !mentor) return res.status(404).json({ error: 'Class or mentor not found' });

    // Ensure mentor is registered in ClassMentor
    await prisma.classMentor.upsert({
      where: {
        classId_facultyId_academicYear: { classId, facultyId: mentorId, academicYear: DEFAULT_ACADEMIC_YEAR },
      },
      update: {},
      create: {
        classId,
        facultyId: mentorId,
        role: cls.advisorId === mentorId ? 'advisor' : 'mentor',
        academicYear: DEFAULT_ACADEMIC_YEAR,
      },
    });

    const students = await prisma.studentProfile.findMany({
      where: { id: { in: studentIds }, classId },
      select: { id: true, userId: true },
    });

    const existingLinks = await prisma.menteeAssignment.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, academicYear: DEFAULT_ACADEMIC_YEAR },
    });
    const prevMentorMap = new Map(existingLinks.map((l) => [l.studentId, l.mentorId]));

    await prisma.$transaction(
      async (tx) => {
        const ids = students.map((s) => s.id);
        await tx.menteeAssignment.deleteMany({
          where: { studentId: { in: ids }, academicYear: DEFAULT_ACADEMIC_YEAR },
        });
        await tx.menteeAssignment.createMany({
          data: students.map((s) => ({
            studentId: s.id,
            classId,
            mentorId,
            academicYear: DEFAULT_ACADEMIC_YEAR,
            assignedBy: req.user!.id,
            assignedAt: new Date(),
          })),
        });
        await tx.mentorAssignmentHistory.createMany({
          data: students.map((s) => ({
            studentId: s.id,
            fromMentorId: prevMentorMap.get(s.id) || null,
            toMentorId: mentorId,
            byUserId: req.user!.id,
            reason: reason || 'Bulk assignment',
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'MENTEES_BULK_ASSIGNED',
            details: JSON.stringify({ classId, mentorId, count: students.length }),
          },
        });
      },
      { timeout: 20000 }
    );

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'mentors', classId });

    await notifyUsers(io, students.map((s) => s.userId), {
      title: 'Mentor Assigned',
      message: `Your mentor is now ${mentor.user.name}.`,
      type: 'MENTOR',
      link: '/settings',
    });
    await notifyUsers(io, [mentor.userId], {
      title: 'Mentees Updated',
      message: `${students.length} student(s) in ${cls.name} assigned to your mentoring group.`,
      type: 'MENTOR',
      link: '/faculty/mentoring',
    });

    return res.json({ message: `Assigned ${students.length} student(s) to ${mentor.user.name}`, count: students.length });
  } catch (err) {
    console.error('bulkAssignMentees error:', err);
    return res.status(500).json({ error: 'Failed to assign mentees' });
  }
};

export function computeEvenDistribution(studentIds: string[], mentorIds: string[]) {
  if (mentorIds.length === 0) return [];
  const total = studentIds.length;
  const n = mentorIds.length;
  const base = Math.floor(total / n);
  const rem = total % n;

  const groups: Array<{ mentorId: string; studentIds: string[] }> = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < rem ? 1 : 0);
    groups.push({
      mentorId: mentorIds[i],
      studentIds: studentIds.slice(cursor, cursor + size),
    });
    cursor += size;
  }
  return groups;
}

export const autoDistributeMentees = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const { commit = false, mentorIds } = req.body as { commit?: boolean; mentorIds?: string[] };

    const [cls, classMentors] = await Promise.all([
      prisma.class.findUnique({
        where: { id: classId },
        include: { students: { include: { user: true }, orderBy: { rollNo: 'asc' } } },
      }),
      prisma.classMentor.findMany({
        where: { classId, academicYear: DEFAULT_ACADEMIC_YEAR },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const activeMentorIds = mentorIds?.length ? mentorIds : classMentors.map((m) => m.facultyId);
    if (activeMentorIds.length === 0) {
      return res.status(400).json({ error: 'Choose at least 1 mentor for this class first.' });
    }

    const plan = computeEvenDistribution(
      cls.students.map((s) => s.id),
      activeMentorIds
    );

    if (!commit) {
      return res.json({ preview: plan });
    }

    await prisma.$transaction(
      async (tx) => {
        const allStudentIds = cls.students.map((s) => s.id);
        await tx.menteeAssignment.deleteMany({
          where: { studentId: { in: allStudentIds }, academicYear: DEFAULT_ACADEMIC_YEAR },
        });
        const rowsToCreate = plan.flatMap((group) =>
          group.studentIds.map((sid) => ({
            studentId: sid,
            classId,
            mentorId: group.mentorId,
            academicYear: DEFAULT_ACADEMIC_YEAR,
            assignedBy: req.user!.id,
            assignedAt: new Date(),
          }))
        );
        if (rowsToCreate.length > 0) {
          await tx.menteeAssignment.createMany({ data: rowsToCreate });
        }
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'MENTEES_AUTO_DISTRIBUTED',
            details: JSON.stringify({ classId, groups: plan.map((g) => ({ mentorId: g.mentorId, count: g.studentIds.length })) }),
          },
        });
      },
      { timeout: 20000 }
    );

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'mentors', classId });

    return res.json({ message: 'Students evenly distributed across mentors!', distribution: plan });
  } catch (err) {
    console.error('autoDistributeMentees error:', err);
    return res.status(500).json({ error: 'Failed to auto-distribute mentees' });
  }
};

export const exportMentorMappingExcel = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: { include: { user: true }, orderBy: { rollNo: 'asc' } },
        mentees: { include: { mentor: { include: { user: true } } } },
      },
    });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const map = new Map(cls.mentees.map((m) => [m.studentId, m.mentor]));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mentor Mapping');
    sheet.addRow(['Register Number', 'Roll No', 'Student Name', 'Mentor Faculty ID', 'Mentor Name']);
    for (const s of cls.students) {
      const m = map.get(s.id);
      sheet.addRow([s.registerNo, s.rollNo, s.user.name, m?.employeeId || '', m?.user?.name || 'Unassigned']);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Mentor_Mapping_${cls.section}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch {
    return res.status(500).json({ error: 'Failed to export mentor mapping' });
  }
};

export const importMentorMapping = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const { rows, commit = false } = req.body as {
      rows: Array<{ registerNo: string; mentorEmployeeId: string }>;
      commit?: boolean;
    };

    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows array required' });

    const [students, faculty] = await Promise.all([
      prisma.studentProfile.findMany({ where: { classId }, include: { user: true } }),
      prisma.facultyProfile.findMany({ include: { user: true } }),
    ]);

    const stMap = new Map(students.map((s) => [s.registerNo.toUpperCase(), s]));
    const facMap = new Map(faculty.map((f) => [f.employeeId.toUpperCase(), f]));

    const valid: any[] = [];
    const invalid: any[] = [];
    const seen = new Set<string>();

    for (const r of rows) {
      const reg = String(r.registerNo || '').trim().toUpperCase();
      const emp = String(r.mentorEmployeeId || '').trim().toUpperCase();
      if (seen.has(reg)) {
        invalid.push({ ...r, reason: 'Duplicate register number in file' });
        continue;
      }
      seen.add(reg);
      const st = stMap.get(reg);
      const fac = facMap.get(emp);
      if (!st) invalid.push({ ...r, reason: 'Student not in this class' });
      else if (!fac) invalid.push({ ...r, reason: 'Mentor Faculty ID not found' });
      else valid.push({ studentId: st.id, studentName: st.user.name, registerNo: reg, mentorId: fac.id, mentorName: fac.user.name });
    }

    if (!commit) {
      return res.json({ valid, invalid });
    }

    await prisma.$transaction(async (tx) => {
      for (const v of valid) {
        await tx.menteeAssignment.upsert({
          where: { studentId_academicYear: { studentId: v.studentId, academicYear: DEFAULT_ACADEMIC_YEAR } },
          update: { mentorId: v.mentorId, classId, assignedBy: req.user!.id, assignedAt: new Date() },
          create: {
            studentId: v.studentId,
            classId,
            mentorId: v.mentorId,
            academicYear: DEFAULT_ACADEMIC_YEAR,
            assignedBy: req.user!.id,
          },
        });
      }
    });

    return res.json({ message: `Imported ${valid.length} mentor assignment(s)`, count: valid.length, invalidCount: invalid.length });
  } catch {
    return res.status(500).json({ error: 'Failed to import mentor mapping' });
  }
};

export const reassignFacultyMentees = async (req: Request, res: Response) => {
  try {
    const { facultyId } = req.params;
    const { toFacultyId } = req.body as { toFacultyId: string };
    if (!toFacultyId || toFacultyId === facultyId) {
      return res.status(400).json({ error: 'Valid target toFacultyId is required' });
    }
    const updated = await prisma.menteeAssignment.updateMany({
      where: { mentorId: facultyId },
      data: { mentorId: toFacultyId, assignedBy: req.user!.id, assignedAt: new Date() },
    });
    await prisma.classMentor.deleteMany({ where: { facultyId } });
    return res.json({ message: `Reassigned ${updated.count} mentee(s)`, count: updated.count });
  } catch {
    return res.status(500).json({ error: 'Failed to reassign mentees' });
  }
};

// ==========================================
// FACULTY: MENTORING & UNIFIED ADVISOR VIEW
// ==========================================

export const getMyMentoringRoles = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        advisedClasses: true,
        mentorRoles: { include: { class: true } },
      },
    });
    if (!faculty) return res.status(404).json({ error: 'Faculty profile not found' });

    const roleMap = new Map<string, { classId: string; className: string; role: 'advisor' | 'mentor'; label: string }>();
    for (const c of faculty.advisedClasses) {
      roleMap.set(c.id, { classId: c.id, className: c.name, role: 'advisor', label: `Advisor: ${c.name}` });
    }
    for (const mr of faculty.mentorRoles) {
      if (!roleMap.has(mr.classId)) {
        roleMap.set(mr.classId, {
          classId: mr.classId,
          className: mr.class.name,
          role: mr.role === 'advisor' ? 'advisor' : 'mentor',
          label: `${mr.role === 'advisor' ? 'Advisor' : 'Mentor'}: ${mr.class.name}`,
        });
      }
    }

    return res.json({ roles: Array.from(roleMap.values()) });
  } catch {
    return res.status(500).json({ error: 'Failed to load mentoring roles' });
  }
};

export const getScopedMentees = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;
    const faculty = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
      include: { advisedClasses: true, mentorRoles: true },
    });
    if (!faculty) return res.status(403).json({ error: 'Faculty profile required' });

    const targetClassId = classId ? String(classId) : faculty.advisedClasses[0]?.id || faculty.mentorRoles[0]?.classId;
    if (!targetClassId) {
      return res.status(403).json({ error: 'You have no mentor or advisor assignments' });
    }

    const isAdvisor = faculty.advisedClasses.some((c) => c.id === targetClassId);
    const isMentor = faculty.mentorRoles.some((m) => m.classId === targetClassId);
    if (!isAdvisor && !isMentor) {
      return res.status(403).json({ error: 'Forbidden: not a mentor or advisor for this class' });
    }

    const [minSet, students, menteeLinks, openNotes] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'MIN_ATTENDANCE_PERCENT' } }),
      prisma.studentProfile.findMany({
        where: isAdvisor
          ? { classId: targetClassId }
          : { classId: targetClassId, menteeAssignments: { some: { mentorId: faculty.id } } },
        include: {
          user: true,
          class: true,
          menteeAssignments: { include: { mentor: { include: { user: true } } } },
          attendanceRecords: { where: { session: { isActive: false } } },
          academicSemesters: { include: { subjects: true }, orderBy: { semesterNumber: 'asc' } },
        },
        orderBy: { rollNo: 'asc' },
      }),
      prisma.menteeAssignment.findMany({
        where: { classId: targetClassId },
        include: { mentor: { include: { user: true } } },
      }),
      prisma.mentorNote.findMany({
        where: { mentorId: faculty.id, status: 'open' },
      }),
    ]);

    const minThresh = Number(minSet?.value || 75);
    const list = students.map((s) => {
      const total = s.attendanceRecords.length;
      const present = s.attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const attendancePercent = total > 0 ? Math.round((present / total) * 1000) / 10 : 100;
      const cum = computeCumulativeCGPA(s.academicSemesters);
      const latestSem = s.academicSemesters[s.academicSemesters.length - 1];
      const mLink = s.menteeAssignments[0];

      return {
        studentId: s.id,
        name: s.user.name,
        rollNo: s.rollNo,
        registerNo: s.registerNo,
        className: s.class.name,
        mentorId: mLink?.mentorId || null,
        mentorName: mLink?.mentor?.user?.name || 'Unassigned',
        isMyMentee: mLink?.mentorId === faculty.id,
        attendancePercent,
        belowThreshold: total > 0 && attendancePercent < minThresh,
        latestGpa: latestSem?.gpa ?? null,
        cgpa: cum.cgpa,
        arrearsCount: cum.arrearsCount,
        hasUploadedResults: s.academicSemesters.length > 0,
      };
    });

    // Group breakdown for advisor
    const mentorGroupMap = new Map<string, { mentorId: string; mentorName: string; count: number; sumAtt: number; sumCgpa: number; cgpaCount: number }>();
    if (isAdvisor) {
      for (const st of list) {
        const key = st.mentorId || 'unassigned';
        const g = mentorGroupMap.get(key) || {
          mentorId: key,
          mentorName: st.mentorName,
          count: 0,
          sumAtt: 0,
          sumCgpa: 0,
          cgpaCount: 0,
        };
        g.count++;
        g.sumAtt += st.attendancePercent;
        if (st.hasUploadedResults) {
          g.sumCgpa += st.cgpa;
          g.cgpaCount++;
        }
        mentorGroupMap.set(key, g);
      }
    }

    const avgAttendance =
      list.length > 0 ? Math.round((list.reduce((a, b) => a + b.attendancePercent, 0) / list.length) * 10) / 10 : 0;
    const uploadedList = list.filter((s) => s.hasUploadedResults);
    const avgCgpa =
      uploadedList.length > 0
        ? Math.round((uploadedList.reduce((a, b) => a + b.cgpa, 0) / uploadedList.length) * 100) / 100
        : 0;

    return res.json({
      scope: isAdvisor ? 'advisor' : 'mentor',
      classId: targetClassId,
      dashboard: {
        menteeCount: list.length,
        avgAttendance,
        belowThresholdCount: list.filter((s) => s.belowThreshold).length,
        withArrearsCount: list.filter((s) => s.arrearsCount > 0).length,
        avgCgpa,
        openActionItems: openNotes.length,
        meetingsDue: openNotes.filter((n) => n.followUpDate && n.followUpDate <= new Date(Date.now() + 7 * 86400000)).length,
      },
      students: list,
      mentorGroups: Array.from(mentorGroupMap.values()).map((g) => ({
        mentorId: g.mentorId,
        mentorName: g.mentorName,
        count: g.count,
        avgAttendance: g.count > 0 ? Math.round((g.sumAtt / g.count) * 10) / 10 : 0,
        avgCgpa: g.cgpaCount > 0 ? Math.round((g.sumCgpa / g.cgpaCount) * 100) / 100 : 0,
      })),
      totalMappings: menteeLinks.length,
    });
  } catch (err) {
    console.error('getScopedMentees error:', err);
    return res.status(500).json({ error: 'Failed to load mentees' });
  }
};

export const getFullStudentDetail = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const access = await canViewStudent(req.user!, studentId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Forbidden: you do not have access to this student' });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { include: { devices: { where: { status: 'ACTIVE' } } } },
        class: { include: { advisor: { include: { user: true } } } },
        menteeAssignments: { include: { mentor: { include: { user: true } } } },
        attendanceRecords: {
          where: { session: { isActive: false } },
          include: { session: { include: { classSubject: { include: { subject: true } } } } },
        },
        academicSemesters: {
          include: { subjects: { orderBy: { subjectCode: 'asc' } } },
          orderBy: { semesterNumber: 'asc' },
        },
        mentorNotes:
          req.user!.role === 'STUDENT'
            ? false
            : { include: { mentor: { include: { user: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const total = student.attendanceRecords.length;
    const present = student.attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const skipStatus = calculateSkipMetrics({ present, total, requiredPercent: 75 });
    const academics = computeCumulativeCGPA(student.academicSemesters);

    const [requests, recentAuth] = await Promise.all([
      prisma.studentRequest.findMany({ where: { userId: student.userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.authEvent.findMany({ where: { userId: student.userId }, orderBy: { timestamp: 'desc' }, take: 10 }),
    ]);

    return res.json({
      accessScope: access.scope,
      student: {
        id: student.id,
        name: student.user.name,
        rollNo: student.rollNo,
        registerNo: student.registerNo,
        phone: student.phone || student.user.phone,
        email: student.personalEmail || student.user.email,
        className: student.class.name,
        advisorName: student.class.advisor?.user?.name || 'Unassigned',
        mentorName: student.menteeAssignments[0]?.mentor?.user?.name || 'Unassigned',
      },
      attendance: skipStatus,
      academics: {
        semesters: student.academicSemesters,
        ...academics,
      },
      requests,
      devicesCount: student.user.devices.length,
      recentLogins: recentAuth.map((e) => ({ event: e.event, deviceType: e.deviceType, timestamp: e.timestamp })),
      ...(req.user!.role !== 'STUDENT' ? { mentorNotes: (student as any).mentorNotes || [] } : {}),
    });
  } catch (err) {
    console.error('getFullStudentDetail error:', err);
    return res.status(500).json({ error: 'Failed to load student detail' });
  }
};

export const createMentorNote = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const access = await canViewStudent(req.user!, studentId);
    if (!access.allowed || req.user!.role === 'STUDENT') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const faculty = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
    if (!faculty && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Faculty required' });

    const { type = 'meeting', note, followUpDate, status = 'open' } = req.body;
    if (!note || String(note).trim().length < 2) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const mentorId = faculty?.id || (await prisma.menteeAssignment.findFirst({ where: { studentId } }))?.mentorId;
    if (!mentorId) return res.status(400).json({ error: 'No mentor linked to this student yet' });

    const created = await prisma.mentorNote.create({
      data: {
        studentId,
        mentorId,
        type,
        note: String(note).trim(),
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        status,
      },
    });

    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: 'MENTOR_NOTE_CREATED', details: JSON.stringify({ studentId, noteId: created.id }) },
    });

    return res.status(201).json({ note: created });
  } catch {
    return res.status(500).json({ error: 'Failed to save mentor note' });
  }
};

export const deleteMentorNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const existing = await prisma.mentorNote.findUnique({ where: { id: noteId } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });

    const access = await canViewStudent(req.user!, existing.studentId);
    if (!access.allowed || req.user!.role === 'STUDENT') return res.status(403).json({ error: 'Forbidden' });

    await prisma.mentorNote.delete({ where: { id: noteId } });
    return res.json({ message: 'Note deleted' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete note' });
  }
};

export const sendMenteeAnnouncement = async (req: Request, res: Response) => {
  try {
    const { classId, title, message } = req.body;
    const faculty = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id }, include: { user: true } });
    if (!faculty) return res.status(403).json({ error: 'Faculty required' });

    const mentees = await prisma.menteeAssignment.findMany({
      where: { mentorId: faculty.id, ...(classId ? { classId } : {}) },
      include: { student: true },
    });
    if (mentees.length === 0) return res.status(403).json({ error: 'No mentees assigned to you' });

    const io = req.app.get('io');
    await notifyUsers(
      io,
      mentees.map((m) => m.student.userId),
      {
        title: title || `Message from Mentor ${faculty.user.name}`,
        message: String(message || '').trim(),
        type: 'MENTOR_ANNOUNCEMENT',
      }
    );

    return res.json({ message: `Sent announcement to ${mentees.length} mentee(s)` });
  } catch {
    return res.status(500).json({ error: 'Failed to send announcement' });
  }
};
