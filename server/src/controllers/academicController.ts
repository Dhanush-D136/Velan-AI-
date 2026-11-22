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
  studentCreateSchema,
} from '@velan/shared';

// ==========================================
// 1. ACADEMIC HIERARCHY (DEPARTMENTS, YEARS, CLASSES)
// ==========================================

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

    return res.status(201).json({ message: 'Class section created successfully', class: cls });
  } catch (error: any) {
    console.error('createClass error:', error);
    return res.status(500).json({ error: 'Failed to create class section' });
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.class.delete({ where: { id } });
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
      },
      orderBy: { employeeId: 'asc' },
    });

    return res.json({ faculty });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch faculty list' });
  }
};

export const createFaculty = async (req: Request, res: Response) => {
  try {
    const parse = facultyCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { name, employeeId, departmentId, designation, phone, email } = parse.data;

    const existingEmp = await prisma.facultyProfile.findUnique({ where: { employeeId } });
    if (existingEmp) return res.status(409).json({ error: `Employee ID ${employeeId} already registered.` });

    // Default password is 1234
    const defaultPasswordHash = await bcrypt.hash('1234', 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email || `${employeeId.toLowerCase()}@faculty.local`,
        phone,
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
        designation,
      },
      include: { user: true, department: true },
    });

    return res.status(201).json({
      message: 'Faculty registered successfully with default password 1234',
      faculty: profile,
    });
  } catch (error: any) {
    console.error('createFaculty error:', error);
    return res.status(500).json({ error: 'Failed to create faculty member' });
  }
};

export const deleteFaculty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.facultyProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'Faculty not found' });

    await prisma.user.delete({ where: { id: profile.userId } });
    return res.json({ message: 'Faculty account deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete faculty' });
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

    return res.json({ students });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
};

export const createStudent = async (req: Request, res: Response) => {
  try {
    const parse = studentCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { name, registerNo, rollNo, classId } = parse.data;

    const existingReg = await prisma.studentProfile.findUnique({ where: { registerNo } });
    if (existingReg) return res.status(409).json({ error: `Register Number ${registerNo} already registered.` });

    const defaultPasswordHash = await bcrypt.hash('1234', 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: `${registerNo.toLowerCase()}@student.local`,
        passwordHash: defaultPasswordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });

    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        registerNo,
        rollNo,
        classId,
      },
      include: { user: true, class: true },
    });

    return res.status(201).json({
      message: 'Student registered successfully with default password 1234',
      student: profile,
    });
  } catch (error: any) {
    console.error('createStudent error:', error);
    return res.status(500).json({ error: 'Failed to create student' });
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

// Bulk Import Students from Excel
export const importStudentsFromExcel = async (req: Request, res: Response) => {
  try {
    const { classId, students: rawStudents } = req.body;
    if (!classId) return res.status(400).json({ error: 'Class ID is required' });
    if (!Array.isArray(rawStudents) || rawStudents.length === 0) {
      return res.status(400).json({ error: 'No student rows provided' });
    }

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const defaultPasswordHash = await bcrypt.hash('1234', 10);
    const successList: any[] = [];
    const errorList: { row: number; rollNo: string; registerNo: string; error: string }[] = [];

    const existingRegNos = new Set(
      (await prisma.studentProfile.findMany({ select: { registerNo: true } })).map((s) => s.registerNo)
    );

    for (let i = 0; i < rawStudents.length; i++) {
      const row = rawStudents[i];
      const rollNo = String(row['ROLL NUMBER'] || row['rollNo'] || '').trim();
      const registerNo = String(row['REGISTER NUMBER'] || row['registerNo'] || '').trim();
      const name = String(row['STUDENT NAME'] || row['name'] || row['studentName'] || '').trim();

      if (!rollNo || !registerNo || !name) {
        errorList.push({ row: i + 1, rollNo, registerNo, error: 'Missing Roll Number, Register Number, or Name' });
        continue;
      }

      if (existingRegNos.has(registerNo)) {
        errorList.push({ row: i + 1, rollNo, registerNo, error: 'Register Number already exists in database' });
        continue;
      }

      try {
        const user = await prisma.user.create({
          data: {
            name,
            email: `${registerNo.toLowerCase()}@student.local`,
            passwordHash: defaultPasswordHash,
            role: 'STUDENT',
            status: 'ACTIVE',
            mustChangePassword: true,
          },
        });

        const profile = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            registerNo,
            rollNo,
            classId,
          },
        });

        existingRegNos.add(registerNo);
        successList.push(profile);
      } catch (err: any) {
        errorList.push({ row: i + 1, rollNo, registerNo, error: 'Failed to create student account' });
      }
    }

    return res.json({
      message: `Import completed: ${successList.length} students created, ${errorList.length} rows skipped.`,
      totalProcessed: rawStudents.length,
      successCount: successList.length,
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
