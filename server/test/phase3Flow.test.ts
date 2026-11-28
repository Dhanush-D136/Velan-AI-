import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 3 Integration Flow: C1, C2, C3, Skip & Academics Permissions', () => {
  let adminToken = '';
  let facultyToken = '';
  let otherFacultyToken = '';
  let student1Token = '';
  let student2Token = '';

  let deptId = '';
  let yearId = '';
  let classAId = '';
  let classBId = '';
  let subjectId = '';
  let facultyId = '';
  let facultyUserId = '';
  let otherFacultyUserId = '';
  let student1Id = '';
  let student1UserId = '';
  let student2Id = '';
  let student2UserId = '';

  const runId = Math.floor(10000 + Math.random() * 89999);
  const deptCode = `P3D${runId}`;
  const subjCode = `P3S${runId}`;
  const emp1 = `P3F1_${runId}`;
  const emp2 = `P3F2_${runId}`;
  const reg1 = `P3R1_${runId}`;
  const reg2 = `P3R2_${runId}`;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `admin_p3_${runId}`,
    });
    expect(res.status).toBe(200);
    adminToken = res.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: deptCode, name: `Phase 3 Dept ${runId}` });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, batch: `2025-2029-${runId}` });
    yearId = yRes.body.academicYear.id;

    const f1Res = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Advisor Prof ${runId}`, employeeId: emp1, departmentId: deptId });
    facultyId = f1Res.body.faculty.id;
    facultyUserId = f1Res.body.faculty.userId;

    const f2Res = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Other Prof ${runId}`, employeeId: emp2, departmentId: deptId });
    otherFacultyUserId = f2Res.body.faculty.userId;
    (globalThis as any).__p3_f1Pwd = '1234';
    (globalThis as any).__p3_f2Pwd = '1234';

    const cARes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'R-301', advisorId: facultyId });
    classAId = cARes.body.class.id;

    const cBRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'B', roomNumber: 'R-302' });
    classBId = cBRes.body.class.id;

    const sRes = await request(app)
      .post('/api/academics/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, code: subjCode, name: 'Machine Learning', type: 'THEORY', credits: 4 });
    subjectId = sRes.body.subject.id;

    // Assign ClassSubject (without timetable slot) to test C1 ClassSubject assignment path
    const assignRes = await request(app)
      .post('/api/academics/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classId: classAId, subjectId, facultyId });
    expect(assignRes.status).toBe(200);

    const st1Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Student One ${runId}`, rollNo: `RO1_${runId}`, registerNo: reg1, classId: classAId });
    student1Id = st1Res.body.student.id;
    student1UserId = st1Res.body.student.userId;
    (globalThis as any).__p3_st1Pwd = '1234';

    const st2Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Student Two ${runId}`, rollNo: `RO2_${runId}`, registerNo: reg2, classId: classBId });
    student2Id = st2Res.body.student.id;
    student2UserId = st2Res.body.student.userId;

    const f1Login = await request(app).post('/api/auth/login').send({
      identifier: emp1,
      password: (globalThis as any).__p3_f1Pwd,
      deviceId: `fac1_p3_${runId}`,
    });
    const f1Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${f1Login.body.token}`)
      .send({ currentPassword: (globalThis as any).__p3_f1Pwd, newPassword: 'VelanTest#2026' });
    facultyToken = f1Chg.body.token;

    const f2Login = await request(app).post('/api/auth/login').send({
      identifier: emp2,
      password: (globalThis as any).__p3_f2Pwd,
      deviceId: `fac2_p3_${runId}`,
    });
    const f2Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${f2Login.body.token}`)
      .send({ currentPassword: (globalThis as any).__p3_f2Pwd, newPassword: 'VelanTest#2026' });
    otherFacultyToken = f2Chg.body.token;

    const st2Login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ identifier: reg2, password: '1234', deviceId: `st2_pc_${runId}` });
    const st2Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${st2Login.body.token}`)
      .send({ currentPassword: '1234', newPassword: 'VelanTest#2026' });
    student2Token = st2Chg.body.token;
  }, 25000);

  afterAll(async () => {
    if (classAId) await prisma.class.delete({ where: { id: classAId } }).catch(() => {});
    if (classBId) await prisma.class.delete({ where: { id: classBId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
    if (facultyUserId) await prisma.user.delete({ where: { id: facultyUserId } }).catch(() => {});
    if (otherFacultyUserId) await prisma.user.delete({ where: { id: otherFacultyUserId } }).catch(() => {});
    if (student1UserId) await prisma.user.delete({ where: { id: student1UserId } }).catch(() => {});
    if (student2UserId) await prisma.user.delete({ where: { id: student2UserId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('C3. Device limit: phone + computer allowed, 3rd refused with DEVICE_LIMIT_REACHED, unauth reset works', async () => {
    const st1Pwd0 = (globalThis as any).__p3_st1Pwd;
    const phoneRes = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile')
      .send({ identifier: reg1, password: st1Pwd0, deviceId: `p3_phone_${runId}` });
    expect(phoneRes.status).toBe(200);
    const st1Chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${phoneRes.body.token}`)
      .send({ currentPassword: st1Pwd0, newPassword: 'VelanTest#2026' });
    student1Token = st1Chg.body.token;

    const pcRes = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ identifier: reg1, password: 'VelanTest#2026', deviceId: `p3_pc_${runId}` });
    expect(pcRes.status).toBe(200);

    // Same registered device re-logs in normally
    const relogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Mobile')
      .send({ identifier: reg1, password: 'VelanTest#2026', deviceId: `p3_phone_${runId}` });
    expect(relogin.status).toBe(200);

    // 3rd device refused with exact code & message
    const third = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile')
      .send({ identifier: reg1, password: 'VelanTest#2026', deviceId: `p3_third_${runId}` });
    expect(third.status).toBe(403);
    expect(third.body.code).toBe('DEVICE_LIMIT_REACHED');
    expect(third.body.error).toContain('already signed in on 2 devices');

    // Unauthenticated reset request
    const resetReq = await request(app)
      .post('/api/auth/device-request')
      .send({ registerNo: reg1, newDeviceId: `p3_third_${runId}`, note: 'Lost old phone' });
    expect(resetReq.status).toBe(200);
  });

  it('C1. Faculty Assignment Save: 0, 1, 3 links succeed; invalid dates/URL/wrong class fail', async () => {
    const now = Date.now();
    const base = {
      classId: classAId,
      subjectId,
      description: 'Lab work',
      startDate: new Date(now).toISOString(),
      dueDate: new Date(now + 86400000).toISOString(),
      submissionDate: new Date(now + 2 * 86400000).toISOString(),
    };

    const zeroLinks = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ ...base, title: 'Zero Links Assignment', links: [] });
    expect(zeroLinks.status).toBe(201);

    const oneLink = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ ...base, title: 'One Link Assignment', links: [{ title: 'Sheet', url: 'https://drive.google.com/1' }] });
    expect(oneLink.status).toBe(201);

    const threeLinks = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        ...base,
        title: 'Three Links Assignment',
        links: [
          { title: 'L1', url: 'https://drive.google.com/1' },
          { title: 'L2', url: 'https://docs.google.com/2' },
          { title: 'L3', url: 'https://youtube.com/watch?v=abc' },
        ],
      });
    expect(threeLinks.status).toBe(201);

    const badDates = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        ...base,
        title: 'Bad Dates',
        startDate: new Date(now + 5 * 86400000).toISOString(),
        links: [],
      });
    expect(badDates.status).toBe(400);

    const badUrl = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        ...base,
        title: 'Bad URL',
        links: [{ title: 'Bad', url: 'ftp://invalid.example.com' }],
      });
    expect(badUrl.status).toBe(400);

    const wrongClass = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${otherFacultyToken}`)
      .send({ ...base, title: 'Unauthorized', links: [] });
    expect(wrongClass.status).toBe(403);
  }, 15000);

  it('C2. Profile Updates: Student safe fields & Faculty full profile with email uniqueness', async () => {
    const stUpd = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ phone: '9876543210' });
    expect(stUpd.status).toBe(200);

    const facUpd = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        name: `Dr. Advisor ${runId}`,
        email: `fac_${runId}@velan.test`,
        qualification: 'Ph.D.',
        bio: 'AI Researcher',
      });
    expect(facUpd.status).toBe(200);
    expect(facUpd.body.user.facultyProfile.qualification).toBe('Ph.D.');

    // Duplicate email rejected with 409
    const dupEmail = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${otherFacultyToken}`)
      .send({ email: `fac_${runId}@velan.test` });
    expect(dupEmail.status).toBe(409);
  });

  it('Academics & Skip APIs: consent check, GPA save, advisor/student/admin permissions & audit log', async () => {
    const skipRes = await request(app)
      .get('/api/skip/overview')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.overall).toBeDefined();

    // First save without consent -> 400
    const noConsent = await request(app)
      .post('/api/academics-records/my/semester')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        semesterNumber: 4,
        regulation: '2021',
        consentGiven: false,
        subjects: [{ subjectCode: '21AI41T', subjectName: 'DATA ENGINEERING', credits: 3, grade: 'A+' }],
      });
    expect(noConsent.status).toBe(400);

    // Save with consent -> 200
    const withConsent = await request(app)
      .post('/api/academics-records/my/semester')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        semesterNumber: 4,
        regulation: '2021',
        consentGiven: true,
        subjects: [
          { subjectCode: '21AI41T', subjectName: 'DATA ENGINEERING', credits: 3, grade: 'A+' },
          { subjectCode: '21MC02T', subjectName: 'ENVIRONMENTAL SCIENCES', credits: 0, grade: 'A' },
        ],
      });
    expect(withConsent.status).toBe(200);
    expect(withConsent.body.semester.gpa).toBe(9);

    // Advisor can read advisees; non-advisor gets 403
    const advRes = await request(app)
      .get('/api/academics-records/advisees')
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(advRes.status).toBe(200);
    expect(advRes.body.students.some((s: any) => s.studentId === student1Id)).toBe(true);

    const nonAdvRes = await request(app)
      .get('/api/academics-records/advisees')
      .set('Authorization', `Bearer ${otherFacultyToken}`);
    expect(nonAdvRes.status).toBe(403);

    // Student2 cannot view Student1 academic detail (403)
    const crossStudent = await request(app)
      .get(`/api/academics-records/student/${student1Id}`)
      .set('Authorization', `Bearer ${student2Token}`);
    expect(crossStudent.status).toBe(403);

    // Admin edits Student1 record -> editedByAdmin = true + AuditLog
    const adminEdit = await request(app)
      .post(`/api/academics-records/student/${student1Id}/semester`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        semesterNumber: 4,
        regulation: '2021',
        subjects: [{ subjectCode: '21AI41T', subjectName: 'DATA ENGINEERING', credits: 3, grade: 'O' }],
      });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.semester.editedByAdmin).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ACADEMIC_RECORD_EDITED', details: { contains: student1Id } },
    });
    expect(audit).not.toBeNull();
  }, 20000);
});
