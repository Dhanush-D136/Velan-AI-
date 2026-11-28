import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 14: Class Representative (CR) Role, Permissions & Cleanup', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P14D${runId}`;
  const empId = `P14FAC${runId}`;
  const regCR = `1430${runId}001`;
  const regNormal = `1430${runId}002`;
  const regOther = `1430${runId}003`;

  let adminToken = '';
  let facultyToken = '';
  let crToken = '';
  let normalToken = '';
  let deptId = '';
  let yearId = '';
  let classAId = '';
  let classBId = '';
  let subjectId = '';
  let facultyId = '';
  let facultyUserId = '';
  let crStudentId = '';
  let crUserId = '';
  let normalStudentId = '';
  let normalUserId = '';
  let otherStudentId = '';
  let otherUserId = '';

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'ADMIN',
      deviceId: `p14_admin_${runId}`,
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase 14 Dept ${runId}`, code: deptCode });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, batch: `2024-2028-P14-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cARes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'P14-101' });
    classAId = cARes.body.class.id;

    const cBRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'B', roomNumber: 'P14-102' });
    classBId = cBRes.body.class.id;

    const subRes = await request(app)
      .post('/api/academics/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, code: `P14S${runId}`, name: `P14 Subject ${runId}`, type: 'THEORY', credits: 3 });
    subjectId = subRes.body.subject.id;

    const fRes = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P14 Faculty ${runId}`, employeeId: empId, departmentId: deptId });
    facultyId = fRes.body.faculty.id;
    facultyUserId = fRes.body.faculty.userId;

    await request(app)
      .post('/api/academics/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classId: classAId, subjectId, facultyId });

    const sCRRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P14 CR Student ${runId}`, rollNo: `P14R1${runId}`, registerNo: regCR, classId: classAId });
    crStudentId = sCRRes.body.student.id;
    crUserId = sCRRes.body.student.userId;

    const sNormRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P14 Normal Student ${runId}`, rollNo: `P14R2${runId}`, registerNo: regNormal, classId: classAId });
    normalStudentId = sNormRes.body.student.id;
    normalUserId = sNormRes.body.student.userId;

    const sOtherRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P14 Other Student ${runId}`, rollNo: `P14R3${runId}`, registerNo: regOther, classId: classBId });
    otherStudentId = sOtherRes.body.student.id;
    otherUserId = sOtherRes.body.student.userId;

    // Log in faculty, CR student, and normal student
    const fLog = await request(app).post('/api/auth/login').send({ identifier: empId, password: '1234', expectedRole: 'FACULTY', deviceId: `p14_f_${runId}` });
    const fChg = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${fLog.body.token}`).send({ newPassword: 'facpass', confirmPassword: 'facpass' });
    facultyToken = fChg.body.token;

    const cLog = await request(app).post('/api/auth/login').send({ identifier: regCR, password: '1234', expectedRole: 'STUDENT', deviceId: `p14_cr_${runId}` });
    const cChg = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${cLog.body.token}`).send({ newPassword: 'crpass', confirmPassword: 'crpass' });
    crToken = cChg.body.token;

    const nLog = await request(app).post('/api/auth/login').send({ identifier: regNormal, password: '1234', expectedRole: 'STUDENT', deviceId: `p14_n_${runId}` });
    const nChg = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${nLog.body.token}`).send({ newPassword: 'npass', confirmPassword: 'npass' });
    normalToken = nChg.body.token;
  }, 35000);

  afterAll(async () => {
    await prisma.setting.deleteMany({ where: { key: 'cr_can_edit_faculty_posts' } }).catch(() => {});
    for (const uid of [facultyUserId, crUserId, normalUserId, otherUserId]) {
      if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
    if (classAId) await prisma.class.delete({ where: { id: classAId } }).catch(() => {});
    if (classBId) await prisma.class.delete({ where: { id: classBId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Admin assigns CR via class form, rejects duplicates/wrong-class, and Students Directory filters CRs', async () => {
    const dupRes = await request(app)
      .put(`/api/academics/classes/${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ crIds: [crStudentId, crStudentId] });
    expect(dupRes.status).toBe(400);

    const wrongClsRes = await request(app)
      .put(`/api/academics/classes/${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ crIds: [otherStudentId] });
    expect(wrongClsRes.status).toBe(400);

    const okRes = await request(app)
      .put(`/api/academics/classes/${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ crIds: [crStudentId] });
    expect(okRes.status).toBe(200);

    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${crToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.isCR).toBe(true);

    const listRes = await request(app)
      .get(`/api/academics/students?classId=${classAId}&crOnly=true`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.students.some((s: any) => s.id === crStudentId)).toBe(true);
    expect(listRes.body.students.some((s: any) => s.id === normalStudentId)).toBe(false);
  }, 20000);

  it('2. CR manages assignments & materials for own class; normal student gets 403; CR gets 403 on other class & admin/faculty endpoints', async () => {
    const now = Date.now();
    // Normal student blocked
    const normCreate = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${normalToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'Blocked',
        description: 'No',
        startDate: new Date(now).toISOString(),
        dueDate: new Date(now + 86400000).toISOString(),
      });
    expect(normCreate.status).toBe(403);

    // CR creates assignment in own class
    const crAssign = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${crToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'CR Unit 1 Notes Task',
        description: 'Submit PDF',
        startDate: new Date(now).toISOString(),
        dueDate: new Date(now + 86400000).toISOString(),
        links: [{ title: 'Drive Sheet', url: 'https://drive.google.com/file/d/abc' }],
      });
    expect(crAssign.status).toBe(201);
    expect(crAssign.body.assignment.createdByRole).toBe('CR');
    const crAssignId = crAssign.body.assignment.id;

    // CR creates material in own class
    const crMat = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${crToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'CR Lecture Slides',
        type: 'slides',
        links: [{ title: 'Slides', url: 'https://drive.google.com/file/d/xyz' }],
      });
    expect(crMat.status).toBe(201);
    expect(crMat.body.material.createdByRole).toBe('CR');

    // CR blocked from other class
    const otherCls = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${crToken}`)
      .send({
        classId: classBId,
        subjectId,
        title: 'Cross Class',
        description: 'Blocked',
        startDate: new Date(now).toISOString(),
        dueDate: new Date(now + 86400000).toISOString(),
      });
    expect(otherCls.status).toBe(403);

    // CR blocked from taking attendance & toggling CR
    const attBlocked = await request(app)
      .post('/api/attendance/start')
      .set('Authorization', `Bearer ${crToken}`)
      .send({ classId: classAId, subjectId });
    expect(attBlocked.status).toBe(403);

    const toggleBlocked = await request(app)
      .post(`/api/academics/students/${normalStudentId}/toggle-cr`)
      .set('Authorization', `Bearer ${crToken}`);
    expect(toggleBlocked.status).toBe(403);

    // Setting cr_can_edit_faculty_posts = 'false' blocks CR editing faculty assignment
    const facAssign = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'Faculty Assignment',
        description: 'Official',
        startDate: new Date(now).toISOString(),
        dueDate: new Date(now + 86400000).toISOString(),
      });
    expect(facAssign.status).toBe(201);

    await prisma.setting.upsert({
      where: { key: 'cr_can_edit_faculty_posts' },
      update: { value: 'false' },
      create: { key: 'cr_can_edit_faculty_posts', value: 'false' },
    });

    const crEditFacBlocked = await request(app)
      .put(`/api/assignments/${facAssign.body.assignment.id}`)
      .set('Authorization', `Bearer ${crToken}`)
      .send({ title: 'Edited by CR' });
    expect(crEditFacBlocked.status).toBe(403);

    // CR can still delete own assignment
    const crDelOwn = await request(app)
      .delete(`/api/assignments/${crAssignId}`)
      .set('Authorization', `Bearer ${crToken}`);
    expect(crDelOwn.status).toBe(200);
  }, 25000);

  it('3. Removing CR role revokes access immediately without logging student out', async () => {
    const remRes = await request(app)
      .post(`/api/academics/students/${crStudentId}/toggle-cr`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(remRes.status).toBe(200);
    expect(remRes.body.isCR).toBe(false);

    // Student still logged in on /api/me, but isCR is false and createAssignment is 403
    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${crToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.isCR).toBe(false);

    const matBlocked = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${crToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'After Removal',
        type: 'notes',
        links: [{ title: 'Link', url: 'https://example.com' }],
      });
    expect(matBlocked.status).toBe(403);
  }, 15000);

  it('4. Login and refresh responses include isCR, crClassId, and crClassName', async () => {
    const assignRes = await request(app)
      .post(`/api/academics/students/${crStudentId}/toggle-cr`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.isCR).toBe(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: regCR, password: 'crpass', deviceId: `p14_cr_${runId}` });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.isCR).toBe(true);
    expect(loginRes.body.user.crClassId).toBe(classAId);
    expect(loginRes.body.user.crClassName).toBeTruthy();

    const cookies = loginRes.headers['set-cookie'];
    if (cookies) {
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.user.isCR).toBe(true);
      expect(refreshRes.body.user.crClassId).toBe(classAId);
    }
  }, 15000);
});
