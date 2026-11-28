import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 12: Single Default Password (1234) Flow', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P12D${runId}`;
  const empId = `P12FAC${runId}`;
  const regNo1 = `1230${runId}001`;
  const regNo2 = `1230${runId}002`;
  const regImp = `1230${runId}003`;

  let adminToken = '';
  let deptId = '';
  let yearId = '';
  let classId = '';
  let facultyId = '';
  let facultyUserId = '';
  let student1Id = '';
  let student1UserId = '';
  let student2Id = '';
  let student2UserId = '';
  let impStudentUserId = '';
  let student1Token = '';

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'ADMIN',
      deviceId: `p12_admin_${runId}`,
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase 12 Dept ${runId}`, code: deptCode });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, batch: `2025-2029-P12-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'P12-101' });
    classId = cRes.body.class.id;
  }, 30000);

  afterAll(async () => {
    for (const uid of [facultyUserId, student1UserId, student2UserId, impStudentUserId]) {
      if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. New student & faculty use 1234, no tempPassword returned, forced change rejects 1234 and accepts abcd', async () => {
    const fRes = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P12 Faculty ${runId}`, employeeId: empId, departmentId: deptId });
    expect(fRes.status).toBe(201);
    expect(fRes.body.tempPassword).toBeUndefined();
    facultyId = fRes.body.faculty.id;
    facultyUserId = fRes.body.faculty.userId;

    const s1Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P12 Student 1 ${runId}`, rollNo: `P12R1${runId}`, registerNo: regNo1, classId });
    expect(s1Res.status).toBe(201);
    expect(s1Res.body.tempPassword).toBeUndefined();
    student1Id = s1Res.body.student.id;
    student1UserId = s1Res.body.student.userId;

    const s2Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P12 Student 2 ${runId}`, rollNo: `P12R2${runId}`, registerNo: regNo2, classId });
    expect(s2Res.status).toBe(201);
    student2Id = s2Res.body.student.id;
    student2UserId = s2Res.body.student.userId;

    // Faculty signs in with 1234 -> mustChangePassword = true -> normal API blocked with 403
    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empId,
      password: '1234',
      expectedRole: 'FACULTY',
      deviceId: `p12_fac_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    expect(fLogin.body.mustChangePassword).toBe(true);

    const fBlocked = await request(app).get('/api/chat/rooms').set('Authorization', `Bearer ${fLogin.body.token}`);
    expect(fBlocked.status).toBe(403);
    expect(fBlocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    // Setting 1234 on forced change is rejected
    const reject1234 = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${fLogin.body.token}`)
      .send({ newPassword: '1234', confirmPassword: '1234' });
    expect(reject1234.status).toBe(400);
    expect(reject1234.body.error).toContain('1234');

    // Student 1 signs in with 1234 and sets 'abcd'
    const s1Login = await request(app).post('/api/auth/login').send({
      identifier: regNo1,
      password: '1234',
      expectedRole: 'STUDENT',
      deviceId: `p12_st1_${runId}`,
    });
    expect(s1Login.status).toBe(200);
    expect(s1Login.body.mustChangePassword).toBe(true);

    const s1Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${s1Login.body.token}`)
      .send({ newPassword: 'abcd', confirmPassword: 'abcd' });
    expect(s1Chg.status).toBe(200);
    student1Token = s1Chg.body.token;

    // Once set, 1234 stops working; 'abcd' works
    const old1234 = await request(app).post('/api/auth/login').send({
      identifier: regNo1,
      password: '1234',
      expectedRole: 'STUDENT',
      deviceId: `p12_st1_${runId}`,
    });
    expect(old1234.status).toBe(401);

    const withAbcd = await request(app).post('/api/auth/login').send({
      identifier: regNo1,
      password: 'abcd',
      expectedRole: 'STUDENT',
      deviceId: `p12_st1_${runId}`,
    });
    expect(withAbcd.status).toBe(200);
    expect(withAbcd.body.mustChangePassword).toBe(false);
  }, 20000);

  it('2. Admin reset restores 1234, keeps active session alive, and rejects old user password', async () => {
    const resetRes = await request(app)
      .post(`/api/academics/students/${student1Id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.tempPassword).toBeUndefined();

    // Active session stays alive
    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${student1Token}`);
    expect(meRes.status).toBe(200);

    // 'abcd' no longer works, '1234' works again
    const oldAbcd = await request(app).post('/api/auth/login').send({
      identifier: regNo1,
      password: 'abcd',
      expectedRole: 'STUDENT',
      deviceId: `p12_st1_${runId}`,
    });
    expect(oldAbcd.status).toBe(401);

    const backTo1234 = await request(app).post('/api/auth/login').send({
      identifier: regNo1,
      password: '1234',
      expectedRole: 'STUDENT',
      deviceId: `p12_st1_${runId}`,
    });
    expect(backTo1234.status).toBe(200);
    expect(backTo1234.body.mustChangePassword).toBe(true);
  }, 15000);

  it('3. Excel import, bulk reset, forgot-password approval, RBAC, and migration preview/apply', async () => {
    // Non-admin gets 403 on reset & migration endpoints
    const nonAdminReset = await request(app)
      .post(`/api/academics/students/${student2Id}/reset-password`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(nonAdminReset.status).toBe(403);

    const nonAdminMig = await request(app)
      .get('/api/academics/default-password/migration-preview')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(nonAdminMig.status).toBe(403);

    // Excel import uses 1234 and returns no credentials
    const impRes = await request(app)
      .post('/api/academics/students/import-excel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId,
        students: [{ name: `P12 Imported ${runId}`, rollNo: `P12I${runId}`, registerNo: regImp }],
      });
    expect(impRes.status).toBe(200);
    expect(impRes.body.credentials).toBeUndefined();

    const impLogin = await request(app).post('/api/auth/login').send({
      identifier: regImp,
      password: '1234',
      expectedRole: 'STUDENT',
      deviceId: `p12_imp_${runId}`,
    });
    expect(impLogin.status).toBe(200);
    impStudentUserId = impLogin.body.user.id;

    // Bulk reset returns resetCount without credentials
    const bulkRes = await request(app)
      .post('/api/academics/students/bulk-reset-passwords')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [student1Id, student2Id] });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.resetCount).toBe(2);
    expect(bulkRes.body.credentials).toBeUndefined();

    // Forgot password neutral response + admin approval sets 1234
    const fpKnown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: regNo2, reason: 'Forgot my password' });
    const fpUnknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: `UNKNOWN_${runId}` });
    expect(fpKnown.status).toBe(200);
    expect(fpUnknown.status).toBe(200);
    expect(fpKnown.body.message).toBe(fpUnknown.body.message);

    const reqRow = await prisma.passwordResetRequest.findFirst({
      where: { userId: student2UserId, status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
    });
    expect(reqRow).toBeTruthy();

    const decRes = await request(app)
      .post(`/api/academics/requests/password/${reqRow!.id}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED' });
    expect(decRes.status).toBe(200);
    expect(decRes.body.tempPassword).toBeUndefined();

    // Migration summary/preview/apply never affects Admin 'Vel'
    const summaryRes = await request(app)
      .get('/api/academics/default-password/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(summaryRes.status).toBe(200);
    expect(typeof summaryRes.body.count).toBe('number');

    const prevRes = await request(app)
      .get('/api/academics/default-password/migration-preview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prevRes.status).toBe(200);

    const applyRes = await request(app)
      .post('/api/academics/default-password/migrate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(applyRes.status).toBe(200);

    // Admin 'Vel' still logs in with ADMIN_PASSWORD, NOT 1234
    const adminBad = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: '1234',
      expectedRole: 'ADMIN',
      deviceId: `p12_admin_chk_${runId}`,
    });
    expect(adminBad.status).toBe(401);

    const adminOk = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'ADMIN',
      deviceId: `p12_admin_chk_${runId}`,
    });
    expect(adminOk.status).toBe(200);
  }, 25000);
});
