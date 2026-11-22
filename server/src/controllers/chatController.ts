import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { chatMessageSchema } from '@velan/shared';

// 9. Class-only chat room: strictly restricted to enrolled students, assigned faculty, and admin
export const getRoomMessages = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;

    // Verify user membership in this class
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        studentProfile: true,
        facultyProfile: { include: { classSubjects: true } },
      },
    });

    if (user?.role === 'STUDENT' && user.studentProfile?.classId !== classId) {
      return res.status(403).json({ error: 'You can only view chat in your assigned class room' });
    }

    if (user?.role === 'FACULTY') {
      const teachesClass = user.facultyProfile?.classSubjects.some((cs) => cs.classId === classId);
      if (!teachesClass) {
        return res.status(403).json({ error: 'You do not teach this class' });
      }
    }

    const room = await prisma.chatRoom.findUnique({
      where: { classId },
      include: {
        messages: {
          include: { sender: true },
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    return res.json({ messages: room.messages });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch class messages' });
  }
};

export const postMessage = async (req: Request, res: Response) => {
  try {
    const parseResult = chatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { classId, content, type, attachmentUrl, attachmentName } = parseResult.data;

    let room = await prisma.chatRoom.findUnique({ where: { classId } });
    if (!room) {
      room = await prisma.chatRoom.create({ data: { classId } });
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: req.user!.id,
        content,
        type,
        attachmentUrl,
        attachmentName,
      },
      include: { sender: true },
    });

    // Real-time broadcast to class room
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('chat:new_message', { message });
    }

    return res.json({ message });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to post message' });
  }
};
