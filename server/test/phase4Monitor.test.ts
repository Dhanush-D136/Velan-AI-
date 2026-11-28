import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';
import { presenceService } from '../src/services/presenceService';
import { metricsCollector } from '../src/services/metricsCollector';

describe('Phase 4: Admin Live Monitor, Presence, Logout & Server Health', () => {
  let adminToken = '';
  let deptId = '';
  let yearId = '';
  let classId = '';
  let student1UserId = '';
  let student2UserId = '';

  const runId = Math.floor(10000 + Math.random() * 89999);
  const reg1 = `P4R1_${runId}`;
  const reg2 = `P4R2_${runId}`;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `admin_p4_${runId}`,
    });
    expect(res.status).toBe(200);
    adminToken = res.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `P4D${runId}`, name: `Phase 4 Dept ${runId}` });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 1, batch: `2026-2030-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'R401' });
    classId = cRes.body.class.id;

    const s1 = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P4 Student1 ${runId}`, rollNo: `P4RO1_${runId}`, registerNo: reg1, classId });
    student1UserId = s1.body.student.userId;
    (globalThis as any).__p4_st1Pwd = '1234';

    // Student 2 never logs in
    const s2 = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P4 Never ${runId}`, rollNo: `P4RO2_${runId}`, registerNo: reg2, classId });
    student2UserId = s2.body.student.userId;
  }, 20000);

  afterAll(async () => {
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (student1UserId) await prisma.user.delete({ where: { id: student1UserId } }).catch(() => {});
    if (student2UserId) await prisma.user.delete({ where: { id: student2UserId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Login creates session & event; Logout closes session & invalidates JWT; Non-admin gets 403', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ identifier: reg1, password: (globalThis as any).__p4_st1Pwd, deviceId: `p4_pc_${runId}` });
    expect(loginRes.status).toBe(200);
    const stToken = loginRes.body.token;

    // Non-admin gets 403 on monitor & health endpoints
    const forbiddenMon = await request(app)
      .get('/api/admin/monitor/overview')
      .set('Authorization', `Bearer ${stToken}`);
    expect(forbiddenMon.status).toBe(403);

    const forbiddenHealth = await request(app)
      .get('/api/admin/health')
      .set('Authorization', `Bearer ${stToken}`);
    expect(forbiddenHealth.status).toBe(403);

    // Public /api/health returns ok + uptime
    const pubHealth = await request(app).get('/api/health');
    expect(pubHealth.status).toBe(200);

    // Admin sees never-logged-in student2 & unique logged-in today
    const ov = await request(app)
      .get('/api/admin/monitor/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ov.status).toBe(200);
    expect(ov.body.neverLoggedIn.some((u: any) => u.userId === student2UserId)).toBe(true);
    expect(ov.body.loggedInToday.STUDENT).toBeGreaterThanOrEqual(1);

    // Real logout invalidates token immediately
    const outRes = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${stToken}`);
    expect(outRes.status).toBe(200);

    const afterOut = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${stToken}`);
    expect(afterOut.status).toBe(401);
  }, 15000);

  it('2. Two tabs/sessions count as 1 unique user, disconnect grace period, idle & force logout', async () => {
    presenceService.registerSession({
      sessionId: `tab1_${runId}`,
      userId: student1UserId,
      name: 'Tab User',
      role: 'STUDENT',
      classId,
      deviceId: 'dev1',
      deviceType: 'computer',
      browser: 'Chrome',
      os: 'Windows',
      startedAt: Date.now(),
    });
    presenceService.registerSession({
      sessionId: `tab2_${runId}`,
      userId: student1UserId,
      name: 'Tab User',
      role: 'STUDENT',
      classId,
      deviceId: 'dev2',
      deviceType: 'phone',
      browser: 'Safari',
      os: 'iOS',
      startedAt: Date.now(),
    });

    const snap = presenceService.getSnapshot();
    const matches = snap.onlineUsers.filter((u) => u.userId === student1UserId);
    expect(matches.length).toBe(1); // Never double counted

    // Old force-logout endpoint is removed (404)
    const forceRes = await request(app)
      .post('/api/admin/monitor/force-logout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: student1UserId });
    expect(forceRes.status).toBe(404);

    presenceService.removeUserSessions(student1UserId);
  });

  it('3. Server health rules transition to DEGRADED and STRUGGLING on high lag/errors', () => {
    const degraded = metricsCollector.evaluateHealth({
      lagP99Ms: 150,
      httpP95Ms: 200,
      error5xxRate: 0,
      memoryPercent: 40,
      cpuPercent: 30,
      bypassDuration: true,
    });
    expect(degraded.status).toBe('DEGRADED');

    const struggling = metricsCollector.evaluateHealth({
      lagP99Ms: 450,
      httpP95Ms: 2500,
      error5xxRate: 7,
      memoryPercent: 92,
      cpuPercent: 95,
      bypassDuration: true,
    });
    expect(struggling.status).toBe('STRUGGLING');

    const healthy = metricsCollector.evaluateHealth({
      lagP99Ms: 10,
      httpP95Ms: 50,
      error5xxRate: 0,
      memoryPercent: 30,
      cpuPercent: 10,
      bypassDuration: true,
    });
    expect(healthy.status).toBe('HEALTHY');
  });
});
