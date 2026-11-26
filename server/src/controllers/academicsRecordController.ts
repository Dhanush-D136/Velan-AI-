import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import {
  academicSemesterSaveSchema,
  gradingScaleItemSchema,
  creditLookupSchema,
} from '@velan/shared';
import {
  DEFAULT_ANNA_2021_SCALE,
  computeSemesterSummary,
  computeCumulativeCGPA,
  GradeScaleEntry,
} from '../utils/gpaMath';
import { notifyUsers } from './notificationController';
import { canViewStudent } from '../utils/studentAccess';

async function ensureDefaultGradingScale(regulation = '2021') {
  const existing = await prisma.gradingScale.findMany({ where: { regulation } });
  if (existing.length > 0) return existing;

  if (regulation === '2021') {
    await prisma.gradingScale.createMany({
      data: DEFAULT_ANNA_2021_SCALE.map((g) => ({
        regulation: '2021',
        grade: g.grade,
        points: g.points,
        isPass: g.isPass,
        isArrear: g.isArrear,
        label: g.label || null,
      })),
      skipDuplicates: true,
    });
    return prisma.gradingScale.findMany({ where: { regulation } });
  }
  return existing;
}

async function getScaleForRegulation(regulation = '2021'): Promise<GradeScaleEntry[]> {
  const rows = await ensureDefaultGradingScale(regulation);
  if (rows.length === 0) return DEFAULT_ANNA_2021_SCALE;
  return rows.map((r) => ({
    grade: r.grade,
    points: r.points,
    isPass: r.isPass,
    isArrear: r.isArrear,
    label: r.label,
  }));
}

async function getCgpaMultiplierValue(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'CGPA_MULTIPLIER' } });
  const n = s ? Number(s.value) : 10;
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function buildStudentSummary(semesters: any[], multiplier: number) {
  const cumulative = computeCumulativeCGPA(semesters, multiplier);
  const lastUpdated =
    semesters.length > 0
      ? semesters.reduce((latest, s) => (s.updatedAt > latest ? s.updatedAt : latest), semesters[0].updatedAt)
      : null;

  return {
    semesters: [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber),
    cgpa: cumulative.cgpa,
    percentageEquivalent: cumulative.percentageEquivalent,
    totalCredits: cumulative.totalCredits,
    totalCreditsEarned: cumulative.totalCreditsEarned,
    totalGradePoints: cumulative.totalGradePoints,
    arrearsCount: cumulative.arrearsCount,
    activeArrears: cumulative.activeArrears,
    effectiveSubjects: cumulative.effectiveSubjects,
    lastUpdated,
  };
}

// ==========================================
// GRADING SCALE & CREDIT LOOKUP (ADMIN + READ)
// ==========================================

export const getGradingScales = async (req: Request, res: Response) => {
  try {
    const regulation = String(req.query.regulation || '2021');
    await ensureDefaultGradingScale('2021');
    const scales = await prisma.gradingScale.findMany({
      where: req.query.regulation ? { regulation } : undefined,
      orderBy: [{ regulation: 'asc' }, { points: 'desc' }],
    });
    const multiplier = await getCgpaMultiplierValue();
    return res.json({ scales, cgpaMultiplier: multiplier });
  } catch (err) {
    console.error('getGradingScales error:', err);
    return res.status(500).json({ error: 'Failed to load grading scales' });
  }
};

export const upsertGradingScale = async (req: Request, res: Response) => {
  try {
    const parse = gradingScaleItemSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { regulation, grade, points, isPass, isArrear, label } = parse.data;
    const item = await prisma.gradingScale.upsert({
      where: { regulation_grade: { regulation, grade: grade.toUpperCase() } },
      update: { points, isPass, isArrear, label: label || null },
      create: { regulation, grade: grade.toUpperCase(), points, isPass, isArrear, label: label || null },
    });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'grading_scales' });

    return res.json({ message: 'Grading scale updated', item });
  } catch {
    return res.status(500).json({ error: 'Failed to update grading scale' });
  }
};

export const updateCgpaMultiplier = async (req: Request, res: Response) => {
  try {
    const val = Number(req.body.multiplier);
    if (!Number.isFinite(val) || val <= 0 || val > 20) {
      return res.status(400).json({ error: 'Multiplier must be a positive number (e.g. 10)' });
    }
    await prisma.setting.upsert({
      where: { key: 'CGPA_MULTIPLIER' },
      update: { value: String(val) },
      create: { key: 'CGPA_MULTIPLIER', value: String(val), description: 'CGPA to percentage multiplier' },
    });
    return res.json({ message: 'CGPA multiplier updated', multiplier: val });
  } catch {
    return res.status(500).json({ error: 'Failed to update CGPA multiplier' });
  }
};

export const getCreditLookups = async (_req: Request, res: Response) => {
  try {
    const lookups = await prisma.subjectCreditLookup.findMany({ orderBy: { subjectCode: 'asc' } });
    return res.json({ lookups });
  } catch {
    return res.status(500).json({ error: 'Failed to load subject credit lookup' });
  }
};

export const upsertCreditLookup = async (req: Request, res: Response) => {
  try {
    const parse = creditLookupSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { subjectCode, subjectName, credits, regulation } = parse.data;
    const lookup = await prisma.subjectCreditLookup.upsert({
      where: { subjectCode },
      update: { subjectName: subjectName || null, credits, regulation },
      create: { subjectCode, subjectName: subjectName || null, credits, regulation },
    });
    return res.json({ message: 'Subject credit lookup saved', lookup });
  } catch {
    return res.status(500).json({ error: 'Failed to save credit lookup' });
  }
};

export const deleteCreditLookup = async (req: Request, res: Response) => {
  try {
    await prisma.subjectCreditLookup.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Credit lookup deleted' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete credit lookup' });
  }
};

// ==========================================
// STUDENT ACADEMICS (OWN ONLY)
// ==========================================

export const getMyAcademics = async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: true,
        class: { include: { advisor: { include: { user: true } } } },
        academicSemesters: {
          include: { subjects: { orderBy: { subjectCode: 'asc' } } },
          orderBy: { semesterNumber: 'asc' },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const [scales, multiplier, lookups] = await Promise.all([
      getScaleForRegulation('2021'),
      getCgpaMultiplierValue(),
      prisma.subjectCreditLookup.findMany(),
    ]);

    const summary = buildStudentSummary(student.academicSemesters, multiplier);

    return res.json({
      student: {
        id: student.id,
        name: student.user.name,
        registerNo: student.registerNo,
        rollNo: student.rollNo,
        className: student.class.name,
        advisorName: student.class.advisor?.user?.name || null,
      },
      regulation: student.academicSemesters[0]?.regulation || '2021',
      cgpaMultiplier: multiplier,
      scales,
      creditLookups: lookups,
      hasSavedBefore: student.academicSemesters.length > 0 && !!student.mentorConsentAcceptedAt,
      needsMentorConsentReaccept: !student.mentorConsentAcceptedAt,
      ...summary,
    });
  } catch (err) {
    console.error('getMyAcademics error:', err);
    return res.status(500).json({ error: 'Failed to load academic records' });
  }
};

export const saveMySemester = async (req: Request, res: Response) => {
  try {
    const parse = academicSemesterSaveSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const student = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: true,
        class: { include: { advisor: { include: { user: true } } } },
        academicSemesters: { include: { subjects: true } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const { semesterNumber, regulation, sessionLabel, source, consentGiven, subjects } = parse.data;

    if ((!student.mentorConsentAcceptedAt || student.academicSemesters.length === 0) && !consentGiven) {
      return res.status(400).json({
        error: 'Please tick the consent notice before saving your results.',
      });
    }
    if (consentGiven && !student.mentorConsentAcceptedAt) {
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { mentorConsentAcceptedAt: new Date() },
      });
    }

    const scale = await getScaleForRegulation(regulation);
    const computed = computeSemesterSummary(subjects, scale);

    // Check prior attempts for attemptHistory
    const priorAttemptsByCode = new Map<string, any[]>();
    for (const sem of student.academicSemesters) {
      if (sem.semesterNumber === semesterNumber) continue;
      for (const sub of sem.subjects) {
        const list = priorAttemptsByCode.get(sub.subjectCode) || [];
        list.push({
          semesterNumber: sem.semesterNumber,
          grade: sub.grade,
          gradePoint: sub.gradePoint,
          result: sub.result,
        });
        priorAttemptsByCode.set(sub.subjectCode, list);
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existingSem = await tx.academicSemester.findUnique({
        where: { studentId_semesterNumber: { studentId: student.id, semesterNumber } },
      });

      let semRecord;
      if (existingSem) {
        await tx.academicSubject.deleteMany({ where: { academicSemesterId: existingSem.id } });
        semRecord = await tx.academicSemester.update({
          where: { id: existingSem.id },
          data: {
            regulation,
            sessionLabel: sessionLabel || null,
            gpa: computed.gpa,
            totalCredits: computed.totalCredits,
            totalGradePoints: computed.totalGradePoints,
            source,
            consentGivenAt: existingSem.consentGivenAt || (consentGiven ? new Date() : null),
            subjects: {
              create: computed.subjects.map((sub) => {
                const prior = priorAttemptsByCode.get(sub.subjectCode) || [];
                return {
                  subjectCode: sub.subjectCode,
                  subjectName: sub.subjectName,
                  credits: sub.credits,
                  grade: sub.grade,
                  gradePoint: sub.gradePoint,
                  result: sub.result,
                  isArrear: sub.isArrear,
                  isNonCredit: sub.isNonCredit,
                  isCleared: sub.isCleared,
                  attemptHistory: prior.length > 0 ? JSON.stringify(prior) : null,
                };
              }),
            },
          },
          include: { subjects: true },
        });
      } else {
        semRecord = await tx.academicSemester.create({
          data: {
            studentId: student.id,
            semesterNumber,
            regulation,
            sessionLabel: sessionLabel || null,
            gpa: computed.gpa,
            totalCredits: computed.totalCredits,
            totalGradePoints: computed.totalGradePoints,
            source,
            consentGivenAt: consentGiven ? new Date() : new Date(),
            subjects: {
              create: computed.subjects.map((sub) => {
                const prior = priorAttemptsByCode.get(sub.subjectCode) || [];
                return {
                  subjectCode: sub.subjectCode,
                  subjectName: sub.subjectName,
                  credits: sub.credits,
                  grade: sub.grade,
                  gradePoint: sub.gradePoint,
                  result: sub.result,
                  isArrear: sub.isArrear,
                  isNonCredit: sub.isNonCredit,
                  isCleared: sub.isCleared,
                  attemptHistory: prior.length > 0 ? JSON.stringify(prior) : null,
                };
              }),
            },
          },
          include: { subjects: true },
        });
      }
      return semRecord;
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('data:updated', { resource: 'academics', studentId: student.id, classId: student.classId });
    }

    if (student.class.advisor?.userId) {
      await notifyUsers(io, [student.class.advisor.userId], {
        title: 'Student Results Updated',
        message: `${student.user.name} (${student.registerNo}) saved Semester ${semesterNumber} results (GPA: ${computed.gpa}).`,
        type: 'ACADEMICS',
        link: '/faculty/advisees',
      });
    }

    return res.json({ message: `Semester ${semesterNumber} results saved!`, semester: saved });
  } catch (err) {
    console.error('saveMySemester error:', err);
    return res.status(500).json({ error: 'Failed to save semester results' });
  }
};

export const deleteMySemester = async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.id } });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const sem = await prisma.academicSemester.findUnique({ where: { id: req.params.id } });
    if (!sem || sem.studentId !== student.id) {
      return res.status(403).json({ error: 'You can only delete your own academic semester' });
    }

    await prisma.academicSemester.delete({ where: { id: sem.id } });
    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'academics', studentId: student.id });

    return res.json({ message: 'Semester deleted' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete semester' });
  }
};

// ==========================================
// ADVISOR & ADMIN ACADEMICS VIEWS
// ==========================================

export const getAdviseeAcademics = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
      include: { advisedClasses: true },
    });
    if (!faculty) return res.status(403).json({ error: 'Faculty profile required' });
    if (faculty.advisedClasses.length === 0) {
      return res.status(403).json({ error: 'Only class advisors can access My Advisees Academics' });
    }

    const advisedIds = faculty.advisedClasses.map((c) => c.id);
    const students = await prisma.studentProfile.findMany({
      where: { classId: { in: advisedIds } },
      include: {
        user: true,
        class: true,
        academicSemesters: {
          include: { subjects: true },
          orderBy: { semesterNumber: 'asc' },
        },
      },
      orderBy: { rollNo: 'asc' },
    });

    const multiplier = await getCgpaMultiplierValue();
    const list = students.map((s) => {
      const summary = buildStudentSummary(s.academicSemesters, multiplier);
      const latestSem =
        summary.semesters.length > 0 ? summary.semesters[summary.semesters.length - 1] : null;
      return {
        studentId: s.id,
        name: s.user.name,
        rollNo: s.rollNo,
        registerNo: s.registerNo,
        classId: s.classId,
        className: s.class.name,
        latestSemester: latestSem?.semesterNumber || null,
        latestGpa: latestSem?.gpa ?? null,
        cgpa: summary.cgpa,
        totalCredits: summary.totalCredits,
        arrearsCount: summary.arrearsCount,
        hasUploaded: summary.semesters.length > 0,
        lastUpdated: summary.lastUpdated,
      };
    });

    return res.json({
      advisedClasses: faculty.advisedClasses,
      students: list,
    });
  } catch (err) {
    console.error('getAdviseeAcademics error:', err);
    return res.status(500).json({ error: 'Failed to load advisee academics' });
  }
};

export const getAdminAcademics = async (req: Request, res: Response) => {
  try {
    const { departmentId, classId } = req.query;
    const where: any = {};
    if (classId && classId !== 'ALL') {
      where.classId = String(classId);
    } else if (departmentId && departmentId !== 'ALL') {
      where.class = { academicYear: { departmentId: String(departmentId) } };
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: true,
        class: { include: { academicYear: { include: { department: true } } } },
        academicSemesters: {
          include: { subjects: true },
          orderBy: { semesterNumber: 'asc' },
        },
      },
      orderBy: { rollNo: 'asc' },
    });

    const multiplier = await getCgpaMultiplierValue();
    const deptMap = new Map<string, { code: string; name: string; sumCgpa: number; count: number }>();

    const list = students.map((s) => {
      const summary = buildStudentSummary(s.academicSemesters, multiplier);
      const latestSem =
        summary.semesters.length > 0 ? summary.semesters[summary.semesters.length - 1] : null;
      const dept = s.class.academicYear.department;
      if (summary.semesters.length > 0) {
        const dEntry = deptMap.get(dept.id) || { code: dept.code, name: dept.name, sumCgpa: 0, count: 0 };
        dEntry.sumCgpa += summary.cgpa;
        dEntry.count += 1;
        deptMap.set(dept.id, dEntry);
      }

      return {
        studentId: s.id,
        name: s.user.name,
        rollNo: s.rollNo,
        registerNo: s.registerNo,
        classId: s.classId,
        className: s.class.name,
        departmentCode: dept.code,
        latestSemester: latestSem?.semesterNumber || null,
        latestGpa: latestSem?.gpa ?? null,
        cgpa: summary.cgpa,
        totalCredits: summary.totalCredits,
        arrearsCount: summary.arrearsCount,
        hasUploaded: summary.semesters.length > 0,
        lastUpdated: summary.lastUpdated,
      };
    });

    const departmentAverages = Array.from(deptMap.values()).map((d) => ({
      code: d.code,
      name: d.name,
      studentCount: d.count,
      averageCgpa: d.count > 0 ? Math.round((d.sumCgpa / d.count) * 100) / 100 : 0,
    }));

    return res.json({ students: list, departmentAverages });
  } catch (err) {
    console.error('getAdminAcademics error:', err);
    return res.status(500).json({ error: 'Failed to load institution academics' });
  }
};

export const getStudentAcademicDetail = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        class: { include: { advisor: { include: { user: true } } } },
        academicSemesters: {
          include: { subjects: { orderBy: { subjectCode: 'asc' } } },
          orderBy: { semesterNumber: 'asc' },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const access = await canViewStudent(req.user!, studentId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Forbidden: you do not have access to this student' });
    }

    const multiplier = await getCgpaMultiplierValue();
    const summary = buildStudentSummary(student.academicSemesters, multiplier);

    return res.json({
      student: {
        id: student.id,
        name: student.user.name,
        registerNo: student.registerNo,
        rollNo: student.rollNo,
        className: student.class.name,
      },
      ...summary,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load student academic detail' });
  }
};

export const adminSaveStudentSemester = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const parse = academicSemesterSaveSchema.safeParse({ ...req.body, source: 'ADMIN', consentGiven: true });
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { semesterNumber, regulation, sessionLabel, subjects } = parse.data;
    const scale = await getScaleForRegulation(regulation);
    const computed = computeSemesterSummary(subjects, scale);

    const existingSem = await prisma.academicSemester.findUnique({
      where: { studentId_semesterNumber: { studentId, semesterNumber } },
      include: { subjects: true },
    });

    const oldSummary = existingSem
      ? { gpa: existingSem.gpa, subjectsCount: existingSem.subjects.length }
      : null;

    const saved = await prisma.$transaction(async (tx) => {
      if (existingSem) {
        await tx.academicSubject.deleteMany({ where: { academicSemesterId: existingSem.id } });
        return tx.academicSemester.update({
          where: { id: existingSem.id },
          data: {
            regulation,
            sessionLabel: sessionLabel || null,
            gpa: computed.gpa,
            totalCredits: computed.totalCredits,
            totalGradePoints: computed.totalGradePoints,
            source: 'ADMIN',
            editedByAdmin: true,
            subjects: {
              create: computed.subjects.map((sub) => ({
                ...sub,
                editedByAdmin: true,
              })),
            },
          },
          include: { subjects: true },
        });
      } else {
        return tx.academicSemester.create({
          data: {
            studentId,
            semesterNumber,
            regulation,
            sessionLabel: sessionLabel || null,
            gpa: computed.gpa,
            totalCredits: computed.totalCredits,
            totalGradePoints: computed.totalGradePoints,
            source: 'ADMIN',
            editedByAdmin: true,
            consentGivenAt: new Date(),
            subjects: {
              create: computed.subjects.map((sub) => ({
                ...sub,
                editedByAdmin: true,
              })),
            },
          },
          include: { subjects: true },
        });
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ACADEMIC_RECORD_EDITED',
        details: JSON.stringify({
          studentId,
          registerNo: student.registerNo,
          semesterNumber,
          oldValue: oldSummary,
          newValue: { gpa: computed.gpa, subjectsCount: computed.subjects.length },
        }),
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('data:updated', { resource: 'academics', studentId });
    }
    await notifyUsers(io, [student.userId], {
      title: 'Academic Record Edited by Admin',
      message: `Your Semester ${semesterNumber} academic record was updated by Admin (GPA: ${computed.gpa}).`,
      type: 'ACADEMICS',
      link: '/student/academics',
    });

    return res.json({ message: 'Student academic record updated by Admin', semester: saved });
  } catch (err) {
    console.error('adminSaveStudentSemester error:', err);
    return res.status(500).json({ error: 'Failed to update student academic record' });
  }
};

// ==========================================
// EXCEL & PDF EXPORTS
// ==========================================

export const exportAcademicsExcel = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;
    const role = req.user!.role;

    const where: any = {};
    if (role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({
        where: { userId: req.user!.id },
        include: { advisedClasses: true },
      });
      if (!fac || fac.advisedClasses.length === 0) {
        return res.status(403).json({ error: 'Only class advisors can export advisee academics' });
      }
      const advisedIds = fac.advisedClasses.map((c) => c.id);
      if (classId && !advisedIds.includes(String(classId))) {
        return res.status(403).json({ error: 'Forbidden: you do not advise this class' });
      }
      where.classId = classId ? String(classId) : { in: advisedIds };
    } else if (classId && classId !== 'ALL') {
      where.classId = String(classId);
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: true,
        class: true,
        academicSemesters: { include: { subjects: true }, orderBy: { semesterNumber: 'asc' } },
      },
      orderBy: { rollNo: 'asc' },
    });

    const multiplier = await getCgpaMultiplierValue();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velan AI';

    const classSheet = workbook.addWorksheet('Class CGPA Summary');
    classSheet.addRow(['Roll No', 'Register No', 'Student Name', 'Class', 'Latest GPA', 'CGPA', 'Total Credits', 'Arrears']);
    classSheet.getRow(1).font = { bold: true };

    for (const s of students) {
      const summary = buildStudentSummary(s.academicSemesters, multiplier);
      const latest = summary.semesters.length > 0 ? summary.semesters[summary.semesters.length - 1] : null;
      classSheet.addRow([
        s.rollNo,
        s.registerNo,
        s.user.name,
        s.class.name,
        latest?.gpa ?? '—',
        summary.cgpa,
        summary.totalCredits,
        summary.arrearsCount,
      ]);

      // Per-student sheet (only if they have semesters, capped safely for large exports)
      if (summary.semesters.length > 0 && students.length <= 80) {
        const safeName = `${s.rollNo}_${s.user.name}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 28) || s.id.slice(0, 8);
        const stSheet = workbook.addWorksheet(safeName);
        stSheet.addRow([`${s.user.name} (${s.registerNo}) — CGPA: ${summary.cgpa}`]);
        stSheet.addRow(['Semester', 'Subject Code', 'Subject Name', 'Credits', 'Grade', 'Points', 'Result']);
        for (const sem of summary.semesters) {
          for (const sub of sem.subjects) {
            stSheet.addRow([sem.semesterNumber, sub.subjectCode, sub.subjectName, sub.credits, sub.grade, sub.gradePoint, sub.result]);
          }
        }
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Velan_Academics_Report.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('exportAcademicsExcel error:', err);
    return res.status(500).json({ error: 'Failed to export academics Excel' });
  }
};

function generateSimplePdf(lines: string[]): Buffer {
  const escaped = lines.slice(0, 48).map((l) =>
    l.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  );
  const textOps = escaped
    .map((line, i) => `BT /F1 ${i === 0 ? 13 : 9} Tf 40 ${760 - i * 14} Td (${line}) Tj ET`)
    .join('\n');
  const stream = textOps;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export const exportAcademicsPdf = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;
    const role = req.user!.role;

    const where: any = {};
    if (role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({
        where: { userId: req.user!.id },
        include: { advisedClasses: true },
      });
      if (!fac || fac.advisedClasses.length === 0) {
        return res.status(403).json({ error: 'Only class advisors can export advisee PDFs' });
      }
      const advisedIds = fac.advisedClasses.map((c) => c.id);
      if (classId && !advisedIds.includes(String(classId))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where.classId = classId ? String(classId) : { in: advisedIds };
    } else if (classId && classId !== 'ALL') {
      where.classId = String(classId);
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: true,
        class: true,
        academicSemesters: { include: { subjects: true }, orderBy: { semesterNumber: 'asc' } },
      },
      orderBy: { rollNo: 'asc' },
    });

    const multiplier = await getCgpaMultiplierValue();
    const lines = [
      'Velan AI — Academic Performance & CGPA Summary',
      `Generated: ${new Date().toLocaleString()} | Total Students: ${students.length}`,
      '--------------------------------------------------------------------------',
    ];
    for (const s of students) {
      const summary = buildStudentSummary(s.academicSemesters, multiplier);
      lines.push(
        `${s.rollNo} | ${s.registerNo} | ${s.user.name.slice(0, 22)} | CGPA: ${summary.cgpa.toFixed(2)} | Credits: ${summary.totalCredits} | Arrears: ${summary.arrearsCount}`
      );
    }

    const pdfBuffer = generateSimplePdf(lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Velan_Academics_Summary.pdf"');
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('exportAcademicsPdf error:', err);
    return res.status(500).json({ error: 'Failed to export PDF' });
  }
};
