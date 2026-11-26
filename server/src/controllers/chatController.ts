import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { chatMessageSchema } from '@velan/shared';
import { notifyUsers } from './notificationController';
import { getAdvisorAndMentorClasses } from '../utils/advisorAccess';

// Helper: check if user is authorized for classId (Faculty: TimetableSlot, ClassAdvisor or ClassMentor; Student: enrolled classId; Admin: all)
const checkClassChatMembership = async (userId: string, role: string, classId: string): Promise<boolean> => {
  if (role === 'ADMIN') return true;
  if (role === 'STUDENT') {
    const st = await prisma.studentProfile.findUnique({ where: { userId } });
    return st?.classId === classId;
  }
  if (role === 'FACULTY') {
    const [fac, advisorClasses] = await Promise.all([
      prisma.facultyProfile.findUnique({
        where: { userId },
        include: { timetableSlots: { select: { classId: true } } },
      }),
      getAdvisorAndMentorClasses(userId),
    ]);
    if (!fac) return false;
    return (
      fac.timetableSlots.some((s) => s.classId === classId) ||
      advisorClasses.some((c) => c.classId === classId)
    );
  }
  return false;
};

// Get role-scoped chat rooms with last message & unread count
export const getChatRooms = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let classIds: string[] = [];
    if (role === 'ADMIN') {
      const all = await prisma.class.findMany({ select: { id: true } });
      classIds = all.map((c) => c.id);
    } else if (role === 'STUDENT') {
      const st = await prisma.studentProfile.findUnique({ where: { userId } });
      if (st) classIds = [st.classId];
    } else if (role === 'FACULTY') {
      const [fac, advisorClasses] = await Promise.all([
        prisma.facultyProfile.findUnique({
          where: { userId },
          include: { timetableSlots: { select: { classId: true } } },
        }),
        getAdvisorAndMentorClasses(userId),
      ]);
      if (fac) {
        const set = new Set<string>([
          ...fac.timetableSlots.map((s) => s.classId),
          ...advisorClasses.map((c) => c.classId),
        ]);
        classIds = Array.from(set);
      }
    }

    if (classIds.length === 0) {
      return res.json({ rooms: [] });
    }

    // Ensure ChatRoom exists for each accessible class
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      include: {
        chatRoom: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, name: true, role: true } } },
            },
            reads: { where: { userId } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rooms = await Promise.all(
      classes.map(async (cls) => {
        let room = cls.chatRoom;
        if (!room) {
          await prisma.chatRoom.create({ data: { classId: cls.id } }).catch(() => {});
          room = await prisma.chatRoom.findUnique({
            where: { classId: cls.id },
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { sender: { select: { id: true, name: true, role: true } } },
              },
              reads: { where: { userId } },
            },
          });
        }

        const lastReadAt = room?.reads[0]?.lastReadAt || new Date(0);
        const unreadCount = room
          ? await prisma.chatMessage.count({
              where: {
                roomId: room.id,
                createdAt: { gt: lastReadAt },
                senderId: { not: userId },
              },
            })
          : 0;

        const lastMsg = room?.messages[0] || null;
        return {
          classId: cls.id,
          className: cls.name,
          roomId: room?.id || null,
          lastMessage: lastMsg ? lastMsg.content : null,
          lastMessageSender: lastMsg ? lastMsg.sender.name : null,
          lastMessageAt: lastMsg ? lastMsg.createdAt : null,
          unreadCount,
        };
      })
    );

    return res.json({ rooms });
  } catch (error: any) {
    console.error('getChatRooms error:', error);
    return res.status(500).json({ error: 'Failed to load chat rooms' });
  }
};

// Class-only chat room: strictly restricted to enrolled students, assigned/advisor faculty, and admin
export const getRoomMessages = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const { before, limit } = req.query;
    const takeCount = Math.min(Number(limit || 50), 100);

    const allowed = await checkClassChatMembership(req.user!.id, req.user!.role, classId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this class chat room' });
    }

    let room = await prisma.chatRoom.findUnique({ where: { classId } });
    if (!room) {
      room = await prisma.chatRoom.create({ data: { classId } });
    }

    const messagesDesc = await prisma.chatMessage.findMany({
      where: {
        roomId: room.id,
        ...(before ? { createdAt: { lt: new Date(String(before)) } } : {}),
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: takeCount,
    });

    // Mark room as read for current user
    await prisma.chatRead.upsert({
      where: { roomId_userId: { roomId: room.id, userId: req.user!.id } },
      update: { lastReadAt: new Date() },
      create: { roomId: room.id, userId: req.user!.id, lastReadAt: new Date() },
    });

    return res.json({
      messages: messagesDesc.reverse(),
      hasMore: messagesDesc.length === takeCount,
    });
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
    const isPinned = Boolean(req.body.isPinned) && (req.user!.role === 'ADMIN' || req.user!.role === 'FACULTY');

    const allowed = await checkClassChatMembership(req.user!.id, req.user!.role, classId);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to post in this class chat' });
    }

    let room = await prisma.chatRoom.findUnique({ where: { classId } });
    if (!room) {
      room = await prisma.chatRoom.create({ data: { classId } });
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderId: req.user!.id,
        content,
        type: isPinned ? 'ANNOUNCEMENT' : type,
        isPinned,
        attachmentUrl,
        attachmentName,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    // Update sender's read marker
    await prisma.chatRead.upsert({
      where: { roomId_userId: { roomId: room.id, userId: req.user!.id } },
      update: { lastReadAt: new Date() },
      create: { roomId: room.id, userId: req.user!.id, lastReadAt: new Date() },
    });

    // Real-time broadcast to class room
    const io = req.app.get('io');
    if (io) {
      io.to(`class_${classId}`).emit('chat:new_message', message);
    }

    // Notify other class members (students + assigned faculty, excluding sender)
    const [students, slots, cls] = await Promise.all([
      prisma.studentProfile.findMany({ where: { classId }, select: { userId: true } }),
      prisma.timetableSlot.findMany({
        where: { classId },
        include: { faculty: { select: { userId: true } } },
      }),
      prisma.class.findUnique({
        where: { id: classId },
        include: { advisor: { select: { userId: true } } },
      }),
    ]);

    const memberIds = new Set<string>([
      ...students.map((s) => s.userId),
      ...slots.map((sl) => sl.faculty.userId),
    ]);
    if (cls?.advisor?.userId) memberIds.add(cls.advisor.userId);
    memberIds.delete(req.user!.id);

    await notifyUsers(
      io,
      Array.from(memberIds),
      {
        title: isPinned
          ? `Announcement in ${cls?.name || 'Class'}`
          : `New message in ${cls?.name || 'Class'}`,
        message: `${req.user!.name}: ${content.slice(0, 80)}`,
        type: 'CHAT',
        link: '/chat',
        force: isPinned,
      },
      'chatAlerts'
    );

    return res.json({ message });
  } catch (error: any) {
    console.error('postMessage error:', error);
    return res.status(500).json({ error: 'Failed to post message' });
  }
};
