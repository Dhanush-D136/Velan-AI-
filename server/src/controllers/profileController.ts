import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { invalidateUserAuthCache } from '../middleware/auth';
import { notifyUsers } from './notificationController';

function emitDataUpdate(req: Request, type: string) {
  const io = req.app.get('io');
  if (io) io.emit('data:updated', { type });
}
import {
  getFacultyDependencies,
  executeFacultyDeleteWithHandover,
  setFacultyActiveStatus,
} from '../services/facultyHandoverService';

const MAX_PHOTO_LENGTH = 2_800_000; // ~2MB base64 data URL

function parsePrefs(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const getFacultyDependenciesHandler = async (req: Request, res: Response) => {
  try {
    const deps = await getFacultyDependencies(req.params.id);
    if (!deps) return res.status(404).json({ error: 'Faculty not found' });
    return res.json(deps);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load faculty dependencies' });
  }
};

export const deleteFacultyWithHandoverHandler = async (req: Request, res: Response) => {
  try {
    const result = await executeFacultyDeleteWithHandover(req.params.id, req.user!.id, req.body || {});
    const io = req.app.get('io');
    emitDataUpdate(req, 'faculty');
    emitDataUpdate(req, 'classes');
    emitDataUpdate(req, 'timetable');
    emitDataUpdate(req, 'assignments');
    emitDataUpdate(req, 'materials');
    if (io) io.emit('data:updated', { scope: 'all' });
    return res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to delete faculty', conflicts: err.conflicts });
  }
};

export const toggleFacultyActiveHandler = async (req: Request, res: Response) => {
  try {
    const active = req.body?.active !== false;
    const result = await setFacultyActiveStatus(req.params.id, active, req.user!.id);
    emitDataUpdate(req, 'faculty');
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed to update faculty status' });
  }
};

export const adminUpdateFaculty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.facultyProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) return res.status(404).json({ error: 'Faculty not found' });

    const {
      name,
      employeeId,
      email,
      phone,
      departmentId,
      designation,
      qualification,
      specialization,
      experienceYears,
      joinedAt,
      officeRoom,
      dateOfBirth,
      address,
      emergencyContact,
      bio,
      photoUrl,
    } = req.body || {};

    if (photoUrl && String(photoUrl).length > MAX_PHOTO_LENGTH) {
      return res.status(400).json({ error: 'Photo exceeds 2 MB size limit.' });
    }

    const cleanEmpId = employeeId ? String(employeeId).trim().toUpperCase() : existing.employeeId;
    if (cleanEmpId !== existing.employeeId) {
      const dupEmp = await prisma.facultyProfile.findFirst({
        where: { employeeId: cleanEmpId, id: { not: id } },
      });
      if (dupEmp) return res.status(409).json({ error: `Faculty ID "${cleanEmpId}" is already in use.` });
    }

    const cleanEmail = email !== undefined ? (email ? String(email).trim().toLowerCase() : null) : existing.user.email;
    if (cleanEmail && cleanEmail !== existing.user.email) {
      const dupEmail = await prisma.user.findFirst({
        where: { email: cleanEmail, id: { not: existing.userId } },
      });
      if (dupEmail) return res.status(409).json({ error: `Email "${cleanEmail}" is already in use.` });
    }

    const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
    const track = (field: string, oldVal: any, newVal: any) => {
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({ field, oldVal: oldVal ?? null, newVal: newVal ?? null });
      }
    };

    track('name', existing.user.name, name);
    track('employeeId', existing.employeeId, cleanEmpId);
    track('email', existing.user.email, cleanEmail);
    track('phone', existing.user.phone, phone);
    track('departmentId', existing.departmentId, departmentId);
    track('designation', existing.designation, designation);
    track('qualification', existing.qualification, qualification);
    track('specialization', existing.specialization, specialization);
    track('experienceYears', existing.experienceYears, experienceYears);
    track('officeRoom', existing.officeRoom, officeRoom);
    track('address', existing.address, address);
    track('emergencyContact', existing.emergencyContact, emergencyContact);
    track('bio', existing.bio, bio);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          name: name !== undefined ? String(name).trim() : existing.user.name,
          email: cleanEmail,
          phone: phone !== undefined ? (phone ? String(phone).trim() : null) : existing.user.phone,
          avatarUrl: photoUrl !== undefined ? photoUrl : existing.user.avatarUrl,
        },
      });

      const fac = await tx.facultyProfile.update({
        where: { id },
        data: {
          employeeId: cleanEmpId,
          departmentId: departmentId || existing.departmentId,
          designation: designation !== undefined ? String(designation).trim() : existing.designation,
          qualification: qualification !== undefined ? qualification || null : existing.qualification,
          specialization: specialization !== undefined ? specialization || null : existing.specialization,
          experienceYears:
            experienceYears !== undefined
              ? experienceYears === '' || experienceYears === null
                ? null
                : Number(experienceYears)
              : existing.experienceYears,
          joinedAt: joinedAt ? new Date(joinedAt) : existing.joinedAt,
          officeRoom: officeRoom !== undefined ? officeRoom || null : existing.officeRoom,
          dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : existing.dateOfBirth,
          address: address !== undefined ? address || null : existing.address,
          emergencyContact: emergencyContact !== undefined ? emergencyContact || null : existing.emergencyContact,
          bio: bio !== undefined ? bio || null : existing.bio,
          photoUrl: photoUrl !== undefined ? photoUrl || null : existing.photoUrl,
        },
        include: { user: true, department: true },
      });

      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'ADMIN_EDIT_FACULTY',
            details: JSON.stringify({ targetFacultyId: id, targetUserId: existing.userId, changes }),
          },
        });
      }

      return fac;
    });

    invalidateUserAuthCache(existing.userId);
    await notifyUsers(req.app.get('io'), [existing.userId], {
      title: 'Profile Updated',
      message: 'Your details were updated by the admin.',
      type: 'PROFILE',
    });
    emitDataUpdate(req, 'faculty');
    emitDataUpdate(req, 'timetable');
    emitDataUpdate(req, 'classes');

    return res.json({ faculty: updated, message: 'Faculty details updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update faculty details' });
  }
};

export const adminGetStudentMovePreview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const targetClassId = String(req.query.targetClassId || '');
    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        class: { include: { advisor: { include: { user: { select: { name: true } } } }, academicYear: { include: { department: true } } } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const targetClass = await prisma.class.findUnique({
      where: { id: targetClassId },
      include: {
        advisor: { include: { user: { select: { name: true } } } },
        academicYear: { include: { department: true } },
        _count: { select: { timetableSlots: true } },
      },
    });
    if (!targetClass) return res.status(404).json({ error: 'Target class not found' });

    return res.json({
      fromClass: student.class.name,
      toClass: targetClass.name,
      newAdvisor: targetClass.advisor?.user?.name || 'Unassigned',
      timetableSlotsCount: targetClass._count.timetableSlots,
      chatRoomChanged: student.classId !== targetClass.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to preview class move' });
  }
};

export const adminUpdateStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const {
      name,
      registerNo,
      rollNo,
      classId,
      email,
      personalEmail,
      phone,
      guardianName,
      guardianPhone,
      address,
      dob,
      bloodGroup,
      hostelOrDayScholar,
      admissionYear,
      photoUrl,
    } = req.body || {};

    if (photoUrl && String(photoUrl).length > MAX_PHOTO_LENGTH) {
      return res.status(400).json({ error: 'Photo exceeds 2 MB size limit.' });
    }

    const cleanReg = registerNo ? String(registerNo).trim().toUpperCase() : existing.registerNo;
    if (cleanReg !== existing.registerNo) {
      const dupReg = await prisma.studentProfile.findFirst({
        where: { registerNo: cleanReg, id: { not: id } },
      });
      if (dupReg) return res.status(409).json({ error: `Register number "${cleanReg}" is already in use.` });
    }

    const targetClassId = classId || existing.classId;
    const cleanRoll = rollNo ? String(rollNo).trim().toUpperCase() : existing.rollNo;
    if (cleanRoll !== existing.rollNo || targetClassId !== existing.classId) {
      const dupRoll = await prisma.studentProfile.findFirst({
        where: { classId: targetClassId, rollNo: cleanRoll, id: { not: id } },
      });
      if (dupRoll) return res.status(409).json({ error: `Roll number "${cleanRoll}" already exists in the selected class.` });
    }

    const cleanEmail = email !== undefined ? (email ? String(email).trim().toLowerCase() : null) : existing.user.email;
    if (cleanEmail && cleanEmail !== existing.user.email) {
      const dupEmail = await prisma.user.findFirst({
        where: { email: cleanEmail, id: { not: existing.userId } },
      });
      if (dupEmail) return res.status(409).json({ error: `Email "${cleanEmail}" is already in use.` });
    }

    const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
    const track = (field: string, oldVal: any, newVal: any) => {
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({ field, oldVal: oldVal ?? null, newVal: newVal ?? null });
      }
    };

    track('name', existing.user.name, name);
    track('registerNo', existing.registerNo, cleanReg);
    track('rollNo', existing.rollNo, cleanRoll);
    track('classId', existing.classId, targetClassId);
    track('email', existing.user.email, cleanEmail);
    track('phone', existing.phone, phone);
    track('guardianName', existing.guardianName, guardianName);
    track('guardianPhone', existing.guardianPhone, guardianPhone);
    track('address', existing.address, address);
    track('bloodGroup', existing.bloodGroup, bloodGroup);
    track('hostelOrDayScholar', existing.hostelOrDayScholar, hostelOrDayScholar);
    track('admissionYear', existing.admissionYear, admissionYear);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          name: name !== undefined ? String(name).trim() : existing.user.name,
          email: cleanEmail,
          phone: phone !== undefined ? (phone ? String(phone).trim() : null) : existing.user.phone,
          avatarUrl: photoUrl !== undefined ? photoUrl : existing.user.avatarUrl,
        },
      });

      const st = await tx.studentProfile.update({
        where: { id },
        data: {
          registerNo: cleanReg,
          rollNo: cleanRoll,
          classId: targetClassId,
          personalEmail: personalEmail !== undefined ? personalEmail || null : existing.personalEmail,
          phone: phone !== undefined ? phone || null : existing.phone,
          guardianName: guardianName !== undefined ? guardianName || null : existing.guardianName,
          guardianPhone: guardianPhone !== undefined ? guardianPhone || null : existing.guardianPhone,
          address: address !== undefined ? address || null : existing.address,
          dob: dob !== undefined ? (dob ? new Date(dob) : null) : existing.dob,
          bloodGroup: bloodGroup !== undefined ? bloodGroup || null : existing.bloodGroup,
          hostelOrDayScholar:
            hostelOrDayScholar !== undefined ? hostelOrDayScholar || null : existing.hostelOrDayScholar,
          admissionYear:
            admissionYear !== undefined
              ? admissionYear === '' || admissionYear === null
                ? null
                : Number(admissionYear)
              : existing.admissionYear,
          photoUrl: photoUrl !== undefined ? photoUrl || null : existing.photoUrl,
        },
        include: { user: true, class: { include: { academicYear: { include: { department: true } } } } },
      });

      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'ADMIN_EDIT_STUDENT',
            details: JSON.stringify({ targetStudentId: id, targetUserId: existing.userId, changes }),
          },
        });
      }

      return st;
    });

    invalidateUserAuthCache(existing.userId);
    await notifyUsers(req.app.get('io'), [existing.userId], {
      title: 'Profile Updated',
      message: 'Your details were updated by the admin.',
      type: 'PROFILE',
    });
    emitDataUpdate(req, 'students');
    emitDataUpdate(req, 'classes');

    return res.json({ student: updated, message: 'Student details updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update student details' });
  }
};

export const getMyFullProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        devices: { where: { status: 'ACTIVE' } },
        notificationPref: true,
        facultyProfile: {
          include: {
            department: true,
            advisedClasses: { select: { id: true, name: true } },
            classMentors: { include: { class: { select: { id: true, name: true } } } },
            classSubjects: { include: { class: { select: { name: true } }, subject: { select: { name: true, code: true } } } },
            _count: { select: { timetableSlots: true } },
          },
        },
        studentProfile: {
          include: {
            class: {
              include: {
                academicYear: { include: { department: true } },
                advisor: { include: { user: { select: { name: true } } } },
                mentors: { include: { faculty: { include: { user: { select: { name: true } } } } } },
              },
            },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { passwordHash: _ph, passwordHistory: _hist, ...safeUser } = user as any;
    return res.json({
      profile: {
        ...safeUser,
        preferences: parsePrefs(user.preferences),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
};

export const updateMyFacultyProfile = async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'STUDENT') {
      return res.status(403).json({
        error: 'Students cannot edit profile fields directly. Please submit a change request to the admin.',
      });
    }

    const userId = req.user!.id;
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: { facultyProfile: true },
    });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const {
      name,
      email,
      phone,
      photoUrl,
      designation,
      qualification,
      specialization,
      experienceYears,
      officeRoom,
      dateOfBirth,
      address,
      emergencyContact,
      bio,
    } = req.body || {};

    if (photoUrl && String(photoUrl).length > MAX_PHOTO_LENGTH) {
      return res.status(400).json({ error: 'Photo exceeds 2 MB size limit.' });
    }

    const cleanEmail = email !== undefined ? (email ? String(email).trim().toLowerCase() : null) : existing.email;
    if (cleanEmail && cleanEmail !== existing.email) {
      const dup = await prisma.user.findFirst({ where: { email: cleanEmail, id: { not: userId } } });
      if (dup) return res.status(409).json({ error: `Email "${cleanEmail}" is already in use.` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: name !== undefined ? String(name).trim() : existing.name,
          email: cleanEmail,
          phone: phone !== undefined ? (phone ? String(phone).trim() : null) : existing.phone,
          avatarUrl: photoUrl !== undefined ? photoUrl || null : existing.avatarUrl,
        },
      });

      if (existing.facultyProfile) {
        const fp = existing.facultyProfile;
        await tx.facultyProfile.update({
          where: { id: fp.id },
          data: {
            designation: designation !== undefined ? String(designation).trim() : fp.designation,
            qualification: qualification !== undefined ? qualification || null : fp.qualification,
            specialization: specialization !== undefined ? specialization || null : fp.specialization,
            experienceYears:
              experienceYears !== undefined
                ? experienceYears === '' || experienceYears === null
                  ? null
                  : Number(experienceYears)
                : fp.experienceYears,
            officeRoom: officeRoom !== undefined ? officeRoom || null : fp.officeRoom,
            dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : fp.dateOfBirth,
            address: address !== undefined ? address || null : fp.address,
            emergencyContact: emergencyContact !== undefined ? emergencyContact || null : fp.emergencyContact,
            bio: bio !== undefined ? bio || null : fp.bio,
            photoUrl: photoUrl !== undefined ? photoUrl || null : fp.photoUrl,
          },
        });
      }
    });

    invalidateUserAuthCache(userId);
    emitDataUpdate(req, 'faculty');
    emitDataUpdate(req, 'timetable');
    emitDataUpdate(req, 'classes');

    return res.json({ message: 'Profile saved successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
};

export const updateMyPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    const merged = { ...parsePrefs(user?.preferences), ...(req.body?.preferences || req.body || {}) };
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: JSON.stringify(merged) },
    });
    invalidateUserAuthCache(userId);
    return res.json({ preferences: merged, message: 'Preferences saved.' });
  } catch {
    return res.status(500).json({ error: 'Failed to save preferences' });
  }
};

export const createStudentChangeRequest = async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only students can submit profile change requests.' });
    }
    const student = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const { field, newValue, reason, proofUrl } = req.body || {};
    if (!field || !String(newValue ?? '').trim() || !String(reason ?? '').trim()) {
      return res.status(400).json({ error: 'Field, requested new value, and reason are required.' });
    }
    if (proofUrl && String(proofUrl).length > MAX_PHOTO_LENGTH) {
      return res.status(400).json({ error: 'Proof file exceeds 2 MB limit.' });
    }

    const oldMap: Record<string, string> = {
      name: student.user.name,
      email: student.user.email || student.personalEmail || '',
      phone: student.phone || student.user.phone || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      address: student.address || '',
      bloodGroup: student.bloodGroup || '',
      hostelOrDayScholar: student.hostelOrDayScholar || '',
      dob: student.dob ? student.dob.toISOString().split('T')[0] : '',
      registerNo: student.registerNo,
      rollNo: student.rollNo,
    };

    const reqRow = await prisma.profileEditRequest.create({
      data: {
        studentId: student.id,
        field: String(field),
        oldValue: oldMap[String(field)] ?? '',
        newValue: String(newValue).trim(),
        reason: String(reason).trim(),
        proofUrl: proofUrl || null,
        status: 'PENDING',
      },
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await notifyUsers(
      req.app.get('io'),
      admins.map((a) => a.id),
      {
        title: 'Profile Change Request',
        message: `${student.user.name} (${student.registerNo}) requested to update ${field}.`,
        type: 'REQUEST',
      }
    );
    emitDataUpdate(req, 'requests');

    return res.status(201).json({ request: reqRow, message: 'Profile change request sent to admin.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to submit change request' });
  }
};

export const getMyChangeRequests = async (req: Request, res: Response) => {
  try {
    const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.id } });
    if (!student) return res.json({ requests: [] });

    const requests = await prisma.profileEditRequest.findMany({
      where: { studentId: student.id },
      orderBy: { requestedAt: 'desc' },
    });
    return res.json({ requests });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch change requests' });
  }
};
