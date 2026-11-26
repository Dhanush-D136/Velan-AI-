import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { assignmentCreateSchema, materialCreateSchema } from '@velan/shared';
import { notifyUsers } from './notificationController';

// Helper: find or verify faculty owns (classId, subjectId) via ClassSubject or TimetableSlot
const verifyFacultyTeaches = async (userId: string, classId: string, subjectId: string) => {
  const faculty = await prisma.facultyProfile.findUnique({ where: { userId } });
  if (!faculty) return { error: 'Faculty profile not found', status: 403 as const };

  let cs = await prisma.classSubject.findUnique({
    where: { classId_subjectId: { classId, subjectId } },
  });

  if (cs && cs.facultyId === faculty.id) {
    return { faculty, classSubject: cs };
  }

  // Also allow if assigned via TimetableSlot
  const slot = await prisma.timetableSlot.findFirst({
    where: {
      classId,
      facultyId: faculty.id,
      classSubject: { subjectId },
    },
    include: { classSubject: true },
  });

  if (slot) {
    return { faculty, classSubject: slot.classSubject };
  }

  return { error: 'You are not assigned to teach this subject for this class', status: 403 as const };
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

    return res.json({ assignments });
  } catch (error: any) {
    console.error('getAssignments error:', error);
    return res.status(500).json({ error: 'Failed to load assignments' });
  }
};

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const parse = assignmentCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const { classId, subjectId, title, description, startDate, dueDate, submissionDate, links } = parse.data;
    const auth = await verifyFacultyTeaches(req.user!.id, classId, subjectId);
    if ('error' in auth) return res.status(auth.status ?? 403).json({ error: auth.error });

    const assignment = await prisma.assignment.create({
      data: {
        classSubjectId: auth.classSubject.id,
        title: title.trim(),
        description: description.trim(),
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
        submissionDate: submissionDate ? new Date(submissionDate) : null,
        links: {
          create: links.map((l) => ({ title: l.title.trim(), url: l.url.trim() })),
        },
      },
      include: {
        links: true,
        classSubject: { include: { class: { include: { students: true } }, subject: true } },
      },
    });

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
      include: { classSubject: { include: { class: { include: { students: true } }, subject: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
    if (!fac || existing.classSubject.facultyId !== fac.id) {
      return res.status(403).json({ error: 'You can only edit your own assignments' });
    }

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

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(links)) {
        await tx.assignmentLink.deleteMany({ where: { assignmentId: id } });
      }
      return tx.assignment.update({
        where: { id },
        data: {
          title: title ? String(title).trim() : existing.title,
          description: description ? String(description).trim() : existing.description,
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
      include: { classSubject: true },
    });
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
    if (!fac || existing.classSubject.facultyId !== fac.id) {
      return res.status(403).json({ error: 'You can only delete your own assignments' });
    }

    await prisma.assignment.delete({ where: { id } });

    const io = req.app.get('io');
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
    const auth = await verifyFacultyTeaches(req.user!.id, classId, subjectId);
    if ('error' in auth) return res.status(auth.status ?? 403).json({ error: auth.error });

    const material = await prisma.material.create({
      data: {
        classSubjectId: auth.classSubject.id,
        title: title.trim(),
        description: description?.trim() || null,
        type,
        fileUrl: links[0].url.trim(),
        fileType: type.toUpperCase(),
        links: {
          create: links.map((l) => ({ title: l.title.trim(), url: l.url.trim() })),
        },
      },
      include: {
        links: true,
        classSubject: { include: { class: { include: { students: true } }, subject: true } },
      },
    });

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
      include: { classSubject: true },
    });
    if (!existing) return res.status(404).json({ error: 'Material not found' });

    const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
    if (!fac || existing.classSubject.facultyId !== fac.id) {
      return res.status(403).json({ error: 'You can only edit your own materials' });
    }

    const { title, description, type, links } = req.body;
    if (Array.isArray(links)) {
      for (const l of links) {
        if (!l.url || (!l.url.startsWith('http://') && !l.url.startsWith('https://'))) {
          return res.status(400).json({ error: 'Only http:// or https:// links are allowed' });
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
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
      include: { classSubject: true },
    });
    if (!existing) return res.status(404).json({ error: 'Material not found' });

    if (req.user!.role === 'FACULTY') {
      const fac = await prisma.facultyProfile.findUnique({ where: { userId: req.user!.id } });
      if (!fac || existing.classSubject.facultyId !== fac.id) {
        return res.status(403).json({ error: 'You can only delete your own materials' });
      }
    }

    await prisma.material.delete({ where: { id } });

    const io = req.app.get('io');
    if (io) {
      io.to(`class_${existing.classSubject.classId}`).emit('data:updated', { resource: 'materials' });
      io.emit('data:updated', { resource: 'materials' });
    }

    return res.json({ message: 'Material deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete material' });
  }
};
