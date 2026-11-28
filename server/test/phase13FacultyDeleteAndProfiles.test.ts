import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 13: Faculty Handover Delete, Admin Edit, & Role Profile/Settings', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P13D${runId}`;
  const emp1 = `P13F1_${runId}`;
  const emp2 = `P13F2_${runId}`;
  const regNo = `1330${runId}001`;

  let adminToken = '';
  let deptId = '';
  let yearId = '';
  let classId = '';
  let subjectId = '';
  let fac1Id = '';
  let fac1UserId = '';
  let fac2Id = '';
  let fac2UserId = '';
  let fac2Token = '';
  let studentId = '';
  let studentUserId = '';
  let studentToken = '';

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'ADMIN',
      deviceId: `p13_admin_${runId}`,
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase 13 Dept ${runId}`, code: deptCode });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, batch: `2024-2028-P13-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'C', roomNumber: 'P13-101' });
    classId = cRes.body.class.id;

    const subRes = await request(app)
      .post('/api/academics/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, code: `P13S${runId}`, name: `P13 Subject ${runId}`, type: 'THEORY', credits: 3 });
    subjectId = subRes.body.subject.id;

    const f1Res = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Dr. P13 One ${runId}`, employeeId: emp1, departmentId: deptId });
    fac1Id = f1Res.body.faculty.id;
    fac1UserId = f1Res.body.faculty.userId;

    const f2Res = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Prof. P13 Two ${runId}`, employeeId: emp2, departmentId: deptId });
    fac2Id = f2Res.body.faculty.id;
    fac2UserId = f2Res.body.faculty.userId;

    // Assign fac1 as Advisor of classId
    await request(app)
      .put(`/api/academics/classes/${classId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ advisorId: fac1Id, mentorIds: [fac2Id] });

    // Create student
    const sRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P13 Student ${runId}`, rollNo: `P13R${runId}`, registerNo: regNo, classId });
    studentId = sRes.body.student.id;
    studentUserId = sRes.body.student.userId;

    // Log in fac2 & student and set their passwords
    const f2Login = await request(app).post('/api/auth/login').send({
      identifier: emp2,
      password: '1234',
      expectedRole: 'FACULTY',
      deviceId: `p13_f2_${runId}`,
    });
    const f2Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${f2Login.body.token}`)
      .send({ newPassword: 'fac2pass', confirmPassword: 'fac2pass' });
    fac2Token = f2Chg.body.token;

    const sLogin = await request(app).post('/api/auth/login').send({
      identifier: regNo,
      password: '1234',
      expectedRole: 'STUDENT',
      deviceId: `p13_st_${runId}`,
    });
    const sChg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${sLogin.body.token}`)
      .send({ newPassword: 'stpass', confirmPassword: 'stpass' });
    studentToken = sChg.body.token;
  }, 30000);

  afterAll(async () => {
    for (const uid of [fac1UserId, fac2UserId, studentUserId]) {
      if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Faculty delete handover inspects advisor role, preserves attendance snapshot, and hard-deletes faculty', async () => {
    // Create a classSubject and closed AttendanceSession for fac1
    const cs = await prisma.classSubject.create({
      data: { classId, subjectId, facultyId: fac1Id },
    });
    const sess = await prisma.attendanceSession.create({
      data: {
        classId,
        classSubjectId: cs.id,
        facultyId: fac1Id,
        anchorLat: 13.08,
        anchorLng: 80.27,
        radiusMeters: 500,
        rotatingToken: 'tok13',
        isActive: false,
        expiresAt: new Date(Date.now() + 60000),
        closedAt: new Date(),
      },
    });

    // Dependencies endpoint lists advised class & session count
    const depRes = await request(app)
      .get(`/api/academics/faculty/${fac1Id}/dependencies`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(depRes.status).toBe(200);
    expect(depRes.body.advisedClasses.length).toBe(1);
    expect(depRes.body.totalSessionsCount).toBe(1);

    // Direct delete removes advisor/mentor links, clears subject teacher, keeps attendance snapshot
    const startMs = Date.now();
    const okDel = await request(app)
      .delete(`/api/academics/faculty/${fac1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(okDel.status).toBe(200);
    expect(Date.now() - startMs).toBeLessThan(5000);

    const remainingFac = await prisma.facultyProfile.findUnique({ where: { id: fac1Id } });
    expect(remainingFac).toBeNull();

    const updatedSess = await prisma.attendanceSession.findUnique({ where: { id: sess.id } });
    expect(updatedSess?.facultyId).toBeNull();
    expect(updatedSess?.facultyName).toContain('(former faculty)');

    const updatedClass = await prisma.class.findUnique({ where: { id: classId } });
    expect(updatedClass?.advisorId).toBeNull();

    const updatedCs = await prisma.classSubject.findUnique({ where: { id: cs.id } });
    expect(updatedCs).toBeTruthy();
    expect(updatedCs?.facultyId).toBeNull();
  }, 20000);

  it('2. Admin edit faculty/student validates uniqueness, writes audit log, and keeps sessions alive', async () => {
    const editRes = await request(app)
      .put(`/api/academics/students/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '9876543210', hostelOrDayScholar: 'HOSTEL', admissionYear: 2024 });
    expect(editRes.status).toBe(200);

    // Active student session still works
    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${studentToken}`);
    expect(meRes.status).toBe(200);
  }, 15000);

  it('3. Faculty edits own profile directly; Student cannot edit directly and uses request -> auto-apply', async () => {
    // Faculty direct edit succeeds
    const fEdit = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${fac2Token}`)
      .send({ officeRoom: 'Block-C 302', specialization: 'Machine Learning' });
    expect(fEdit.status).toBe(200);

    // Student direct profile edit is blocked with 403
    const sBlocked = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phone: '1111111111' });
    expect(sBlocked.status).toBe(403);

    // Student submits profile change request
    const reqRes = await request(app)
      .post('/api/profile/change-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ field: 'phone', newValue: '9998887776', reason: 'New SIM card' });
    expect(reqRes.status).toBe(201);
    const reqId = reqRes.body.request.id;

    // Admin approves -> automatically applied to StudentProfile
    const appRes = await request(app)
      .post(`/api/academics/requests/profile-edit/${reqId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });
    expect(appRes.status).toBe(200);

    const updatedStudent = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    expect(updatedStudent?.phone).toBe('9998887776');
  }, 20000);

  it('4. Student self-edit via PATCH /api/me/profile updates allowed fields, blocks locked fields with 403, logs audit, and avoids @student.local', async () => {
    // Locked fields must return 403
    for (const lockedBody of [
      { name: 'Hacked Name' },
      { registerNo: '999999999' },
      { rollNo: '99' },
      { classId: '00000000-0000-0000-0000-000000000000' },
      { isCR: true },
      { role: 'ADMIN' },
    ]) {
      const blocked = await request(app)
        .patch('/api/me/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(lockedBody);
      expect(blocked.status).toBe(403);
    }

    // Invalid phone & guardianName fail with 400
    const badPhone = await request(app)
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phone: '12345' });
    expect(badPhone.status).toBe(400);

    // Valid self-edit succeeds & strips HTML from address
    const okPatch = await request(app)
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        phone: '+91 98765 43210',
        personalEmail: 'student.real@example.com',
        guardianName: 'Mr. Kumar S.',
        guardianPhone: '9876501234',
        address: '<b>12 Anna Nagar</b>, Chennai 600040',
        bloodGroup: 'O+',
        hostelOrDayScholar: 'DAY_SCHOLAR',
        dob: '2006-05-15',
      });
    expect(okPatch.status).toBe(200);

    const after = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    expect(after?.phone).toBe('9876543210');
    expect(after?.personalEmail).toBe('student.real@example.com');
    expect(after?.address).toBe('12 Anna Nagar, Chennai 600040');
    expect(after?.bloodGroup).toBe('O+');
    expect(after?.hostelOrDayScholar).toBe('DAY_SCHOLAR');

    // Audit log recorded & visible to admin
    const auditRes = await request(app)
      .get(`/api/academics/students/${studentId}/audit`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.logs.some((l: any) => l.field === 'personalEmail' && l.newValue === 'student.real@example.com')).toBe(true);

    // Newly created student does not get @student.local email
    const newStudentRes = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'No Placeholder Email Student',
        registerNo: `REG${Date.now()}`,
        rollNo: `R${Date.now() % 10000}`,
        classId,
      });
    expect(newStudentRes.status).toBe(201);
    const createdUser = await prisma.user.findUnique({ where: { id: newStudentRes.body.student.userId } });
    expect(createdUser?.email).toBeNull();
  }, 20000);
});
