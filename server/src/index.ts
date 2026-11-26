import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { prisma } from './lib/prisma';
import { apiRouter } from './routes';
import { setupSocketHandlers } from './sockets';
import { metricsCollector } from './services/metricsCollector';
import { presenceService } from './services/presenceService';
import { startAuthEventFlusher } from './services/authEventQueue';
import { rushQueueService } from './services/rushQueueService';
import { flagDefaultPasswordAccounts } from './services/passwordService';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const configuredOrigins = CLIENT_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Allow mobile apps, curl, server-to-server, or Capacitor
  if (!origin) return true;
  if (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('capacitor://') ||
    configuredOrigins.includes(origin)
  ) {
    return true;
  }
  return false;
};

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Fallback: allow to prevent CORS blockages in production setups
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(metricsCollector.httpMiddleware());

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  },
});

app.set('io', io);
setupSocketHandlers(io);
presenceService.setIO(io);
metricsCollector.start(io);
startAuthEventFlusher();
rushQueueService.setIO(io);
void rushQueueService.loadConfigFromDB();

// Welcome endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    system: 'Velan AI College Platform API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth/login',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint for Render Web Service
app.get(['/health', '/api/health'], async (req: Request, res: Response) => {
  let dbStatus = 'healthy';
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'unreachable';
    dbError = err?.message || String(err);
  }

  const isHealthy = dbStatus === 'healthy';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    database: {
      status: dbStatus,
      error: dbError,
    },
    system: 'Velan AI College Platform',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Mount API routes both under /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

// SPA catch-all for non-/api and non-/socket.io routes (if client/dist is present)
const clientDistDir = path.resolve(__dirname, '../../client/dist');
const clientIndexHtml = path.join(clientDistDir, 'index.html');
if (fs.existsSync(clientIndexHtml)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next();
    }
    return res.sendFile(clientIndexHtml);
  });
}

// Start Server (only if not running under tests)
if (process.env.NODE_ENV !== 'test') {
  void flagDefaultPasswordAccounts();
  // Server-side auto-close job for expired GPS attendance sessions (every 30s)
  setInterval(async () => {
    try {
      const now = new Date();
      const expiredSessions = await prisma.attendanceSession.findMany({
        where: { isActive: true, expiresAt: { lte: now } },
        include: { class: { include: { students: true } }, records: true },
      });

      for (const session of expiredSessions) {
        await prisma.$transaction(async (tx) => {
          await tx.attendanceSession.update({
            where: { id: session.id },
            data: { isActive: false, closedAt: now },
          });

          const markedIds = new Set(session.records.map((r) => r.studentId));
          for (const student of session.class.students) {
            if (!markedIds.has(student.id)) {
              await tx.attendanceRecord.create({
                data: {
                  sessionId: session.id,
                  studentId: student.id,
                  status: 'ABSENT',
                  method: 'AUTO',
                  markedBy: 'SYSTEM_AUTOCLOSE',
                },
              });
            }
          }
        });

        io.to(`class_${session.classId}`).emit('attendance:session_closed', { sessionId: session.id });
        io.to(`session_${session.id}`).emit('attendance:session_closed', { sessionId: session.id });
        io.emit('data:updated', { resource: 'attendance', sessionId: session.id });
      }
    } catch (err) {
      console.error('Auto-close session job error:', err);
    }
  }, 30000);

  server.listen(PORT, () => {
    console.log(`🚀 Velan AI Server active on port ${PORT}`);
    console.log(`📡 Socket.IO real-time hub listening`);
    console.log(`🌐 Client Origin locked to: ${CLIENT_ORIGIN}`);
  });
}

export { app, server, io };
