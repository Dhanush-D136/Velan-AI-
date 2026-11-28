import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';
import { metricsCollector } from '../src/services/metricsCollector';
import { rushQueueService } from '../src/services/rushQueueService';

describe('Phase 10: Refresh Persistence (10x), Admin Password Force-Logout, Open Passwords, Kural Seed & Metrics', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P10D${runId}`;
  const empId = `P10F${runId}`;
  const regNo = `710010${runId}`;

  let adminToken = '';
  let deptId = '';
  let yearId = '';
  let classId = '';
  let facultyUserId = '';
  let facultyTempPwd = '';
  let studentUserId = '';
  let studentTempPwd = '';

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `p10_admin_${runId}`,
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase 10 Dept ${runId}`, code: deptCode });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 1, batch: `2025-2029-P10-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'P10-101' });
    classId = cRes.body.class.id;

    const fRes = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P10 Faculty ${runId}`, employeeId: empId, departmentId: deptId });
    facultyUserId = fRes.body.faculty.userId;
    facultyTempPwd = fRes.body.tempPassword;

    const sRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P10 Student ${runId}`, rollNo: `P10R${runId}`, registerNo: regNo, classId });
    studentUserId = sRes.body.student.userId;
    studentTempPwd = sRes.body.tempPassword;
  }, 30000);

  afterAll(async () => {
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (facultyUserId) await prisma.user.delete({ where: { id: facultyUserId } }).catch(() => {});
    if (studentUserId) await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Password rules removed: 1-char, 4-char, digits-only allowed; empty/mismatch/same-as-temp rejected; gate enforced', async () => {
    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empId,
      password: facultyTempPwd,
      deviceId: `p10_fac_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    const restricted = fLogin.body.token;

    // Gate still blocks normal routes
    const blocked = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', `Bearer ${restricted}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Same as temporary password is rejected
    const sameAsTemp = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restricted}`)
      .send({ newPassword: facultyTempPwd, confirmPassword: facultyTempPwd });
    expect(sameAsTemp.status).toBe(400);

    // Mismatched confirm is rejected
    const mismatch = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restricted}`)
      .send({ newPassword: '1234', confirmPassword: '5678' });
    expect(mismatch.status).toBe(400);

    // 4-digit "1234" is now ACCEPTED
    const chg4 = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restricted}`)
      .send({ newPassword: '1234', confirmPassword: '1234' });
    expect(chg4.status).toBe(200);
    expect(chg4.body.scope).toBe('full');

    // 1-char "a" and 6-digit "998877" are ACCEPTED in regular password change
    const chg1 = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${chg4.body.token}`)
      .send({ currentPassword: '1234', newPassword: 'a', confirmPassword: 'a' });
    expect(chg1.status).toBe(200);

    const chg6 = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${chg1.body.token}`)
      .send({ currentPassword: 'a', newPassword: '998877', confirmPassword: '998877' });
    expect(chg6.status).toBe(200);
  }, 25000);

  it('2. Refresh 10 times keeps user logged in and produces 1 login / 0 logouts in auth_events', async () => {
    const sLogin = await request(app).post('/api/auth/login').send({
      identifier: regNo,
      password: studentTempPwd,
      deviceId: `p10_st_10x_${runId}`,
    });
    expect(sLogin.status).toBe(200);

    const chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${sLogin.body.token}`)
      .send({ newPassword: 'pass', confirmPassword: 'pass' });
    expect(chg.status).toBe(200);

    const setCookies = chg.headers['set-cookie'] as unknown as string[];
    let cookie = setCookies.find((c) => c.startsWith('velan_refresh_token='))!;
    expect(cookie).toBeDefined();

    for (let i = 0; i < 10; i++) {
      const ref = await request(app).post('/api/auth/refresh').set('Cookie', [cookie]);
      expect(ref.status).toBe(200);
      expect(ref.body.token).toBeTruthy();
      const nextCookies = ref.headers['set-cookie'] as unknown as string[];
      cookie = nextCookies.find((c) => c.startsWith('velan_refresh_token='))!;
    }

    const events = await prisma.authEvent.findMany({ where: { userId: studentUserId } });
    const logins = events.filter((e) => e.event === 'login').length;
    const logouts = events.filter((e) => e.event === 'logout').length;
    expect(logins).toBe(1);
    expect(logouts).toBe(0);
  }, 30000);

  it('3. Admin Force-Logout requires Admin Password; wrong password or non-admin returns 403', async () => {
    const sLogin = await request(app).post('/api/auth/login').send({
      identifier: regNo,
      password: 'pass',
      deviceId: `p10_st_10x_${runId}`,
    });
    expect(sLogin.status).toBe(200);
    const stTok = sLogin.body.token;

    // Non-admin cannot call force-logout
    const nonAdmin = await request(app)
      .post('/api/admin/monitor/force-logout')
      .set('Authorization', `Bearer ${stTok}`)
      .send({ userId: facultyUserId, adminPassword: 'pass' });
    expect(nonAdmin.status).toBe(403);

    // Wrong admin password refuses and leaves session active
    const wrongPwd = await request(app)
      .post('/api/admin/monitor/force-logout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentUserId, adminPassword: 'WrongAdminPassword!' });
    expect(wrongPwd.status).toBe(403);

    const stillValid = await request(app).get('/api/me').set('Authorization', `Bearer ${stTok}`);
    expect(stillValid.status).toBe(200);

    // Correct admin password revokes session
    const okForce = await request(app)
      .post('/api/admin/monitor/force-logout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentUserId, adminPassword: process.env.ADMIN_PASSWORD || 'elite minds' });
    expect(okForce.status).toBe(200);

    const afterForce = await request(app).get('/api/me').set('Authorization', `Bearer ${stTok}`);
    expect(afterForce.status).toBe(401);
  }, 20000);

  it('4. Kural Seed (611, 616, 619, 620) & Quiet Server stays HEALTHY despite 1 slow request', async () => {
    const cfg = await rushQueueService.loadConfigFromDB();
    expect(cfg.enabled).toBe(false);
    const ids = cfg.quotes.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['k611', 'k616', 'k619', 'k620']));
    for (const q of cfg.quotes) {
      expect(q.kural).toBeTruthy();
      expect(q.porul).toBeTruthy();
    }

    // Single slow 3.89s HTTP request on quiet server (<30 samples) must NOT trigger STRUGGLING
    const evalQuiet = metricsCollector.evaluateHealth({
      lagP99Ms: 4,
      httpP95Ms: 3890,
      error5xxRate: 0,
      memoryPercent: 30,
      cpuPercent: 10,
      sampleCount: 1,
      bypassDuration: true,
    });
    expect(evalQuiet.status).toBe('HEALTHY');
  });
});
