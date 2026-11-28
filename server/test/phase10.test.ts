import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, repairSessionsMigration } from '../src/index';
import { prisma } from '../src/lib/prisma';
import { metricsCollector } from '../src/services/metricsCollector';
import { rushQueueService } from '../src/services/rushQueueService';

describe('Phase 10 Hotfix: Zero Force-Logout, 20x Refresh Persistence, Open Passwords, Kural Seed & Metrics', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P10D${runId}`;
  const empId = `P10F${runId}`;
  const regNo = `710010${runId}`;

  let adminToken = '';
  let adminCookie = '';
  let deptId = '';
  let yearId = '';
  let classId = '';
  let facultyUserId = '';
  let facultyTempPwd = '';
  let studentId = '';
  let studentUserId = '';
  let studentTempPwd = '';

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'ADMIN',
      deviceId: `p10_admin_${runId}`,
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;
    const setCookies = loginRes.headers['set-cookie'] as unknown as string[];
    adminCookie = setCookies.find((c) => c.startsWith('velan_refresh_token='))!;

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
    studentId = sRes.body.student.id;
    studentUserId = sRes.body.student.userId;
    studentTempPwd = sRes.body.tempPassword;
  }, 30000);

  afterAll(async () => {
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => { });
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => { });
    if (facultyUserId) await prisma.user.delete({ where: { id: facultyUserId } }).catch(() => { });
    if (studentUserId) await prisma.user.delete({ where: { id: studentUserId } }).catch(() => { });
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => { });
  });

  it('1. Strict role tabs: valid credentials on wrong tab return ROLE_TAB_MISMATCH; wrong password returns 401; old force-logout routes return 404', async () => {
    // Admin on Student tab -> ROLE_TAB_MISMATCH
    const wrongTabAdmin = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'STUDENT',
      deviceId: `p10_tab_${runId}`,
    });
    expect(wrongTabAdmin.status).toBe(403);
    expect(wrongTabAdmin.body.code).toBe('ROLE_TAB_MISMATCH');
    expect(wrongTabAdmin.body.targetRole).toBe('ADMIN');
    expect(wrongTabAdmin.body.error).toBe('This is an admin account. Please use the Admin tab.');

    // Wrong password on wrong tab must NOT leak role (returns generic 401)
    const wrongPwd = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: 'WrongPassword123',
      expectedRole: 'STUDENT',
      deviceId: `p10_tab_${runId}`,
    });
    expect(wrongPwd.status).toBe(401);
    expect(wrongPwd.body.code).toBeUndefined();

    const old1 = await request(app)
      .post('/api/admin/monitor/force-logout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentUserId });
    expect(old1.status).toBe(404);

    const old2 = await request(app)
      .post('/api/admin/monitor/force-logout-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(old2.status).toBe(404);
  });

  it('2. Password rules removed: 1-char, 4-char, digits-only allowed; empty/mismatch/same-as-temp rejected; gate enforced', async () => {
    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empId,
      password: facultyTempPwd,
      deviceId: `p10_fac_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    const restricted = fLogin.body.token;

    const blocked = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', `Bearer ${restricted}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const sameAsTemp = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restricted}`)
      .send({ newPassword: facultyTempPwd, confirmPassword: facultyTempPwd });
    expect(sameAsTemp.status).toBe(400);

    const mismatch = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restricted}`)
      .send({ newPassword: '1234', confirmPassword: '5678' });
    expect(mismatch.status).toBe(400);

    const chg4 = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restricted}`)
      .send({ newPassword: '1234', confirmPassword: '1234' });
    expect(chg4.status).toBe(200);
    expect(chg4.body.scope).toBe('full');

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

  it('3. Refresh 20 times for Admin, Faculty & Student keeps all logged in with 1 login / 0 logouts', async () => {
    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empId,
      password: '998877',
      deviceId: `p10_fac20_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    const fCookie = (fLogin.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('velan_refresh_token='))!;

    const sLogin = await request(app).post('/api/auth/login').send({
      identifier: regNo,
      password: studentTempPwd,
      deviceId: `p10_st_20x_${runId}`,
    });
    expect(sLogin.status).toBe(200);
    const chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${sLogin.body.token}`)
      .send({ newPassword: 'pass', confirmPassword: 'pass' });
    expect(chg.status).toBe(200);
    const sCookie = (chg.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('velan_refresh_token='))!;

    for (let i = 0; i < 20; i++) {
      const [aRef, fRef, sRef] = await Promise.all([
        request(app).post('/api/auth/refresh').set('Cookie', [adminCookie]),
        request(app).post('/api/auth/refresh').set('Cookie', [fCookie]),
        request(app).post('/api/auth/refresh').set('Cookie', [sCookie]),
      ]);
      expect(aRef.status).toBe(200);
      expect(fRef.status).toBe(200);
      expect(sRef.status).toBe(200);
    }

    const stEvents = await prisma.authEvent.findMany({ where: { userId: studentUserId } });
    expect(stEvents.filter((e) => e.event === 'login').length).toBe(1);
    expect(stEvents.filter((e) => e.event === 'logout').length).toBe(0);
  }, 45000);

  it('4. Admin password reset, device removal & own password change keep other sessions alive; own Logout ends only that session', async () => {
    // Student logs in on 2 devices (Phone + PC)
    const phoneLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile')
      .send({ identifier: regNo, password: 'pass', deviceId: `p10_phone_${runId}` });
    expect(phoneLogin.status).toBe(200);
    const phoneTok = phoneLogin.body.token;
    const phoneCookie = (phoneLogin.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('velan_refresh_token='))!;

    const pcLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ identifier: regNo, password: 'pass', deviceId: `p10_st_20x_${runId}` });
    expect(pcLogin.status).toBe(200);
    const pcTok = pcLogin.body.token;
    const pcCookie = (pcLogin.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('velan_refresh_token='))!;

    // Admin resets student password -> both active sessions remain valid
    const resetRes = await request(app)
      .post(`/api/academics/students/${studentId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(200);

    // Admin removes student devices -> active sessions remain valid
    await request(app)
      .delete(`/api/academics/students/${studentId}/devices/all`)
      .set('Authorization', `Bearer ${adminToken}`);

    // User changes own password on Phone -> PC session remains valid
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${phoneTok}`)
      .send({ newPassword: 'newpass', confirmPassword: 'newpass' });

    const pcStillValid = await request(app).post('/api/auth/refresh').set('Cookie', [pcCookie]);
    expect(pcStillValid.status).toBe(200);

    // Phone clicks Logout -> Phone session ends, PC stays logged in
    const phoneOut = await request(app).post('/api/logout').set('Authorization', `Bearer ${phoneTok}`);
    expect(phoneOut.status).toBe(200);

    const phoneAfterOut = await request(app).post('/api/auth/refresh').set('Cookie', [phoneCookie]);
    expect(phoneAfterOut.status).toBe(401);

    const pcAfterPhoneOut = await request(app).post('/api/auth/refresh').set('Cookie', [pcCookie]);
    expect(pcAfterPhoneOut.status).toBe(200);
    void pcTok;
  }, 30000);

  it('5. Repair Migration reactivates wrongly ended/revoked session; Kural seed & Quiet Server stay HEALTHY', async () => {
    // Simulate an old wrongly-flagged session
    const sess = await prisma.userSession.findFirst({
      where: {
        userId: studentUserId,
        OR: [{ endReason: null }, { endReason: { not: 'logout' } }],
      },
      orderBy: { startedAt: 'desc' },
    });
    expect(sess).toBeTruthy();
    await prisma.userSession.update({
      where: { id: sess!.id },
      data: { endedAt: new Date(), endReason: 'idle_timeout' },
    });
    await prisma.refreshToken.updateMany({
      where: { sessionId: sess!.id },
      data: { revokedAt: new Date() },
    });

    await repairSessionsMigration();

    const repaired = await prisma.userSession.findUnique({ where: { id: sess!.id } });
    expect(repaired?.endedAt).toBeNull();
    expect(repaired?.endReason).toBeNull();

    const cfg = await rushQueueService.loadConfigFromDB();
    expect(cfg.quotes.map((q) => q.id)).toEqual(expect.arrayContaining(['k611', 'k616', 'k619', 'k620']));

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
  }, 20000);
});
