import { Request, Response } from 'express';
import { prisma, prismaDirect, TX_OPTIONS } from '../lib/prisma';
import { assignmentCreateSchema, materialCreateSchema } from '@velan/shared';
import { notifyUsers } from './notificationController';
import { canManageClassContent, getStudentCRInfo } from '../utils/classContentPermission';

// Helper: find ClassSubject for Faculty or Class Representative
const resolveClassSubjectForActor = async (
  user: { id: string; role: string },
  classId: string,
  subjectId: string
) => {
  if (user.role === 'FACULTY') {
    const faculty = await prisma.facultyProfile.findUnique({ where: { userId: user.id } });
    if (!faculty) return { error: 'Faculty profile not found', status: 403 as const };

    const cs = await prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      include: { faculty: { include: { user: true } }, subject: true },
    });
    if (cs && cs.facultyId === faculty.id) {
      return { classSubject: cs, isCR: false };
    }

    const slot = await prisma.timetableSlot.findFirst({
      where: { classId, facultyId: faculty.id, classSubject: { subjectId } },
      include: { classSubject: { include: { faculty: { include: { user: true } }, subject: true } } },
    });
    if (slot) return { classSubject: slot.classSubject, isCR: false };

    return { error: 'You are not assigned to teach this subject for this class', status: 403 as const };
  }

  const perm = await canManageClassContent(user, classId);
  if (!perm.allowed) {
    return { error: perm.error || 'Forbidden', status: perm.status || (403 as const) };
  }

  const cs = await prisma.classSubject.findUnique({
    where: { classId_subjectId: { classId, subjectId } },
    include: { faculty: { include: { user: true } }, subject: true },
  });
  if (!cs) {
    return { error: 'Subject is not assigned to this class', status: 400 as const };
  }
  return { classSubject: cs, isCR: perm.isCR };
};

// ==========================================
// ASSIGNMENTS CRUD
// ==========================================

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const { classId, subjectId } = req.query;
    const where: any = {};

    if (req.user!.role === 'STUDENT') {
      const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.id } });
      if (!student) return res.status(404).json({ error: 'Student profile not found' });
      where.classSubject = { classId: student.classId };
    } else if (req.user!.role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
      if (!fac) return res.status(404).json({ error: 'Faculty profile not found' });
      where.classSubject = { facultyId: fac.id };
    }

    if (classId && classId !== 'ALL') {
      if (req.user!.role === 'STUDENT') {
        const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.id } });
        if (student && String(classId) !== student.classId) {
          return res.status(403).json({ error: 'Access denied to another class' });
        }
      }
      where.classSubject = { ...(where.classSubject || {}), classId: String(classId) };
    }
    if (subjectId && subjectId !== 'ALL') {
      where.classSubject = { ...(where.classSubject || {}), subjectId: String(subjectId) };
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        links: true,
        classSubject: {
          include: {
            class: true,
            subject: true,
            faculty: { include: { user: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const formatted = assignments.map((a) => ({
      ...a,
      classId: a.classSubject.classId,
      subjectId: a.classSubject.subjectId,
      class: a.classSubject.class,
      subject: a.classSubject.subject,
      faculty: a.classSubject.faculty,
    }));

    return res.json({ assignments: formatted });
  } catch (error: any) {
    console.error('getAssignments error:', error);
    return res.status(500).json({ error: 'Failed to load assignments' });
  }
};

export const getMyTeachingPairs = async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'STUDENT') {
      const crInfo = await getStudentCRInfo(req.user!.id);
      if (!crInfo) {
        return res.status(403).json({ error: 'Only faculty or Class Representatives can manage class content' });
      }
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId: crInfo.classId },
        include: { class: true, subject: true },
      });
      const pairs = classSubjects.map((cs) => ({
        classId: cs.classId,
        className: cs.class.name,
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        subjectCode: cs.subject.code,
      }));
      return res.json({ pairs, isCR: true });
    }

    const faculty = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
    if (!faculty) return res.status(404).json({ error: 'Faculty profile not found' });

    const [classSubjects, slots] = await Promise.all([
      prisma.classSubject.findMany({
        where: { facultyId: faculty.id },
        include: { class: true, subject: true },
      }),
      prisma.timetableSlot.findMany({
        where: { facultyId: faculty.id },
        include: { class: true, classSubject: { include: { subject: true } } },
      }),
    ]);

    const pairMap = new Map<string, any>();
    for (const cs of classSubjects) {
      pairMap.set(`${cs.classId}_${cs.subjectId}`, {
        classId: cs.classId,
        className: cs.class.name,
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        subjectCode: cs.subject.code,
      });
    }
    for (const s of slots) {
      const key = `${s.classId}_${s.classSubject.subjectId}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          classId: s.classId,
          className: s.class.name,
          subjectId: s.classSubject.subjectId,
          subjectName: s.classSubject.subject.name,
          subjectCode: s.classSubject.subject.code,
        });
      }
    }

    return res.json({ pairs: Array.from(pairMap.values()), isCR: false });
  } catch {
    return res.status(500).json({ error: 'Failed to load teaching assignments' });
  }
};

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const parse = assignmentCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { classId, subjectId, title, description, startDate, dueDate, submissionDate, links } = parse.data;
    const auth = await resolveClassSubjectForActor(req.user!, classId, subjectId);
    if ('error' in auth) return res.status(auth.status ?? 403).json({ error: auth.error });

    const creatorRole = auth.isCR ? 'CR' : req.user!.role;

    const assignment = await prisma.assignment.create({
      data: {
        classSubjectId: auth.classSubject.id,
        title: title.trim(),
        description: (description || '').trim(),
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
        submissionDate: submissionDate ? new Date(submissionDate) : null,
        createdByUserId: req.user!.id,
        createdByRole: creatorRole,
        createdByName: req.user!.name,
        links:
          links && links.length > 0
            ? { create: links.map((l) => ({ title: l.title.trim(), url: l.url.trim() })) }
            : undefined,
      },
      include: {
        links: true,
        classSubject: { include: { class: { include: { students: true } }, subject: true, faculty: true } },
      },
    });

    if (auth.isCR) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CR_CREATE_ASSIGNMENT',
          details: JSON.stringify({ classId, assignmentId: assignment.id, title: assignment.title }),
        },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('data:updated', { resource: 'assignments', classId });
      io.emit('data:updated', { resource: 'assignments', classId });
    }

    const studentUserIds = assignment.classSubject.class.students.map((s) => s.userId);
    await notifyUsers(
      io,
      studentUserIds,
      {
        title: `New Assignment: ${assignment.title}`,
        message: `${assignment.classSubject.subject.name} • Due ${new Date(dueDate).toLocaleDateString()}`,
        type: 'ASSIGNMENT',
        link: '/student/assignments',
      },
      'assignmentAlerts'
    );

    if (auth.isCR && assignment.classSubject.faculty?.userId) {
      await notifyUsers(io, [assignment.classSubject.faculty.userId], {
        title: 'Class Representative Posted Assignment',
        message: `${req.user!.name} posted "${assignment.title}" for ${assignment.classSubject.subject.name}.`,
        type: 'ASSIGNMENT',
        link: '/faculty/assignments',
      });
    }

    return res.status(201).json({ message: 'Assignment created successfully', assignment });
  } catch (error: any) {
    console.error('createAssignment error:', error);
    return res.status(500).json({ error: 'Failed to create assignment' });
  }
};

export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: { classSubject: { include: { class: { include: { students: true } }, subject: true, faculty: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const perm = await canManageClassContent(req.user!, existing.classSubject.classId, existing);
    if (!perm.allowed) return res.status(403).json({ error: perm.error || 'Forbidden' });

    const { title, description, startDate, dueDate, submissionDate, isClosed, links } = req.body;
    const nextStart = startDate ? new Date(startDate) : existing.startDate;
    const nextDue = dueDate ? new Date(dueDate) : existing.dueDate;
    const nextSub = submissionDate !== undefined ? (submissionDate ? new Date(submissionDate) : null) : existing.submissionDate;

    if (nextStart.getTime() > nextDue.getTime()) {
      return res.status(400).json({ error: 'Start date must be on or before Due date' });
    }
    if (nextSub && nextDue.getTime() > nextSub.getTime()) {
      return res.status(400).json({ error: 'Due date must be on or before Submission cutoff date' });
    }

    if (Array.isArray(links)) {
      for (const l of links) {
        if (!l.url || (!l.url.startsWith('http://') && !l.url.startsWith('https://'))) {
          return res.status(400).json({ error: 'Only http:// or https:// links are allowed' });
        }
      }
    }

    const updated = await prismaDirect.$transaction(async (tx) => {
      if (Array.isArray(links)) {
        await tx.assignmentLink.deleteMany({ where: { assignmentId: id } });
      }
      return tx.assignment.update({
        where: { id },
        data: {
          title: title ? String(title).trim() : existing.title,
          description: description !== undefined ? String(description).trim() : existing.description,
          startDate: nextStart,
          dueDate: nextDue,
          submissionDate: nextSub,
          isClosed: isClosed !== undefined ? Boolean(isClosed) : existing.isClosed,
          links: Array.isArray(links)
            ? { create: links.map((l: any) => ({ title: String(l.title).trim(), url: String(l.url).trim() })) }
            : undefined,
        },
        include: { links: true, classSubject: { include: { class: true, subject: true } } },
      });
    });

    const io = req.app.get('io');
    if (perm.isCR) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CR_UPDATE_ASSIGNMENT',
          details: JSON.stringify({ classId: existing.classSubject.classId, assignmentId: id, oldTitle: existing.title, newTitle: updated.title }),
        },
      });
      const isFacultyPost = existing.createdByRole === 'FACULTY' || (!existing.createdByRole && existing.createdByUserId !== req.user!.id);
      if (isFacultyPost && perm.settings?.crNotifyFacultyOnEdit && existing.classSubject.faculty?.userId) {
        await notifyUsers(io, [existing.classSubject.faculty.userId], {
          title: 'Assignment Updated by Class Representative',
          message: `${req.user!.name} updated "${updated.title}" in ${existing.classSubject.subject.name}.`,
          type: 'ASSIGNMENT',
          link: '/faculty/assignments',
        });
      }
    }

    if (io) {
      io.to(`class_${existing.classSubject.classId}`).emit('data:updated', { resource: 'assignments' });
      io.emit('data:updated', { resource: 'assignments' });
    }

    return res.json({ message: 'Assignment updated successfully', assignment: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update assignment' });
  }
};

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: { classSubject: { include: { subject: true, faculty: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const perm = await canManageClassContent(req.user!, existing.classSubject.classId, existing);
    if (!perm.allowed) return res.status(403).json({ error: perm.error || 'Forbidden' });

    await prisma.assignment.delete({ where: { id } });

    const io = req.app.get('io');
    if (perm.isCR) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CR_DELETE_ASSIGNMENT',
          details: JSON.stringify({ classId: existing.classSubject.classId, assignmentId: id, title: existing.title }),
        },
      });
      const isFacultyPost = existing.createdByRole === 'FACULTY' || (!existing.createdByRole && existing.createdByUserId !== req.user!.id);
      if (isFacultyPost && perm.settings?.crNotifyFacultyOnEdit && existing.classSubject.faculty?.userId) {
        await notifyUsers(io, [existing.classSubject.faculty.userId], {
          title: 'Assignment Deleted by Class Representative',
          message: `${req.user!.name} deleted "${existing.title}" in ${existing.classSubject.subject.name}.`,
          type: 'ASSIGNMENT',
        });
      }
    }

    if (io) {
      io.to(`class_${existing.classSubject.classId}`).emit('data:updated', { resource: 'assignments' });
      io.emit('data:updated', { resource: 'assignments' });
    }

    return res.json({ message: 'Assignment deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete assignment' });
  }
};

// ==========================================
// MATERIAL LIBRARY CRUD
// ==========================================

export const getMaterials = async (req: Request, res: Response) => {
  try {
    const { classId, subjectId, type, search } = req.query;
    const where: any = {};

    if (req.user!.role === 'STUDENT') {
      const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.id } });
      if (!student) return res.status(404).json({ error: 'Student profile not found' });
      where.classSubject = { classId: student.classId };
    } else if (req.user!.role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
      if (!fac) return res.status(404).json({ error: 'Faculty profile not found' });
      where.classSubject = { facultyId: fac.id };
    }

    if (classId && classId !== 'ALL') {
      if (req.user!.role === 'STUDENT') {
        const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.id } });
        if (student && String(classId) !== student.classId) {
          return res.status(403).json({ error: 'Access denied to another class' });
        }
      }
      where.classSubject = { ...(where.classSubject || {}), classId: String(classId) };
    }
    if (subjectId && subjectId !== 'ALL') {
      where.classSubject = { ...(where.classSubject || {}), subjectId: String(subjectId) };
    }
    if (type && type !== 'ALL') {
      where.type = String(type);
    }

    let materials = await prisma.material.findMany({
      where,
      include: {
        links: true,
        classSubject: {
          include: {
            class: true,
            subject: true,
            faculty: { include: { user: true } },
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    if (search) {
      const q = String(search).toLowerCase();
      materials = materials.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q)) ||
          m.classSubject.subject.name.toLowerCase().includes(q)
      );
    }

    return res.json({ materials });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to load materials' });
  }
};

export const createMaterial = async (req: Request, res: Response) => {
  try {
    const parse = materialCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { classId, subjectId, title, description, type, links } = parse.data;
    const auth = await resolveClassSubjectForActor(req.user!, classId, subjectId);
    if ('error' in auth) return res.status(auth.status ?? 403).json({ error: auth.error });

    const creatorRole = auth.isCR ? 'CR' : req.user!.role;

    const material = await prisma.material.create({
      data: {
        classSubjectId: auth.classSubject.id,
        title: title.trim(),
        description: description?.trim() || null,
        type,
        fileUrl: links[0].url.trim(),
        fileType: type.toUpperCase(),
        createdByUserId: req.user!.id,
        createdByRole: creatorRole,
        createdByName: req.user!.name,
        links: {
          create: links.map((l) => ({ title: l.title.trim(), url: l.url.trim() })),
        },
      },
      include: {
        links: true,
        classSubject: { include: { class: { include: { students: true } }, subject: true, faculty: true } },
      },
    });

    if (auth.isCR) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CR_CREATE_MATERIAL',
          details: JSON.stringify({ classId, materialId: material.id, title: material.title }),
        },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('data:updated', { resource: 'materials', classId });
      io.emit('data:updated', { resource: 'materials', classId });
    }

    const studentUserIds = material.classSubject.class.students.map((s) => s.userId);
    await notifyUsers(
      io,
      studentUserIds,
      {
        title: `New Study Material: ${material.title}`,
        message: `${material.classSubject.subject.name} (${type.replace('_', ' ')})`,
        type: 'MATERIAL',
        link: '/student/materials',
      },
      'materialAlerts'
    );

    if (auth.isCR && material.classSubject.faculty?.userId) {
      await notifyUsers(io, [material.classSubject.faculty.userId], {
        title: 'Class Representative Posted Material',
        message: `${req.user!.name} posted "${material.title}" for ${material.classSubject.subject.name}.`,
        type: 'MATERIAL',
        link: '/faculty/materials',
      });
    }

    return res.status(201).json({ message: 'Material published successfully', material });
  } catch (error: any) {
    console.error('createMaterial error:', error);
    return res.status(500).json({ error: 'Failed to create material' });
  }
};

export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.material.findUnique({
      where: { id },
      include: { classSubject: { include: { subject: true, faculty: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Material not found' });

    const perm = await canManageClassContent(req.user!, existing.classSubject.classId, existing);
    if (!perm.allowed) return res.status(403).json({ error: perm.error || 'Forbidden' });

    const { title, description, type, links } = req.body;
    if (Array.isArray(links)) {
      for (const l of links) {
        if (!l.url || (!l.url.startsWith('http://') && !l.url.startsWith('https://'))) {
          return res.status(400).json({ error: 'Only http:// or https:// links are allowed' });
        }
      }
    }

    const updated = await prismaDirect.$transaction(async (tx) => {
      if (Array.isArray(links)) {
        await tx.materialLink.deleteMany({ where: { materialId: id } });
      }
      return tx.material.update({
        where: { id },
        data: {
          title: title ? String(title).trim() : existing.title,
          description: description !== undefined ? description : existing.description,
          type: type || existing.type,
          fileUrl: Array.isArray(links) && links[0]?.url ? String(links[0].url).trim() : existing.fileUrl,
          links: Array.isArray(links)
            ? { create: links.map((l: any) => ({ title: String(l.title).trim(), url: String(l.url).trim() })) }
            : undefined,
        },
        include: { links: true, classSubject: { include: { class: true, subject: true } } },
      });
    });

    const io = req.app.get('io');
    if (perm.isCR) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CR_UPDATE_MATERIAL',
          details: JSON.stringify({ classId: existing.classSubject.classId, materialId: id, oldTitle: existing.title, newTitle: updated.title }),
        },
      });
      const isFacultyPost = existing.createdByRole === 'FACULTY' || (!existing.createdByRole && existing.createdByUserId !== req.user!.id);
      if (isFacultyPost && perm.settings?.crNotifyFacultyOnEdit && existing.classSubject.faculty?.userId) {
        await notifyUsers(io, [existing.classSubject.faculty.userId], {
          title: 'Material Updated by Class Representative',
          message: `${req.user!.name} updated "${updated.title}" in ${existing.classSubject.subject.name}.`,
          type: 'MATERIAL',
          link: '/faculty/materials',
        });
      }
    }

    if (io) {
      io.to(`class_${existing.classSubject.classId}`).emit('data:updated', { resource: 'materials' });
      io.emit('data:updated', { resource: 'materials' });
    }

    return res.json({ message: 'Material updated successfully', material: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update material' });
  }
};

export const deleteMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.material.findUnique({
      where: { id },
      include: { classSubject: { include: { subject: true, faculty: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Material not found' });

    const perm = await canManageClassContent(req.user!, existing.classSubject.classId, existing);
    if (!perm.allowed) return res.status(403).json({ error: perm.error || 'Forbidden' });

    await prisma.material.delete({ where: { id } });

    const io = req.app.get('io');
    if (perm.isCR) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CR_DELETE_MATERIAL',
          details: JSON.stringify({ classId: existing.classSubject.classId, materialId: id, title: existing.title }),
        },
      });
      const isFacultyPost = existing.createdByRole === 'FACULTY' || (!existing.createdByRole && existing.createdByUserId !== req.user!.id);
      if (isFacultyPost && perm.settings?.crNotifyFacultyOnEdit && existing.classSubject.faculty?.userId) {
        await notifyUsers(io, [existing.classSubject.faculty.userId], {
          title: 'Material Deleted by Class Representative',
          message: `${req.user!.name} deleted "${existing.title}" in ${existing.classSubject.subject.name}.`,
          type: 'MATERIAL',
        });
      }
    }

    if (io) {
      io.to(`class_${existing.classSubject.classId}`).emit('data:updated', { resource: 'materials' });
      io.emit('data:updated', { resource: 'materials' });
    }

    return res.json({ message: 'Material deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete material' });
  }
};
