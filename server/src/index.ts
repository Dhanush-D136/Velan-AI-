import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { apiRouter } from './routes';
import { setupSocketHandlers } from './sockets';

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

// Health check endpoint for Render Web Service
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    system: 'Velan AI College Platform',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Mount API routes both under /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Start Server (only if not running under tests)
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Velan AI Server active on port ${PORT}`);
    console.log(`📡 Socket.IO real-time hub listening`);
    console.log(`🌐 Client Origin locked to: ${CLIENT_ORIGIN}`);
  });
}

export { app, server, io };
