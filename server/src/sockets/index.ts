import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { presenceService } from '../services/presenceService';
import { metricsCollector } from '../services/metricsCollector';

const JWT_SECRET = process.env.JWT_SECRET || 'velan_jwt_secret_dev_2026';

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    metricsCollector.recordSocketConnect();

    const token = socket.handshake.auth?.token as string | undefined;
    let socketUser: { id?: string; role?: string; sid?: string } = {};
    if (token) {
      try {
        socketUser = jwt.verify(token, JWT_SECRET) as any;
        if (socketUser.sid) {
          presenceService.attachSocket(socketUser.sid, socket.id);
        }
        if (socketUser.role === 'ADMIN') {
          socket.join('admin');
        }
      } catch {
        // invalid token; keep public rooms restricted
      }
    }

    // Admin-only live monitor room (enforces ADMIN role)
    socket.on('join:admin', (adminToken?: string) => {
      try {
        const tok = adminToken || token;
        if (!tok) return socket.emit('admin:error', { error: 'Unauthorized' });
        const decoded = jwt.verify(tok, JWT_SECRET) as any;
        if (decoded?.role !== 'ADMIN') {
          return socket.emit('admin:error', { error: 'Forbidden: Admin role required' });
        }
        socket.join('admin');
        socket.emit('admin:presence_update', presenceService.getSnapshot());
        socket.emit('admin:health_update', metricsCollector.getSnapshot());
      } catch {
        socket.emit('admin:error', { error: 'Invalid token' });
      }
    });

    // Join user-specific room for notifications & request updates
    socket.on('join:user', (userId: string) => {
      if (userId) socket.join(`user_${userId}`);
    });

    // Join class-specific room for targeted announcements, attendance & chat
    socket.on('join:class', (classId: string) => {
      if (classId) socket.join(`class_${classId}`);
    });

    // Join attendance session room for live board updates
    socket.on('join:session', (sessionId: string) => {
      if (sessionId) socket.join(`session_${sessionId}`);
    });

    // Typing indicators
    socket.on('typing:start', ({ classId, userName }: { classId: string; userName: string }) => {
      metricsCollector.recordSocketMessage();
      socket.to(`class_${classId}`).emit('typing:status', { userName, isTyping: true });
    });

    socket.on('typing:stop', ({ classId, userName }: { classId: string; userName: string }) => {
      socket.to(`class_${classId}`).emit('typing:status', { userName, isTyping: false });
    });

    socket.on('disconnect', () => {
      metricsCollector.recordSocketDisconnect();
      presenceService.detachSocket(socket.id);
    });
  });
};
