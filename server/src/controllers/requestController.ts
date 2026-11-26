import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { studentRequestCreateSchema, studentRequestDecisionSchema } from '@velan/shared';
import { notifyUsers } from './notificationController';

export const createStudentRequest = async (req: Request, res: Response) => {
  try {
    const parse = studentRequestCreateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const created = await prisma.studentRequest.create({
      data: {
        userId: req.user!.id,
        type: parse.data.type,
        subject: parse.data.subject.trim(),
        message: parse.data.message.trim(),
        status: 'PENDING',
      },
      include: { user: true },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('data:updated', { resource: 'requests' });
    }

    // Notify Admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await notifyUsers(
      io,
      admins.map((a) => a.id),
      {
        title: `New Request: ${created.subject}`,
        message: `${created.user.name} submitted a ${created.type.replace('_', ' ')} request`,
        type: 'REQUEST',
        link: '/admin/requests',
        force: true,
      }
    );

    return res.status(201).json({ message: 'Request submitted to Admin', request: created });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to submit request' });
  }
};

export const getMyRequests = async (req: Request, res: Response) => {
  try {
    const requests = await prisma.studentRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ requests });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to load your requests' });
  }
};

export const getAllRequests = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const requests = await prisma.studentRequest.findMany({
      where: status && status !== 'ALL' ? { status: String(status) } : undefined,
      include: {
        user: {
          include: {
            studentProfile: { include: { class: true } },
            facultyProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ requests });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

export const decideStudentRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = studentRequestDecisionSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const existing = await prisma.studentRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Request not found' });

    const updated = await prisma.studentRequest.update({
      where: { id },
      data: {
        status: parse.data.status,
        adminReply: parse.data.adminReply?.trim() || null,
        decidedBy: req.user!.name,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${existing.userId}`).emit('data:updated', { resource: 'requests' });
      io.emit('data:updated', { resource: 'requests' });
    }

    await notifyUsers(
      io,
      [existing.userId],
      {
        title: `Request ${parse.data.status}: ${existing.subject}`,
        message: parse.data.adminReply?.trim() || `Your request status was updated to ${parse.data.status}.`,
        type: 'REQUEST',
        link: '/settings',
        force: true,
      }
    );

    return res.json({ message: `Request marked as ${parse.data.status}`, request: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update request' });
  }
};
