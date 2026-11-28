import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { presenceService } from '../services/presenceService';
import { metricsCollector } from '../services/metricsCollector';
import { flushAuthEvents } from '../services/authEventQueue';

export const getMonitorOverview = async (req: Request, res: Response) => {
  try {
    await flushAuthEvents();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [
      totalStudents,
      totalFaculty,
      totalAdmins,
      todayEvents,
      recent30dEvents,
      todaySessions,
      allStudents,
      allFaculty,
      loggedUserRows,
      classes,
      activeSessions,
      idleSetting,
      authRetentionSetting,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'FACULTY', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } }),
      prisma.authEvent.findMany({ where: { timestamp: { gte: startOfToday } } }),
      prisma.authEvent.findMany({
        where: { timestamp: { gte: thirtyDaysAgo }, event: 'login' },
        select: { userId: true, role: true, timestamp: true },
      }),
      prisma.userSession.findMany({ where: { startedAt: { gte: startOfToday } } }),
      prisma.studentProfile.findMany({
        select: {
          userId: true,
          registerNo: true,
          user: { select: { name: true } },
          class: { select: { name: true } },
        },
      }),
      prisma.facultyProfile.findMany({
        select: {
          userId: true,
          employeeId: true,
          user: { select: { name: true } },
          department: { select: { code: true } },
        },
      }),
      prisma.authEvent.findMany({
        where: { event: 'login', userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.class.findMany({ include: { _count: { select: { students: true } } } }),
      prisma.attendanceSession.findMany({
        where: { isActive: true },
        include: { records: true },
      }),
      prisma.setting.findUnique({ where: { key: 'IDLE_TIMEOUT_MINUTES' } }),
      prisma.setting.findUnique({ where: { key: 'AUTH_RETENTION_DAYS' } }),
    ]);

    const presence = presenceService.getSnapshot();
    const loggedEverSet = new Set(loggedUserRows.map((r) => r.userId).filter(Boolean) as string[]);

    // Unique logged in today by role
    const todayUniqueByRole = {
      STUDENT: new Set<string>(),
      FACULTY: new Set<string>(),
      ADMIN: new Set<string>(),
    };
    let loginsToday = 0;
    let logoutsToday = 0;
    let failedLoginsToday = 0;

    for (const e of todayEvents) {
      if (e.event === 'login') {
        loginsToday++;
        if (e.userId && (e.role === 'STUDENT' || e.role === 'FACULTY' || e.role === 'ADMIN')) {
          todayUniqueByRole[e.role].add(e.userId);
        }
      } else if (e.event === 'logout') {
        logoutsToday++;
      } else if (e.event === 'login_failed') {
        failedLoginsToday++;
      }
    }

    const neverLoggedInStudents = allStudents
      .filter((s) => !loggedEverSet.has(s.userId))
      .map((s) => ({
        userId: s.userId,
        name: s.user.name,
        role: 'STUDENT',
        identifier: s.registerNo,
        className: s.class.name,
      }));

    const neverLoggedInFaculty = allFaculty
      .filter((f) => !loggedEverSet.has(f.userId))
      .map((f) => ({
        userId: f.userId,
        name: f.user.name,
        role: 'FACULTY',
        identifier: f.employeeId,
        className: f.department?.code || '—',
      }));

    // Class-wise online vs total + active GPS session
    const onlineByClass = new Map<string, number>();
    for (const u of presence.onlineUsers) {
      if (u.role === 'STUDENT' && u.classId) {
        onlineByClass.set(u.classId, (onlineByClass.get(u.classId) || 0) + 1);
      }
    }
    const activeByClass = new Map<string, any>();
    for (const s of activeSessions) {
      activeByClass.set(s.classId, {
        sessionId: s.id,
        markedCount: s.records.filter((r) => r.status === 'PRESENT').length,
      });
    }

    const classWise = classes.map((c) => ({
      classId: c.id,
      className: c.name,
      totalStudents: c._count.students,
      onlineStudents: onlineByClass.get(c.id) || 0,
      activeSession: activeByClass.get(c.id) || null,
    }));

    // Hourly concurrent today (0..23)
    const hourlyConcurrentToday = Array.from({ length: 24 }, (_, hour) => {
      const hStart = new Date(startOfToday);
      hStart.setHours(hour, 0, 0, 0);
      const hEnd = new Date(startOfToday);
      hEnd.setHours(hour, 59, 59, 999);
      const users = new Set<string>();
      for (const s of todaySessions) {
        const ended = s.endedAt || new Date();
        if (s.startedAt <= hEnd && ended >= hStart) {
          users.add(s.userId);
        }
      }
      return { hour: `${String(hour).padStart(2, '0')}:00`, concurrent: users.size };
    });

    // 7-day and 30-day DAU & logins by role
    const dayMap = new Map<string, { date: string; users: Set<string>; logins: number; students: number; faculty: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dayMap.set(d, { date: d, users: new Set(), logins: 0, students: 0, faculty: 0 });
    }
    for (const e of recent30dEvents) {
      const key = e.timestamp.toISOString().slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.logins++;
        if (e.userId) bucket.users.add(e.userId);
        if (e.role === 'STUDENT') bucket.students++;
        if (e.role === 'FACULTY') bucket.faculty++;
      }
    }
    const trends30d = Array.from(dayMap.values()).map((d) => ({
      date: d.date,
      dau: d.users.size,
      logins: d.logins,
      students: d.students,
      faculty: d.faculty,
    }));
    const trends7d = trends30d.slice(-7);

    // Suspicious activity flags
    const failByUser = new Map<string, number>();
    const ipsByUser = new Map<string, Set<string>>();
    let deviceBlocksToday = 0;

    for (const e of todayEvents) {
      if (e.event === 'login_failed' && e.timestamp >= fifteenMinAgo && e.userId) {
        failByUser.set(e.userId, (failByUser.get(e.userId) || 0) + 1);
      }
      if (e.event === 'login' && e.timestamp >= oneHourAgo && e.userId && e.ip) {
        const set = ipsByUser.get(e.userId) || new Set();
        set.add(e.ip);
        ipsByUser.set(e.userId, set);
      }
      if (e.event === 'device_limit_blocked') deviceBlocksToday++;
    }

    const suspiciousFlags: Array<{ type: string; userId?: string; message: string }> = [];
    for (const [uid, count] of failByUser.entries()) {
      if (count >= 3) suspiciousFlags.push({ type: 'REPEATED_FAILED_LOGINS', userId: uid, message: `${count} failed login attempts in 15m (user ${uid.slice(0, 8)})` });
    }
    for (const [uid, ips] of ipsByUser.entries()) {
      if (ips.size >= 3) suspiciousFlags.push({ type: 'MULTI_IP_LOGIN', userId: uid, message: `Logged in from ${ips.size} distinct IPs within 1 hour (user ${uid.slice(0, 8)})` });
    }
    if (deviceBlocksToday > 0) {
      suspiciousFlags.push({ type: 'DEVICE_LIMIT_VIOLATIONS', message: `${deviceBlocksToday} blocked 3rd-device login attempt(s) today` });
    }

    return res.json({
      presence,
      totals: {
        STUDENT: totalStudents,
        FACULTY: totalFaculty,
        ADMIN: totalAdmins,
      },
      loggedInToday: {
        STUDENT: todayUniqueByRole.STUDENT.size,
        FACULTY: todayUniqueByRole.FACULTY.size,
        ADMIN: todayUniqueByRole.ADMIN.size,
        total:
          todayUniqueByRole.STUDENT.size +
          todayUniqueByRole.FACULTY.size +
          todayUniqueByRole.ADMIN.size,
      },
      neverLoggedIn: [...neverLoggedInStudents, ...neverLoggedInFaculty],
      todayCounts: {
        logins: loginsToday,
        logouts: logoutsToday,
        failedLogins: failedLoginsToday,
      },
      classWise,
      hourlyConcurrentToday,
      trends7d,
      trends30d,
      suspiciousFlags,
      settings: {
        idleTimeoutMinutes: Number(idleSetting?.value || 30),
        authRetentionDays: Number(authRetentionSetting?.value || 90),
      },
    });
  } catch (err) {
    console.error('getMonitorOverview error:', err);
    return res.status(500).json({ error: 'Failed to load live monitor overview' });
  }
};

export const getAuthHistory = async (req: Request, res: Response) => {
  try {
    await flushAuthEvents();
    const { role, userId, classId, event, search, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (role && role !== 'ALL') where.role = String(role);
    if (userId) where.userId = String(userId);
    if (classId && classId !== 'ALL') where.classId = String(classId);
    if (event && event !== 'ALL') where.event = String(event);

    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const [events, total, users] = await Promise.all([
      prisma.authEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      prisma.authEvent.count({ where }),
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    let formatted = events.map((e) => ({
      ...e,
      userName: e.userId ? userMap.get(e.userId)?.name || 'Unknown' : 'Guest',
    }));

    if (search && String(search).trim()) {
      const q = String(search).toLowerCase();
      formatted = formatted.filter(
        (e) =>
          e.userName.toLowerCase().includes(q) ||
          (e.ip || '').toLowerCase().includes(q) ||
          (e.event || '').toLowerCase().includes(q)
      );
    }

    return res.json({ events: formatted, total, page: Number(page) || 1 });
  } catch {
    return res.status(500).json({ error: 'Failed to load auth history' });
  }
};

export const exportAuthHistoryExcel = async (_req: Request, res: Response) => {
  try {
    await flushAuthEvents();
    const events = await prisma.authEvent.findMany({ orderBy: { timestamp: 'desc' }, take: 1000 });
    const users = await prisma.user.findMany({ select: { id: true, name: true } });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Auth History');
    sheet.addRow(['Timestamp (UTC)', 'User', 'Role', 'Event', 'Device Type', 'Browser', 'OS', 'IP']);
    for (const e of events) {
      sheet.addRow([
        e.timestamp.toISOString(),
        e.userId ? userMap.get(e.userId) || e.userId : 'Guest',
        e.role,
        e.event,
        e.deviceType || '',
        e.browser || '',
        e.os || '',
        e.ip || '',
      ]);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Velan_Auth_History.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  } catch {
    return res.status(500).json({ error: 'Failed to export auth history' });
  }
};

export const exportNeverLoggedInExcel = async (_req: Request, res: Response) => {
  try {
    await flushAuthEvents();
    const logged = await prisma.authEvent.findMany({
      where: { event: 'login', userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const loggedSet = new Set(logged.map((l) => l.userId));
    const [students, faculty] = await Promise.all([
      prisma.studentProfile.findMany({
        select: {
          userId: true,
          registerNo: true,
          user: { select: { name: true } },
          class: { select: { name: true } },
        },
      }),
      prisma.facultyProfile.findMany({
        select: {
          userId: true,
          employeeId: true,
          user: { select: { name: true } },
          department: { select: { code: true } },
        },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Never Logged In');
    sheet.addRow(['Role', 'Name', 'Identifier', 'Class / Department']);
    for (const s of students) {
      if (!loggedSet.has(s.userId)) sheet.addRow(['STUDENT', s.user.name, s.registerNo, s.class.name]);
    }
    for (const f of faculty) {
      if (!loggedSet.has(f.userId)) sheet.addRow(['FACULTY', f.user.name, f.employeeId, f.department?.code || '']);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Velan_Never_Logged_In.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  } catch {
    return res.status(500).json({ error: 'Failed to export never-logged-in list' });
  }
};

export const getAdminHealth = async (_req: Request, res: Response) => {
  try {
    const [incidents, historyMinutes] = await Promise.all([
      prisma.serverIncident.findMany({ orderBy: { startedAt: 'desc' }, take: 30 }),
      prisma.serverMetricMinute.findMany({ orderBy: { bucketStart: 'desc' }, take: 120 }),
    ]);

    return res.json({
      ...metricsCollector.getSnapshot(),
      incidents,
      historyMinutes: historyMinutes.reverse(),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load server health' });
  }
};

export const updateMonitorSettings = async (req: Request, res: Response) => {
  try {
    const { thresholds, idleTimeoutMinutes, authRetentionDays } = req.body;
    if (thresholds) {
      metricsCollector.updateThresholds(thresholds);
    }
    if (idleTimeoutMinutes !== undefined) {
      await prisma.setting.upsert({
        where: { key: 'IDLE_TIMEOUT_MINUTES' },
        update: { value: String(Number(idleTimeoutMinutes) || 30) },
        create: { key: 'IDLE_TIMEOUT_MINUTES', value: String(Number(idleTimeoutMinutes) || 30) },
      });
    }
    if (authRetentionDays !== undefined) {
      await prisma.setting.upsert({
        where: { key: 'AUTH_RETENTION_DAYS' },
        update: { value: String(Number(authRetentionDays) || 90) },
        create: { key: 'AUTH_RETENTION_DAYS', value: String(Number(authRetentionDays) || 90) },
      });
    }
    return res.json({ message: 'Monitor settings updated', thresholds: metricsCollector.getThresholds() });
  } catch {
    return res.status(500).json({ error: 'Failed to update monitor settings' });
  }
};
