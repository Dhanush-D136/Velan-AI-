import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { presenceService } from '../services/presenceService';
import { metricsCollector } from '../services/metricsCollector';
import { getJwtSecret } from '../middleware/auth';

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    metricsCollector.recordSocketConnect();

    const token = socket.handshake.auth?.token as string | undefined;
    let socketUser: { id?: string; role?: string; sid?: string; scope?: string } = {};
    if (token) {
      try {
        socketUser = jwt.verify(token, getJwtSecret()) as any;
        if (socketUser.scope === 'password_change_only') {
          socket.emit('auth:error', { code: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' });
        } else {
          if (socketUser.sid) {
            presenceService.attachSocket(socketUser.sid, socket.id);
          }
          if (socketUser.role === 'ADMIN') {
            socket.join('admin');
          }
        }
      } catch {
        // invalid token; keep public rooms restricted
      }
    }

    const isRestricted = () => socketUser?.scope === 'password_change_only';

    // Admin-only live monitor room (enforces ADMIN role)
    socket.on('join:admin', (adminToken?: string) => {
      try {
        const tok = adminToken || token;
        if (!tok) return socket.emit('admin:error', { error: 'Unauthorized' });
        const decoded = jwt.verify(tok, getJwtSecret()) as any;
        if (decoded?.scope === 'password_change_only') {
          return socket.emit('admin:error', { code: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' });
        }
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
      if (isRestricted()) return socket.emit('auth:error', { code: 'PASSWORD_CHANGE_REQUIRED' });
      if (userId) socket.join(`user_${userId}`);
    });

    // Join class-specific room for targeted announcements, attendance & chat
    socket.on('join:class', (classId: string) => {
      if (isRestricted()) return socket.emit('auth:error', { code: 'PASSWORD_CHANGE_REQUIRED' });
      if (classId) socket.join(`class_${classId}`);
    });

    // Join attendance session room for live board updates
    socket.on('join:session', (sessionId: string) => {
      if (isRestricted()) return socket.emit('auth:error', { code: 'PASSWORD_CHANGE_REQUIRED' });
      if (sessionId) socket.join(`session_${sessionId}`);
    });

    // Typing indicators
    socket.on('typing:start', ({ classId, userName }: { classId: string; userName: string }) => {
      if (isRestricted()) return;
      metricsCollector.recordSocketMessage();
      socket.to(`class_${classId}`).emit('typing:status', { userName, isTyping: true });
    });

    socket.on('typing:stop', ({ classId, userName }: { classId: string; userName: string }) => {
      if (isRestricted()) return;
      socket.to(`class_${classId}`).emit('typing:status', { userName, isTyping: false });
    });

    socket.on('disconnect', () => {
      metricsCollector.recordSocketDisconnect();
      presenceService.detachSocket(socket.id);
    });
  });
};
