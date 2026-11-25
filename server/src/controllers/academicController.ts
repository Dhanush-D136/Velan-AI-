import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import {
  departmentCreateSchema,
  academicYearCreateSchema,
  classCreateSchema,
  subjectCreateSchema,
  classSubjectAssignSchema,
  facultyCreateSchema,
  facultyUpdateSchema,
  studentCreateSchema,
  studentUpdateSchema,
  bellScheduleItemSchema,
} from '@velan/shared';

const emitDataUpdate = (req: Request, resource: string) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('data:updated', { resource, timestamp: new Date().toISOString() });
  }
};

// ==========================================
// 1. ACADEMIC HIERARCHY (DEPARTMENTS, YEARS, CLASSES)
// ==========================================

export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        academicYears: { include: { classes: true } },
        _count: { select: { faculty: true, subjects: true } },
      },
      orderBy: { code: 'asc' },
    });
    return res.json({ departments, data: departments });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

export const getAcademicYears = async (req: Request, res: Response) => {
  try {
    const years = await prisma.academicYear.findMany({
      include: { department: true, classes: true },
      orderBy: [{ year: 'asc' }],
    });
    return res.json({ years, data: years });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch academic years' });
  }
};

export const getClasses = async (req: Request, res: Response) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        academicYear: { include: { department: true } },
        advisor: { include: { user: true } },
        _count: { select: { students: true, classSubjects: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json({ classes, data: classes });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
};

export const getAcademicHierarchy = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        academicYears: {
          include: {
            classes: {
              include: {
                advisor: { include: { user: true } },
                _count: { select: { students: true, classSubjects: true } },
              },
            },
          },
        },
        subjects: true,
      },
      orderBy: { code: 'asc' },
    });

    return res.json({ departments });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch academic hierarchy' });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const parse = departmentCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { code, name, hodName } = parse.data;

    const existing = await prisma.department.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ error: `Department code ${code} already exists.` });

    const department = await prisma.department.create({
      data: { code, name, hodName },
    });

    return res.status(201).json({ message: 'Department created successfully', department });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create department' });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, hodName } = req.body;

    const department = await prisma.department.update({
      where: { id },
      data: { code: code ? code.toUpperCase() : undefined, name, hodName },
    });

    return res.json({ message: 'Department updated successfully', department });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update department' });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id } });
    return res.json({ message: 'Department deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete department. Ensure no child records exist.' });
  }
};

export const createAcademicYear = async (req: Request, res: Response) => {
  try {
    const parse = academicYearCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { departmentId, year, batch } = parse.data;

    const existing = await prisma.academicYear.findUnique({
      where: { departmentId_year_batch: { departmentId, year, batch } },
    });
    if (existing) {
      return res.status(409).json({ error: `Year ${year} for batch ${batch} already exists in this department.` });
    }

    const academicYear = await prisma.academicYear.create({
      data: { departmentId, year, batch },
    });

    return res.status(201).json({ message: 'Academic Year created successfully', academicYear });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create academic year' });
  }
};

export const deleteAcademicYear = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.academicYear.delete({ where: { id } });
    return res.json({ message: 'Academic Year deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete academic year' });
  }
};

export const createClass = async (req: Request, res: Response) => {
  try {
    const parse = classCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { academicYearId, section, roomNumber, advisorId } = parse.data;

    const ay = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      include: { department: true },
    });
    if (!ay) return res.status(404).json({ error: 'Academic Year not found' });

    const className = `${ay.department.code} – Year ${ay.year} – ${section}`;

    const existing = await prisma.class.findUnique({
      where: { academicYearId_section: { academicYearId, section } },
    });
    if (existing) return res.status(409).json({ error: `Section ${section} already exists for this year.` });

    const cls = await prisma.class.create({
      data: {
        academicYearId,
        section,
        name: className,
        roomNumber,
        advisorId: advisorId || null,
      },
    });

    // Auto-create class-exclusive chat room
    await prisma.chatRoom.create({
      data: { classId: cls.id },
    });

    emitDataUpdate(req, 'classes');
    return res.status(201).json({ message: 'Class section created successfully', class: cls, data: cls });
  } catch (error: any) {
    console.error('createClass error:', error);
    return res.status(500).json({ error: 'Failed to create class section' });
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { section, roomNumber, advisorId } = req.body;

    const existing = await prisma.class.findUnique({
      where: { id },
      include: { academicYear: { include: { department: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const nextSection = section ? String(section).toUpperCase().trim() : existing.section;
    const nextName = `${existing.academicYear.department.code} – Year ${existing.academicYear.year} – ${nextSection}`;

    const cls = await prisma.class.update({
      where: { id },
      data: {
        section: nextSection,
        name: nextName,
        roomNumber: roomNumber !== undefined ? roomNumber : existing.roomNumber,
        advisorId: advisorId !== undefined ? advisorId || null : existing.advisorId,
      },
    });

    emitDataUpdate(req, 'classes');
    return res.json({ message: 'Class updated successfully', class: cls, data: cls });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update class' });
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const studentCount = await prisma.studentProfile.count({ where: { classId: id } });
    if (studentCount > 0) {
      return res.status(409).json({
        error: `Cannot delete class: ${studentCount} student(s) are currently enrolled. Move or remove students first.`,
      });
    }
    const slotCount = await prisma.timetableSlot.count({ where: { classId: id } });
    if (slotCount > 0) {
      return res.status(409).json({
        error: `Cannot delete class: ${slotCount} timetable slot(s) exist for this class. Clear timetable first.`,
      });
    }
    await prisma.class.delete({ where: { id } });
    emitDataUpdate(req, 'classes');
    return res.json({ message: 'Class deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete class. Please reassign or delete enrolled students first.' });
  }
};

// ==========================================
// 2. CURRICULUM SUBJECTS & ASSIGNMENTS
// ==========================================

export const getSubjects = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;
    const subjects = await prisma.subject.findMany({
      where: departmentId ? { departmentId: String(departmentId) } : undefined,
      include: { department: true },
      orderBy: [{ code: 'asc' }],
    });
    return res.json({ subjects });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch subjects' });
  }
};

export const createSubject = async (req: Request, res: Response) => {
  try {
    const parse = subjectCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { departmentId, year, code, name, type, credits } = parse.data;

    const existing = await prisma.subject.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ error: `Subject code ${code} already exists.` });

    const subject = await prisma.subject.create({
      data: { departmentId, year, code, name, type, credits },
    });

    return res.status(201).json({ message: 'Subject added successfully', subject });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create subject' });
  }
};

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.subject.delete({ where: { id } });
    return res.json({ message: 'Subject deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete subject' });
  }
};

export const getClassSubjectAssignments = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;
    const assignments = await prisma.classSubject.findMany({
      where: classId ? { classId: String(classId) } : undefined,
      include: {
        class: true,
        subject: true,
        faculty: { include: { user: true } },
      },
    });
    return res.json({ assignments });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

export const assignClassSubject = async (req: Request, res: Response) => {
  try {
    const parse = classSubjectAssignSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { classId, subjectId, facultyId } = parse.data;

    const assignment = await prisma.classSubject.upsert({
      where: { classId_subjectId: { classId, subjectId } },
      update: { facultyId },
      create: { classId, subjectId, facultyId },
      include: { class: true, subject: true, faculty: { include: { user: true } } },
    });

    return res.status(200).json({ message: 'Teacher assigned to subject successfully', assignment });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to assign faculty to subject' });
  }
};

export const removeClassSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.classSubject.delete({ where: { id } });
    return res.json({ message: 'Assignment removed successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to remove assignment' });
  }
};

// ==========================================
// 3. FACULTY MANAGEMENT
// ==========================================

export const getFacultyList = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.facultyProfile.findMany({
      include: {
        user: true,
        department: true,
        classSubjects: { include: { subject: true, class: true } },
        timetableSlots: { include: { class: true } },
      },
      orderBy: { employeeId: 'asc' },
    });

    return res.json({ faculty, data: faculty });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch faculty list' });
  }
};

export const createFaculty = async (req: Request, res: Response) => {
  try {
    const parse = facultyCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { name, employeeId, departmentId, designation, phone, email, password } = parse.data;

    const existingEmp = await prisma.facultyProfile.findUnique({ where: { employeeId } });
    if (existingEmp) return res.status(409).json({ error: `Employee ID ${employeeId} already registered.` });

    const resolvedEmail = email && email.trim() ? email.trim().toLowerCase() : `${employeeId.toLowerCase()}@faculty.local`;
    const existingEmail = await prisma.user.findUnique({ where: { email: resolvedEmail } });
    if (existingEmail) return res.status(409).json({ error: `Email ${resolvedEmail} is already in use.` });

    // Default password is 1234 unless admin explicitly provided an initial password
    const initialPwd = password && password.trim() ? password.trim() : '1234';
    const defaultPasswordHash = await bcrypt.hash(initialPwd, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: resolvedEmail,
        phone: phone || null,
        passwordHash: defaultPasswordHash,
        role: 'FACULTY',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });

    const profile = await prisma.facultyProfile.create({
      data: {
        userId: user.id,
        employeeId,
        departmentId,
        designation: designation || 'Faculty',
      },
      include: { user: true, department: true },
    });

    emitDataUpdate(req, 'faculty');
    return res.status(201).json({
      message: `Faculty registered successfully with initial password ${initialPwd}`,
      faculty: profile,
      data: profile,
    });
  } catch (error: any) {
    console.error('createFaculty error:', error);
    return res.status(500).json({ error: 'Failed to create faculty member' });
  }
};

export const updateFaculty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = facultyUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const profile = await prisma.facultyProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!profile) return res.status(404).json({ error: 'Faculty not found' });

    const { name, departmentId, designation, email, phone, status } = parse.data;

    if (email && email.trim().toLowerCase() !== profile.user.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (emailTaken) return res.status(409).json({ error: `Email ${email} is already in use.` });
    }

    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        name: name ?? profile.user.name,
        email: email !== undefined ? (email?.trim().toLowerCase() || profile.user.email) : profile.user.email,
        phone: phone !== undefined ? phone : profile.user.phone,
        status: status ?? profile.user.status,
      },
    });

    const updated = await prisma.facultyProfile.update({
      where: { id },
      data: {
        departmentId: departmentId ?? profile.departmentId,
        designation: designation ?? profile.designation,
      },
      include: { user: true, department: true },
    });

    emitDataUpdate(req, 'faculty');
    return res.json({ message: 'Faculty updated successfully', faculty: updated, data: updated });
  } catch (error: any) {
    console.error('updateFaculty error:', error);
    return res.status(500).json({ error: 'Failed to update faculty member' });
  }
};

export const deleteFaculty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.facultyProfile.findUnique({
      where: { id },
      include: {
        timetableSlots: { include: { class: true } },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Faculty not found' });

    if (profile.timetableSlots.length > 0) {
      const assignedLocations = profile.timetableSlots
        .slice(0, 5)
        .map((s) => `${s.class.name} (${s.dayOfWeek} P${s.periodNumber})`)
        .join(', ');
      return res.status(409).json({
        error: `Cannot delete faculty: assigned in timetable (${assignedLocations}). Reassign or clear those slots first.`,
      });
    }

    await prisma.user.delete({ where: { id: profile.userId } });
    emitDataUpdate(req, 'faculty');
    return res.json({ message: 'Faculty account deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete faculty' });
  }
};

export const importFacultyFromExcel = async (req: Request, res: Response) => {
  try {
    const { faculty: rawRows } = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: 'No faculty rows provided' });
    }

    const departments = await prisma.department.findMany();
    const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

    const existingEmpIds = new Set(
      (await prisma.facultyProfile.findMany({ select: { employeeId: true } })).map((f) => f.employeeId.toUpperCase())
    );
    const existingEmails = new Set(
      (await prisma.user.findMany({ select: { email: true } }))
        .map((u) => u.email?.toLowerCase())
        .filter(Boolean) as string[]
    );

    const defaultHash = await bcrypt.hash('1234', 10);
    const created: any[] = [];
    const errors: { row: number; employeeId: string; error: string }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const employeeId = String(row['Faculty ID'] || row['FACULTY ID'] || row['employeeId'] || '').trim().toUpperCase();
      const name = String(row['Name'] || row['NAME'] || row['name'] || '').trim();
      const deptInput = String(row['Department'] || row['DEPARTMENT'] || row['department'] || '').trim();
      const emailInput = String(row['Email'] || row['EMAIL'] || row['email'] || '').trim().toLowerCase();
      const phone = String(row['Phone'] || row['PHONE'] || row['phone'] || '').trim() || null;

      if (!employeeId || !name || !deptInput) {
        errors.push({ row: i + 1, employeeId, error: 'Missing Faculty ID, Name, or Department' });
        continue;
      }

      const dept = deptByCode.get(deptInput.toUpperCase()) || deptByName.get(deptInput.toLowerCase());
      if (!dept) {
        errors.push({ row: i + 1, employeeId, error: `Unknown department "${deptInput}"` });
        continue;
      }

      if (existingEmpIds.has(employeeId)) {
        errors.push({ row: i + 1, employeeId, error: 'Faculty ID already exists' });
        continue;
      }

      const resolvedEmail = emailInput || `${employeeId.toLowerCase()}@faculty.local`;
      if (existingEmails.has(resolvedEmail)) {
        errors.push({ row: i + 1, employeeId, error: `Email ${resolvedEmail} already exists` });
        continue;
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              name,
              email: resolvedEmail,
              phone,
              passwordHash: defaultHash,
              role: 'FACULTY',
              status: 'ACTIVE',
              mustChangePassword: true,
            },
          });
          return tx.facultyProfile.create({
            data: {
              userId: user.id,
              employeeId,
              departmentId: dept.id,
              designation: 'Faculty',
            },
          });
        });
        existingEmpIds.add(employeeId);
        existingEmails.add(resolvedEmail);
        created.push(result);
      } catch (err: any) {
        errors.push({ row: i + 1, employeeId, error: 'Database error creating faculty' });
      }
    }

    emitDataUpdate(req, 'faculty');
    return res.json({
      message: `Import completed: ${created.length} faculty created, ${errors.length} skipped.`,
      successCount: created.length,
      errorCount: errors.length,
      errors,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to import faculty list' });
  }
};

export const resetFacultyPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.facultyProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'Faculty not found' });

    const defaultPasswordHash = await bcrypt.hash('1234', 10);
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        passwordHash: defaultPasswordHash,
        mustChangePassword: true,
      },
    });

    return res.json({ message: 'Password reset to 1234. Faculty must change password at next login.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reset faculty password' });
  }
};

// ==========================================
// 4. STUDENT MANAGEMENT & EXCEL IMPORT
// ==========================================

export const getStudentsList = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;

    const students = await prisma.studentProfile.findMany({
      where: classId ? { classId: String(classId) } : undefined,
      include: {
        user: { include: { devices: true } },
        class: { include: { academicYear: { include: { department: true } } } },
        _count: { select: { attendanceRecords: true } },
      },
      orderBy: { rollNo: 'asc' },
    });

    return res.json({ students, data: students });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
};

export const createStudent = async (req: Request, res: Response) => {
  try {
    const parse = studentCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { name, registerNo, rollNo, classId, phone } = parse.data;

    const existingReg = await prisma.studentProfile.findUnique({ where: { registerNo } });
    if (existingReg) return res.status(409).json({ error: `Register Number ${registerNo} already registered.` });

    const existingRoll = await prisma.studentProfile.findUnique({
      where: { classId_rollNo: { classId, rollNo } },
    });
    if (existingRoll) return res.status(409).json({ error: `Roll Number ${rollNo} already exists in this class.` });

    const defaultPasswordHash = await bcrypt.hash('1234', 10);

    const profile = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: `${registerNo.toLowerCase()}@student.local`,
          phone: phone || null,
          passwordHash: defaultPasswordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
          mustChangePassword: true,
        },
      });

      return tx.studentProfile.create({
        data: {
          userId: user.id,
          registerNo,
          rollNo,
          classId,
          phone: phone || null,
        },
        include: { user: true, class: true },
      });
    });

    emitDataUpdate(req, 'students');
    return res.status(201).json({
      message: 'Student registered successfully with default password 1234',
      student: profile,
      data: profile,
    });
  } catch (error: any) {
    console.error('createStudent error:', error);
    return res.status(500).json({ error: 'Failed to create student' });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = studentUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const existing = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const { name, registerNo, rollNo, classId, phone } = parse.data;
    const nextClassId = classId ?? existing.classId;
    const nextRollNo = rollNo ?? existing.rollNo;
    const nextRegNo = registerNo ?? existing.registerNo;

    if (nextRegNo !== existing.registerNo) {
      const regTaken = await prisma.studentProfile.findUnique({ where: { registerNo: nextRegNo } });
      if (regTaken) return res.status(409).json({ error: `Register Number ${nextRegNo} already exists.` });
    }

    if (nextClassId !== existing.classId || nextRollNo !== existing.rollNo) {
      const rollTaken = await prisma.studentProfile.findUnique({
        where: { classId_rollNo: { classId: nextClassId, rollNo: nextRollNo } },
      });
      if (rollTaken && rollTaken.id !== id) {
        return res.status(409).json({ error: `Roll Number ${nextRollNo} already exists in the selected class.` });
      }
    }

    await prisma.user.update({
      where: { id: existing.userId },
      data: {
        name: name ?? existing.user.name,
        phone: phone !== undefined ? phone : existing.user.phone,
      },
    });

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: {
        registerNo: nextRegNo,
        rollNo: nextRollNo,
        classId: nextClassId,
        phone: phone !== undefined ? phone : existing.phone,
      },
      include: { user: true, class: true },
    });

    emitDataUpdate(req, 'students');
    return res.json({ message: 'Student updated successfully', student: updated, data: updated });
  } catch (error: any) {
    console.error('updateStudent error:', error);
    return res.status(500).json({ error: 'Failed to update student' });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'Student not found' });

    await prisma.user.delete({ where: { id: profile.userId } });
    return res.json({ message: 'Student account deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete student' });
  }
};

export const resetStudentPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'Student not found' });

    const defaultPasswordHash = await bcrypt.hash('1234', 10);
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        passwordHash: defaultPasswordHash,
        mustChangePassword: true,
      },
    });

    return res.json({ message: 'Password reset to 1234. Student must change password at next login.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reset student password' });
  }
};

// Excel Template Download for Student Bulk Import
export const getStudentExcelTemplate = async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    sheet.columns = [
      { header: 'ROLL NUMBER', key: 'rollNo', width: 18 },
      { header: 'REGISTER NUMBER', key: 'registerNo', width: 22 },
      { header: 'STUDENT NAME', key: 'studentName', width: 30 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };

    // Add example rows
    sheet.addRow({ rollNo: '24CS001', registerNo: '710024104001', studentName: 'Adhitya R' });
    sheet.addRow({ rollNo: '24CS002', registerNo: '710024104002', studentName: 'Bhavya S' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Students_Import_Template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to generate template' });
  }
};

// Bulk Import Students from Excel (supports ?preview=true and multipart/form-data file upload OR JSON students array)
export const importStudentsFromExcel = async (req: Request, res: Response) => {
  try {
    const classId = req.body?.classId || (req.query?.classId as string);
    const isPreview = req.query?.preview === 'true';

    if (!classId) return res.status(400).json({ error: 'Class ID is required' });

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    let rawStudents: any[] = Array.isArray(req.body?.students) ? req.body.students : [];

    // Parse uploaded .xlsx file if present
    if ((req as any).file?.buffer) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load((req as any).file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return res.status(400).json({ error: 'Uploaded Excel file has no worksheets' });
      }

      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim().toUpperCase();
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header row
        const rowObj: Record<string, any> = {};
        let hasValue = false;
        row.eachCell((cell, colNumber) => {
          const val = cell.text !== undefined ? cell.text : String(cell.value ?? '');
          if (val.trim()) hasValue = true;
          const headerName = headers[colNumber];
          if (headerName) rowObj[headerName] = val.trim();
          // Also capture positional fallback (Col 1=Roll, Col 2=Reg, Col 3=Name, Col 4=Phone)
          rowObj[`__col${colNumber}`] = val.trim();
        });
        if (hasValue) rawStudents.push(rowObj);
      });
    }

    if (!Array.isArray(rawStudents) || rawStudents.length === 0) {
      return res.status(400).json({ error: 'No student rows found in the uploaded file' });
    }

    const existingRegNos = new Set(
      (await prisma.studentProfile.findMany({ select: { registerNo: true } })).map((s) =>
        s.registerNo.toUpperCase()
      )
    );
    const existingClassRollNos = new Set(
      (
        await prisma.studentProfile.findMany({
          where: { classId },
          select: { rollNo: true },
        })
      ).map((s) => s.rollNo.toUpperCase())
    );

    const seenRegsInFile = new Set<string>();
    const seenRollsInFile = new Set<string>();

    const validRows: { rollNo: string; registerNo: string; name: string; phone?: string }[] = [];
    const errorList: { row: number; rollNo: string; registerNo: string; name?: string; error: string }[] = [];

    for (let i = 0; i < rawStudents.length; i++) {
      const row = rawStudents[i];
      const rollNo = String(
        row['ROLL NUMBER'] || row['ROLL NO'] || row['rollNo'] || row['__col1'] || ''
      ).trim();
      const registerNo = String(
        row['REGISTER NUMBER'] || row['REGISTER NO'] || row['registerNo'] || row['__col2'] || ''
      ).trim();
      const name = String(
        row['STUDENT NAME'] || row['NAME'] || row['name'] || row['studentName'] || row['__col3'] || ''
      ).trim();
      const phone = String(row['PHONE'] || row['MOBILE'] || row['phone'] || row['__col4'] || '').trim() || undefined;

      if (!rollNo || !registerNo || !name) {
        errorList.push({
          row: i + 2,
          rollNo,
          registerNo,
          name,
          error: 'Missing Roll Number, Register Number, or Student Name',
        });
        continue;
      }

      const regUpper = registerNo.toUpperCase();
      const rollUpper = rollNo.toUpperCase();

      if (existingRegNos.has(regUpper)) {
        errorList.push({ row: i + 2, rollNo, registerNo, name, error: 'Register Number already exists in DB' });
        continue;
      }
      if (seenRegsInFile.has(regUpper)) {
        errorList.push({ row: i + 2, rollNo, registerNo, name, error: 'Duplicate Register Number in file' });
        continue;
      }
      if (existingClassRollNos.has(rollUpper)) {
        errorList.push({ row: i + 2, rollNo, registerNo, name, error: 'Roll Number already exists in this class' });
        continue;
      }
      if (seenRollsInFile.has(rollUpper)) {
        errorList.push({ row: i + 2, rollNo, registerNo, name, error: 'Duplicate Roll Number in file' });
        continue;
      }

      seenRegsInFile.add(regUpper);
      seenRollsInFile.add(rollUpper);
      validRows.push({ rollNo, registerNo, name, phone });
    }

    if (isPreview) {
      return res.json({
        totalRows: rawStudents.length,
        validCount: validRows.length,
        errorCount: errorList.length,
        validRows,
        errors: errorList,
      });
    }

    const defaultPasswordHash = await bcrypt.hash('1234', 10);
    const createdProfiles: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of validRows) {
        const user = await tx.user.create({
          data: {
            name: item.name,
            email: `${item.registerNo.toLowerCase()}@student.local`,
            phone: item.phone || null,
            passwordHash: defaultPasswordHash,
            role: 'STUDENT',
            status: 'ACTIVE',
            mustChangePassword: true,
          },
        });

        const profile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            registerNo: item.registerNo,
            rollNo: item.rollNo,
            classId,
            phone: item.phone || null,
          },
        });
        createdProfiles.push(profile);
      }
    });

    emitDataUpdate(req, 'students');
    return res.json({
      message: `Import completed: ${createdProfiles.length} student(s) created, ${errorList.length} row(s) skipped.`,
      totalProcessed: rawStudents.length,
      successCount: createdProfiles.length,
      errorCount: errorList.length,
      errors: errorList,
    });
  } catch (error: any) {
    console.error('importStudentsFromExcel error:', error);
    return res.status(500).json({ error: 'Failed to process Excel import' });
  }
};

// ==========================================
// 5. ADMIN REQUESTS QUEUE (PASSWORD RESET, PROFILE EDIT, DEVICE CHANGE)
// ==========================================

export const getAdminRequests = async (req: Request, res: Response) => {
  try {
    const passwordRequests = await prisma.passwordResetRequest.findMany({
      include: {
        user: {
          include: {
            studentProfile: { include: { class: true } },
            facultyProfile: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    const profileEditRequests = await prisma.profileEditRequest.findMany({
      include: {
        student: {
          include: {
            user: true,
            class: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    const deviceRequests = await prisma.deviceChangeRequest.findMany({
      include: {
        user: {
          include: {
            studentProfile: { include: { class: true } },
            facultyProfile: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return res.json({
      passwordRequests,
      profileEditRequests,
      deviceRequests,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch admin requests' });
  }
};

export const decidePasswordReset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' | 'REJECT'

    const request = await prisma.passwordResetRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (action === 'APPROVE') {
      const defaultPasswordHash = await bcrypt.hash('1234', 10);
      await prisma.user.update({
        where: { id: request.userId },
        data: {
          passwordHash: defaultPasswordHash,
          mustChangePassword: true,
        },
      });

      await prisma.passwordResetRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decidedAt: new Date(),
          decidedBy: req.user!.name,
        },
      });

      return res.json({ message: 'Password reset to 1234. User must change it at next login.' });
    } else {
      await prisma.passwordResetRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          decidedAt: new Date(),
          decidedBy: req.user!.name,
        },
      });

      return res.json({ message: 'Password reset request rejected.' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process password request' });
  }
};

export const decideProfileEdit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' | 'REJECT'

    const request = await prisma.profileEditRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (action === 'APPROVE') {
      await prisma.studentProfile.update({
        where: { id: request.studentId },
        data: {
          canEditProfile: true, // Unlocks for one edit
        },
      });

      await prisma.profileEditRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decidedAt: new Date(),
          decidedBy: req.user!.name,
        },
      });

      return res.json({ message: 'Profile unlocked for one edit.' });
    } else {
      await prisma.profileEditRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          decidedAt: new Date(),
          decidedBy: req.user!.name,
        },
      });

      return res.json({ message: 'Profile edit request rejected.' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process edit request' });
  }
};

export const decideDeviceRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'APPROVE' | 'REJECT'

    const request = await prisma.deviceChangeRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (action === 'APPROVE') {
      await prisma.userDevice.updateMany({
        where: { userId: request.userId },
        data: { status: 'REVOKED' },
      });

      await prisma.userDevice.upsert({
        where: { deviceId: request.newDeviceId },
        update: { status: 'ACTIVE', userId: request.userId, lastUsedAt: new Date() },
        create: {
          userId: request.userId,
          deviceId: request.newDeviceId,
          label: request.label || 'Rebound Device',
          platform: request.platform || 'Web',
          status: 'ACTIVE',
        },
      });

      await prisma.deviceChangeRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', decidedBy: req.user!.name, decidedAt: new Date() },
      });

      return res.json({ message: 'Device change approved and account rebound successfully' });
    } else {
      await prisma.deviceChangeRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', decidedBy: req.user!.name, decidedAt: new Date() },
      });

      return res.json({ message: 'Device change request rejected' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process request decision' });
  }
};

// ==========================================
// 6. UNIVERSAL SYSTEM SETTINGS
// ==========================================

export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => (map[s.key] = s.value));
    return res.json({ settings: map });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const { institutionName, defaultGeofenceRadius, minAttendancePercent } = req.body;

    if (institutionName !== undefined) {
      await prisma.setting.upsert({
        where: { key: 'INSTITUTION_NAME' },
        update: { value: String(institutionName) },
        create: { key: 'INSTITUTION_NAME', value: String(institutionName) },
      });
    }

    if (defaultGeofenceRadius !== undefined) {
      await prisma.setting.upsert({
        where: { key: 'DEFAULT_GEOFENCE_RADIUS' },
        update: { value: String(defaultGeofenceRadius) },
        create: { key: 'DEFAULT_GEOFENCE_RADIUS', value: String(defaultGeofenceRadius) },
      });
    }

    if (minAttendancePercent !== undefined) {
      await prisma.setting.upsert({
        where: { key: 'MIN_ATTENDANCE_PERCENT' },
        update: { value: String(minAttendancePercent) },
        create: { key: 'MIN_ATTENDANCE_PERCENT', value: String(minAttendancePercent) },
      });
    }

    return res.json({ message: 'System settings updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update settings' });
  }
};

// ==========================================
// 7. ADMIN OVERVIEW DASHBOARD (100% REAL DB STATS)
// ==========================================

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayDayOfWeek = dayNames[now.getDay()];

    const [
      totalStudents,
      totalFaculty,
      totalClasses,
      totalDepartments,
      todaysSessions,
      activeSessionsRaw,
      recentSessionsRaw,
      todaysSlotsRaw,
      departments,
      minThresholdSetting,
      studentsWithRecords,
    ] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.facultyProfile.count({ where: { user: { status: 'ACTIVE' } } }),
      prisma.class.count(),
      prisma.department.count(),
      prisma.attendanceSession.findMany({
        where: { createdAt: { gte: startOfDay } },
        include: { records: true },
      }),
      prisma.attendanceSession.findMany({
        where: { isActive: true, expiresAt: { gt: now } },
        include: {
          class: { include: { _count: { select: { students: true } } } },
          classSubject: { include: { subject: true } },
          faculty: { include: { user: true } },
          records: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceSession.findMany({
        where: { isActive: false },
        take: 10,
        include: {
          class: true,
          classSubject: { include: { subject: true } },
          faculty: { include: { user: true } },
          records: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.timetableSlot.findMany({
        where: { dayOfWeek: todayDayOfWeek },
        include: {
          class: true,
          classSubject: { include: { subject: true } },
          faculty: { include: { user: true } },
        },
        orderBy: { periodNumber: 'asc' },
      }),
      prisma.department.findMany({
        include: {
          academicYears: {
            include: {
              classes: {
                include: {
                  sessions: { include: { records: true } },
                },
              },
            },
          },
        },
      }),
      prisma.setting.findUnique({ where: { key: 'MIN_ATTENDANCE_PERCENT' } }),
      prisma.studentProfile.findMany({
        include: {
          user: true,
          class: true,
          attendanceRecords: true,
        },
      }),
    ]);

    const minThreshold = Number(minThresholdSetting?.value || 75);

    // Overall attendance today (%)
    let todayPresent = 0;
    let todayTotal = 0;
    todaysSessions.forEach((s) => {
      s.records.forEach((r) => {
        todayTotal++;
        if (r.status === 'PRESENT' || r.status === 'LATE') todayPresent++;
      });
    });
    const overallAttendanceToday = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 1000) / 10 : 0;

    // Live sessions formatted
    const liveSessions = activeSessionsRaw.map((s) => {
      const totalEnrolled = s.class._count.students;
      const presentCount = s.records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absentCount = s.records.filter((r) => r.status === 'ABSENT').length;
      const pendingCount = Math.max(0, totalEnrolled - presentCount - absentCount);
      return {
        id: s.id,
        classId: s.classId,
        className: s.class.name,
        subjectName: s.classSubject.subject.name,
        subjectCode: s.classSubject.subject.code,
        facultyName: s.faculty.user.name,
        periodNumber: s.periodNumber,
        radiusMeters: s.radiusMeters,
        expiresAt: s.expiresAt,
        totalEnrolled,
        presentCount,
        absentCount,
        pendingCount,
        percentage: totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0,
      };
    });

    // Today's timetable slots + status
    const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todaysClasses = todaysSlotsRaw.map((slot) => {
      const matchingSession = todaysSessions.find(
        (sess) =>
          sess.classId === slot.classId &&
          sess.classSubjectId === slot.classSubjectId &&
          (sess.periodNumber === null || sess.periodNumber === slot.periodNumber)
      );
      let state: 'LIVE' | 'COMPLETED' | 'NOT_TAKEN' | 'UPCOMING' = 'UPCOMING';
      if (matchingSession) {
        state = matchingSession.isActive && matchingSession.expiresAt > now ? 'LIVE' : 'COMPLETED';
      } else if (slot.endTime < nowHHmm) {
        state = 'NOT_TAKEN';
      } else if (slot.startTime <= nowHHmm && slot.endTime >= nowHHmm) {
        state = 'NOT_TAKEN';
      }
      return {
        id: slot.id,
        classId: slot.classId,
        className: slot.class.name,
        subjectName: slot.classSubject.subject.name,
        subjectCode: slot.classSubject.subject.code,
        facultyName: slot.faculty.user.name,
        periodNumber: slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        state,
        sessionId: matchingSession?.id || null,
      };
    });

    // Department attendance benchmark
    const departmentAttendance = departments.map((dept) => {
      let present = 0;
      let total = 0;
      dept.academicYears.forEach((ay) => {
        ay.classes.forEach((cls) => {
          cls.sessions.forEach((sess) => {
            sess.records.forEach((rec) => {
              total++;
              if (rec.status === 'PRESENT' || rec.status === 'LATE') present++;
            });
          });
        });
      });
      return {
        dept: dept.code,
        name: dept.name,
        attendance: total > 0 ? Math.round((present / total) * 100) : 0,
        totalRecords: total,
      };
    });

    // Low attendance students (< threshold)
    const lowAttendanceStudents = studentsWithRecords
      .map((st) => {
        const total = st.attendanceRecords.length;
        const present = st.attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const percent = total > 0 ? Math.round((present / total) * 1000) / 10 : 100;
        return {
          id: st.id,
          name: st.user.name,
          registerNo: st.registerNo,
          rollNo: st.rollNo,
          className: st.class.name,
          attended: present,
          total,
          percent,
        };
      })
      .filter((s) => s.total > 0 && s.percent < minThreshold)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 15);

    // Recent completed sessions
    const recentSessions = recentSessionsRaw.map((s) => {
      const present = s.records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absent = s.records.filter((r) => r.status === 'ABSENT').length;
      return {
        id: s.id,
        className: s.class.name,
        subjectName: s.classSubject.subject.name,
        subjectCode: s.classSubject.subject.code,
        facultyName: s.faculty.user.name,
        createdAt: s.createdAt,
        closedAt: s.closedAt,
        presentCount: present,
        absentCount: absent,
      };
    });

    return res.json({
      stats: {
        totalStudents,
        totalFaculty,
        totalClasses,
        totalDepartments,
        sessionsToday: todaysSessions.length,
        overallAttendanceToday,
        activeSessionsCount: liveSessions.length,
        minThreshold,
      },
      liveSessions,
      todaysClasses,
      departmentAttendance,
      lowAttendanceStudents,
      recentSessions,
    });
  } catch (error: any) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard overview' });
  }
};

// ==========================================
// 8. CONFIGURABLE PERIOD TIMINGS (BELL SCHEDULE)
// ==========================================

const DEFAULT_PERIODS = [
  { periodNumber: 1, name: 'Period 1', startTime: '09:00', endTime: '09:50', isBreak: false },
  { periodNumber: 2, name: 'Period 2', startTime: '09:50', endTime: '10:40', isBreak: false },
  { periodNumber: 3, name: 'Period 3', startTime: '10:55', endTime: '11:45', isBreak: false },
  { periodNumber: 4, name: 'Period 4', startTime: '11:45', endTime: '12:35', isBreak: false },
  { periodNumber: 5, name: 'Period 5', startTime: '13:30', endTime: '14:20', isBreak: false },
  { periodNumber: 6, name: 'Period 6', startTime: '14:20', endTime: '15:10', isBreak: false },
  { periodNumber: 7, name: 'Period 7', startTime: '15:20', endTime: '16:10', isBreak: false },
  { periodNumber: 8, name: 'Period 8', startTime: '16:10', endTime: '17:00', isBreak: false },
];

export const getBellSchedule = async (req: Request, res: Response) => {
  try {
    let periods = await prisma.bellSchedule.findMany({ orderBy: { periodNumber: 'asc' } });
    if (periods.length === 0) {
      await prisma.bellSchedule.createMany({ data: DEFAULT_PERIODS });
      periods = await prisma.bellSchedule.findMany({ orderBy: { periodNumber: 'asc' } });
    }
    return res.json({ periods });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch period schedule' });
  }
};

export const updateBellSchedule = async (req: Request, res: Response) => {
  try {
    const { periods } = req.body;
    if (!Array.isArray(periods) || periods.length === 0) {
      return res.status(400).json({ error: 'Periods array is required' });
    }

    for (const item of periods) {
      const parsed = bellScheduleItemSchema.safeParse(item);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      await prisma.bellSchedule.upsert({
        where: { periodNumber: parsed.data.periodNumber },
        update: {
          name: parsed.data.name,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          isBreak: parsed.data.isBreak,
        },
        create: parsed.data,
      });
    }

    const updated = await prisma.bellSchedule.findMany({ orderBy: { periodNumber: 'asc' } });
    emitDataUpdate(req, 'bell-schedule');
    return res.json({ message: 'Period timings updated successfully', periods: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update period schedule' });
  }
};
