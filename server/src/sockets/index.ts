import { Server, Socket } from 'socket.io';

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
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
      socket.to(`class_${classId}`).emit('typing:status', { userName, isTyping: true });
    });

    socket.on('typing:stop', ({ classId, userName }: { classId: string; userName: string }) => {
      socket.to(`class_${classId}`).emit('typing:status', { userName, isTyping: false });
    });

    socket.on('disconnect', () => {
      // Cleanup
    });
  });
};
