import { Request } from 'express';
import { prisma } from '../lib/prisma';

export interface AuthEventInput {
  userId?: string | null;
  role?: string;
  event:
    | 'login'
    | 'logout'
    | 'login_failed'
    | 'session_expired'
    | 'device_limit_blocked';
  deviceId?: string | null;
  deviceType?: 'phone' | 'computer' | 'tablet';
  browser?: string;
  os?: string;
  ip?: string;
  classId?: string | null;
  details?: string | null;
  timestamp?: Date;
}

export function parseClientMeta(req: Request, platformHint?: string, labelHint?: string) {
  const ua = String(req.headers['user-agent'] || '');
  const lower = `${ua} ${platformHint || ''} ${labelHint || ''}`.toLowerCase();

  let deviceType: 'phone' | 'computer' | 'tablet' = 'computer';
  if (/ipad|tablet/i.test(lower)) deviceType = 'tablet';
  else if (/mobile|android|iphone/i.test(lower)) deviceType = 'phone';

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';

  return { deviceType, browser, os, ip };
}

const buffer: AuthEventInput[] = [];
let flushTimer: NodeJS.Timeout | null = null;

export function enqueueAuthEvent(evt: AuthEventInput) {
  buffer.push({
    ...evt,
    timestamp: evt.timestamp || new Date(),
  });
  if (buffer.length >= 100) {
    void flushAuthEvents();
  }
}

export async function flushAuthEvents() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await prisma.authEvent.createMany({
      data: batch.map((e) => ({
        userId: e.userId || null,
        role: e.role || 'UNKNOWN',
        event: e.event,
        deviceId: e.deviceId || null,
        deviceType: e.deviceType || null,
        browser: e.browser || null,
        os: e.os || null,
        ip: e.ip || null,
        classId: e.classId || null,
        details: e.details || null,
        timestamp: e.timestamp || new Date(),
      })),
    });
  } catch (err) {
    console.error('flushAuthEvents error:', err);
  }
}

export function startAuthEventFlusher() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushAuthEvents();
  }, 5000);
  if (flushTimer.unref) flushTimer.unref();
}
