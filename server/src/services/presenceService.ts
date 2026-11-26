import { Server } from 'socket.io';

export interface LiveSessionEntry {
  sessionId: string;
  userId: string;
  name: string;
  role: string;
  classId?: string | null;
  className?: string | null;
  deviceId: string;
  deviceType: string;
  browser: string;
  os: string;
  startedAt: number;
  lastActiveAt: number;
  lastHeartbeatAt: number;
  socketIds: Set<string>;
  graceTimer?: NodeJS.Timeout;
}

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const HEARTBEAT_TTL_MS = 65 * 1000;
const DISCONNECT_GRACE_MS = 20 * 1000;

class PresenceService {
  private sessions = new Map<string, LiveSessionEntry>();
  private socketToSession = new Map<string, string>();
  private io: Server | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private peakDate = new Date().toISOString().slice(0, 10);
  private peakConcurrent = 0;
  private peakAt: string | null = null;

  setIO(io: Server) {
    this.io = io;
  }

  registerSession(entry: Omit<LiveSessionEntry, 'socketIds' | 'lastActiveAt' | 'lastHeartbeatAt'>) {
    const now = Date.now();
    const existing = this.sessions.get(entry.sessionId);
    if (existing?.graceTimer) clearTimeout(existing.graceTimer);

    this.sessions.set(entry.sessionId, {
      ...entry,
      lastActiveAt: now,
      lastHeartbeatAt: now,
      socketIds: existing?.socketIds || new Set<string>(),
    });
    this.updatePeak();
    this.scheduleAdminBroadcast();
  }

  attachSocket(sessionId: string, socketId: string) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    if (s.graceTimer) {
      clearTimeout(s.graceTimer);
      s.graceTimer = undefined;
    }
    s.socketIds.add(socketId);
    s.lastHeartbeatAt = Date.now();
    this.socketToSession.set(socketId, sessionId);
    this.updatePeak();
    this.scheduleAdminBroadcast();
  }

  handleHeartbeat(sessionId: string, activeInteraction = true) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    const now = Date.now();
    s.lastHeartbeatAt = now;
    if (activeInteraction) {
      s.lastActiveAt = now;
    }
    if (s.graceTimer) {
      clearTimeout(s.graceTimer);
      s.graceTimer = undefined;
    }
    this.updatePeak();
    this.scheduleAdminBroadcast();
  }

  detachSocket(socketId: string, graceMs = DISCONNECT_GRACE_MS) {
    const sessionId = this.socketToSession.get(socketId);
    this.socketToSession.delete(socketId);
    if (!sessionId) return;

    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.socketIds.delete(socketId);

    if (s.socketIds.size === 0) {
      if (s.graceTimer) clearTimeout(s.graceTimer);
      s.graceTimer = setTimeout(() => {
        const current = this.sessions.get(sessionId);
        if (current && current.socketIds.size === 0 && Date.now() - current.lastHeartbeatAt >= HEARTBEAT_TTL_MS) {
          this.sessions.delete(sessionId);
          this.scheduleAdminBroadcast();
        }
      }, graceMs);
      if (s.graceTimer.unref) s.graceTimer.unref();
    }
    this.scheduleAdminBroadcast();
  }

  removeSession(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (s?.graceTimer) clearTimeout(s.graceTimer);
    if (s) {
      for (const sid of s.socketIds) {
        this.socketToSession.delete(sid);
      }
    }
    this.sessions.delete(sessionId);
    this.scheduleAdminBroadcast();
  }

  removeUserSessions(userId: string) {
    for (const [id, s] of this.sessions.entries()) {
      if (s.userId === userId) {
        this.removeSession(id);
      }
    }
  }

  private isSessionLive(s: LiveSessionEntry, now = Date.now()) {
    return s.socketIds.size > 0 || now - s.lastHeartbeatAt <= HEARTBEAT_TTL_MS || !!s.graceTimer;
  }

  private getSessionStatus(s: LiveSessionEntry, now = Date.now()): 'ONLINE' | 'IDLE' {
    return now - s.lastActiveAt >= IDLE_THRESHOLD_MS ? 'IDLE' : 'ONLINE';
  }

  private updatePeak() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.peakDate) {
      this.peakDate = today;
      this.peakConcurrent = 0;
      this.peakAt = null;
    }
    const uniqueUsers = new Set<string>();
    const now = Date.now();
    for (const s of this.sessions.values()) {
      if (this.isSessionLive(s, now)) uniqueUsers.add(s.userId);
    }
    if (uniqueUsers.size > this.peakConcurrent) {
      this.peakConcurrent = uniqueUsers.size;
      this.peakAt = new Date().toISOString();
    }
  }

  getSnapshot() {
    const now = Date.now();
    const liveSessions: Array<
      Omit<LiveSessionEntry, 'socketIds' | 'graceTimer'> & { status: 'ONLINE' | 'IDLE'; tabsCount: number }
    > = [];

    const userMap = new Map<
      string,
      {
        userId: string;
        name: string;
        role: string;
        classId?: string | null;
        className?: string | null;
        deviceType: string;
        browser: string;
        os: string;
        startedAt: number;
        lastActiveAt: number;
        status: 'ONLINE' | 'IDLE';
        sessionIds: string[];
      }
    >();

    let phoneDevices = 0;
    let computerDevices = 0;
    let tabletDevices = 0;

    for (const s of this.sessions.values()) {
      if (!this.isSessionLive(s, now)) continue;
      const status = this.getSessionStatus(s, now);

      if (s.deviceType === 'phone') phoneDevices++;
      else if (s.deviceType === 'tablet') tabletDevices++;
      else computerDevices++;

      liveSessions.push({
        sessionId: s.sessionId,
        userId: s.userId,
        name: s.name,
        role: s.role,
        classId: s.classId,
        className: s.className,
        deviceId: s.deviceId,
        deviceType: s.deviceType,
        browser: s.browser,
        os: s.os,
        startedAt: s.startedAt,
        lastActiveAt: s.lastActiveAt,
        lastHeartbeatAt: s.lastHeartbeatAt,
        status,
        tabsCount: s.socketIds.size,
      });

      const prev = userMap.get(s.userId);
      if (!prev) {
        userMap.set(s.userId, {
          userId: s.userId,
          name: s.name,
          role: s.role,
          classId: s.classId,
          className: s.className,
          deviceType: s.deviceType,
          browser: s.browser,
          os: s.os,
          startedAt: s.startedAt,
          lastActiveAt: s.lastActiveAt,
          status,
          sessionIds: [s.sessionId],
        });
      } else {
        prev.sessionIds.push(s.sessionId);
        if (s.lastActiveAt > prev.lastActiveAt) prev.lastActiveAt = s.lastActiveAt;
        if (status === 'ONLINE') prev.status = 'ONLINE';
      }
    }

    const onlineUsers = Array.from(userMap.values());
    const totalOnline = onlineUsers.length;
    const idleCount = onlineUsers.filter((u) => u.status === 'IDLE').length;
    const studentsOnline = onlineUsers.filter((u) => u.role === 'STUDENT').length;
    const facultyOnline = onlineUsers.filter((u) => u.role === 'FACULTY').length;
    const adminsOnline = onlineUsers.filter((u) => u.role === 'ADMIN').length;

    return {
      totalOnline,
      idleCount,
      byRole: {
        STUDENT: studentsOnline,
        FACULTY: facultyOnline,
        ADMIN: adminsOnline,
      },
      activeSessionsCount: liveSessions.length,
      devicesSplit: {
        phone: phoneDevices,
        computer: computerDevices,
        tablet: tabletDevices,
      },
      peakConcurrentToday: this.peakConcurrent,
      peakConcurrentAt: this.peakAt,
      onlineUsers,
      liveSessions,
    };
  }

  private scheduleAdminBroadcast() {
    if (!this.io || this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.io) {
        this.io.to('admin').emit('admin:presence_update', this.getSnapshot());
      }
    }, 1000);
    if (this.debounceTimer.unref) this.debounceTimer.unref();
  }
}

export const presenceService = new PresenceService();
