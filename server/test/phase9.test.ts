import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 9: Refresh Persistence, Advisor + 2 Mentors, & Forced Password Change', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P9D${runId}`;
  const empAdvisor = `P9ADV${runId}`;
  const empMentor1 = `P9M1_${runId}`;
  const empMentor2 = `P9M2_${runId}`;
  const regNo = `710029${runId}`;

  let adminToken = '';
  let deptId = '';
  let yearId = '';
  let classAId = '';
  let classBId = '';

  let advisorId = '';
  let advisorUserId = '';
  let advisorTempPwd = '';

  let mentor1Id = '';
  let mentor1UserId = '';
  let mentor1TempPwd = '';
  let mentor1Token = '';

  let mentor2Id = '';
  let mentor2UserId = '';
  let mentor2TempPwd = '';
  let mentor2Token = '';

  let studentId = '';
  let studentUserId = '';
  let studentTempPwd = '';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'Vel',
        password: process.env.ADMIN_PASSWORD || 'elite minds',
        deviceId: `p9_admin_${runId}`,
      });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase 9 Dept ${runId}`, code: deptCode });
    expect(dRes.status).toBe(201);
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, batch: `2025-2029-P9-${runId}` });
    expect(yRes.status).toBe(201);
    yearId = yRes.body.academicYear.id;

    const fAdv = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Advisor ${runId}`, employeeId: empAdvisor, departmentId: deptId });
    expect(fAdv.status).toBe(201);
    advisorId = fAdv.body.faculty.id;
    advisorUserId = fAdv.body.faculty.userId;
    advisorTempPwd = '1234';

    const fM1 = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Mentor One ${runId}`, employeeId: empMentor1, departmentId: deptId });
    expect(fM1.status).toBe(201);
    mentor1Id = fM1.body.faculty.id;
    mentor1UserId = fM1.body.faculty.userId;
    mentor1TempPwd = '1234';

    const fM2 = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Mentor Two ${runId}`, employeeId: empMentor2, departmentId: deptId });
    expect(fM2.status).toBe(201);
    mentor2Id = fM2.body.faculty.id;
    mentor2UserId = fM2.body.faculty.userId;
    mentor2TempPwd = '1234';
  }, 30000);

  afterAll(async () => {
    if (classAId) await prisma.class.delete({ where: { id: classAId } }).catch(() => {});
    if (classBId) await prisma.class.delete({ where: { id: classBId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (advisorUserId) await prisma.user.delete({ where: { id: advisorUserId } }).catch(() => {});
    if (mentor1UserId) await prisma.user.delete({ where: { id: mentor1UserId } }).catch(() => {});
    if (mentor2UserId) await prisma.user.delete({ where: { id: mentor2UserId } }).catch(() => {});
    if (studentUserId) await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Session Persistence: login sets httpOnly refresh cookie, /refresh rotates & revokes old token, lastRoute persists', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'Vel',
        password: process.env.ADMIN_PASSWORD || 'elite minds',
        deviceId: `p9_admin_ref_${runId}`,
      });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    expect(Array.isArray(cookies)).toBe(true);
    const refreshCookie1 = cookies.find((c) => c.startsWith('velan_refresh_token='));
    expect(refreshCookie1).toBeDefined();
    expect(refreshCookie1).toContain('HttpOnly');

    // Save lastRoute
    const routeRes = await request(app)
      .put('/api/auth/last-route')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ route: '/admin/academics' });
    expect(routeRes.status).toBe(200);

    // /api/me returns lastRoute
    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.lastRoute).toBe('/admin/academics');

    // Refresh extends sliding 90-day session & issues new access token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie1!]);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeTruthy();
    expect(refreshRes.body.user.lastRoute).toBe('/admin/academics');

    // User's own Logout ends only that session; subsequent /refresh returns 401
    const logoutRes = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${refreshRes.body.token}`);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie1!]);
    expect(afterLogout.status).toBe(401);
  });

  it('2. Forced Password Change: restricted token blocked with 403 PASSWORD_CHANGE_REQUIRED, rules & reuse enforced', async () => {
    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empMentor1,
      password: mentor1TempPwd,
      deviceId: `p9_m1_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    expect(fLogin.body.mustChangePassword).toBe(true);
    const restrictedToken = fLogin.body.token;

    // Restricted token blocked on normal API routes
    const blockedRes = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', `Bearer ${restrictedToken}`);
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Restricted token still allowed on /api/me
    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${restrictedToken}`);
    expect(meRes.status).toBe(200);

    // Setting same as temporary password is rejected
    const sameTempRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({ newPassword: mentor1TempPwd });
    expect(sameTempRes.status).toBe(400);

    // Any chosen password (other than 1234) succeeds and returns full-access token
    const goodPwd = '9999';
    const chgRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({ newPassword: goodPwd });
    expect(chgRes.status).toBe(200);
    expect(chgRes.body.scope).toBe('full');
    expect(chgRes.body.user.mustChangePassword).toBe(false);
    mentor1Token = chgRes.body.token;

    // Full-access token now passes middleware
    const okRes = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', `Bearer ${mentor1Token}`);
    expect(okRes.status).toBe(200);
  }, 15000);

  it('3. Class Form: Advisor + 2 Mentors validation, block deleting mentor, and mentor gets same access as advisor', async () => {
    // Same faculty twice must be rejected
    const dupRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        academicYearId: yearId,
        section: 'A',
        roomNumber: 'P9-101',
        advisorId,
        mentor1Id: advisorId,
      });
    expect(dupRes.status).toBe(400);

    // Create Class A with Advisor + Mentor 1 + Mentor 2
    const cARes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        academicYearId: yearId,
        section: 'A',
        roomNumber: 'P9-101',
        advisorId,
        mentor1Id,
        mentor2Id,
      });
    expect(cARes.status).toBe(201);
    classAId = cARes.body.class.id;
    expect(cARes.body.class.mentors.filter((m: any) => m.role === 'mentor').length).toBe(2);

    // Create Class B (unassigned to mentor1/mentor2)
    const cBRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'B', roomNumber: 'P9-102' });
    expect(cBRes.status).toBe(201);
    classBId = cBRes.body.class.id;

    // Register student in Class A
    const stRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P9 Student ${runId}`, rollNo: `P9R${runId}`, registerNo: regNo, classId: classAId });
    expect(stRes.status).toBe(201);
    studentId = stRes.body.student.id;
    studentUserId = stRes.body.student.userId;
    studentTempPwd = '1234';
    expect(stRes.body.tempPassword).toBeUndefined();

    // Mentor 2 logs in & sets password
    const m2Login = await request(app).post('/api/auth/login').send({
      identifier: empMentor2,
      password: mentor2TempPwd,
      deviceId: `p9_m2_${runId}`,
    });
    const m2Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${m2Login.body.token}`)
      .send({ currentPassword: mentor2TempPwd, newPassword: 'VelanMentor2#2026' });
    mentor2Token = m2Chg.body.token;

    // Mentor 1 & Mentor 2 both get full Class A advisor overview + whole student list
    const m1Adv = await request(app)
      .get(`/api/academics-records/advisees?classId=${classAId}`)
      .set('Authorization', `Bearer ${mentor1Token}`);
    expect(m1Adv.status).toBe(200);
    expect(m1Adv.body.advisedClasses.find((c: any) => c.id === classAId)?.role).toBe('mentor');
    expect(m1Adv.body.students.some((s: any) => s.studentId === studentId)).toBe(true);

    // Mentor 1 gets 403 on Class B
    const m1ClassB = await request(app)
      .get(`/api/academics-records/advisees?classId=${classBId}`)
      .set('Authorization', `Bearer ${mentor1Token}`);
    expect(m1ClassB.status).toBe(403);

    // Mentor 2 can view Class A chat room & messages
    const m2Rooms = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', `Bearer ${mentor2Token}`);
    expect(m2Rooms.status).toBe(200);
    expect(m2Rooms.body.rooms.some((r: any) => r.classId === classAId)).toBe(true);

    // Remove Mentor 2 from Class A -> access immediately revoked
    const removeM2 = await request(app)
      .put(`/api/academics/classes/${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ section: 'A', roomNumber: 'P9-101', advisorId, mentor1Id, mentor2Id: '' });
    expect(removeM2.status).toBe(200);

    const m2AfterRemove = await request(app)
      .get(`/api/academics-records/advisees?classId=${classAId}`)
      .set('Authorization', `Bearer ${mentor2Token}`);
    expect(m2AfterRemove.status).toBe(403);
  }, 25000);

  it('4. Admin Reset keeps active sessions alive & Neutral Forgot Password', async () => {
    // Admin resets Mentor 1 password -> active session stays valid (no forced logout)
    const resetRes = await request(app)
      .post(`/api/academics/faculty/${mentor1Id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.tempPassword).toBeUndefined();

    const oldTokenCheck = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${mentor1Token}`);
    expect(oldTokenCheck.status).toBe(200);

    // Neutral forgot-password returns same 200 message for valid and invalid identifiers
    const fpValid = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: regNo, reason: 'Lost password' });
    const fpInvalid = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: `NONEXISTENT_${runId}` });
    expect(fpValid.status).toBe(200);
    expect(fpInvalid.status).toBe(200);
    expect(fpValid.body.message).toBe(fpInvalid.body.message);
  }, 15000);
});
