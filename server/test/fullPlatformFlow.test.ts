import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Full Production Platform End-to-End Flow', () => {
  let adminToken = '';
  let facultyToken = '';
  let studentInToken = '';
  let studentOutToken = '';

  let deptId = '';
  let yearId = '';
  let classAId = '';
  let classBId = '';
  let subjectId = '';
  let facultyId = '';
  let studentInId = '';
  let studentOutId = '';
  let sessionId = '';
  let rotatingToken = '';

  const runId = Math.floor(10000 + Math.random() * 89999);
  const deptCode = `T${runId}`;
  const subjCode = `S${runId}`;
  const empId = `F${runId}`;
  const regIn = `R1_${runId}`;
  const regOut = `R2_${runId}`;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `admin_e2e_${runId}`,
    });
    expect(res.status).toBe(200);
    adminToken = res.body.token;
  });

  afterAll(async () => {
    // Clean up only records created by this test run
    if (classAId) await prisma.class.delete({ where: { id: classAId } }).catch(() => {});
    if (classBId) await prisma.class.delete({ where: { id: classBId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
    if (facultyId) {
      const f = await prisma.facultyProfile.findUnique({ where: { id: facultyId } });
      if (f) await prisma.user.delete({ where: { id: f.userId } }).catch(() => {});
    }
    if (studentInId) {
      const s1 = await prisma.studentProfile.findUnique({ where: { id: studentInId } });
      if (s1) await prisma.user.delete({ where: { id: s1.userId } }).catch(() => {});
    }
    if (studentOutId) {
      const s2 = await prisma.studentProfile.findUnique({ where: { id: studentOutId } });
      if (s2) await prisma.user.delete({ where: { id: s2.userId } }).catch(() => {});
    }
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Admin creates Dept -> Year -> Classes A & B -> Subject -> Faculty -> 2 Students', async () => {
    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: deptCode, name: `Test Dept ${runId}` });
    expect(dRes.status).toBe(201);
    deptId = dRes.body.department.id;

    // Verify GET /api/academics/departments works
    const dList = await request(app)
      .get('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dList.status).toBe(200);
    expect(dList.body.departments.some((d: any) => d.id === deptId)).toBe(true);

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 1, batch: `2026-2030-${runId}` });
    expect(yRes.status).toBe(201);
    yearId = yRes.body.academicYear.id;

    const cARes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'R101' });
    expect(cARes.status).toBe(201);
    classAId = cARes.body.class.id;

    const cBRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'B', roomNumber: 'R102' });
    expect(cBRes.status).toBe(201);
    classBId = cBRes.body.class.id;

    // Verify GET /api/academics/classes works
    const cList = await request(app)
      .get('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cList.status).toBe(200);
    expect(cList.body.classes.some((c: any) => c.id === classAId)).toBe(true);

    const sRes = await request(app)
      .post('/api/academics/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 1, code: subjCode, name: 'Algorithms', type: 'THEORY', credits: 4 });
    expect(sRes.status).toBe(201);
    subjectId = sRes.body.subject.id;

    const fRes = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Prof ${runId}`, employeeId: empId, departmentId: deptId, designation: 'Professor' });
    expect(fRes.status).toBe(201);
    facultyId = fRes.body.faculty.id;

    const st1 = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Student Inside', registerNo: regIn, rollNo: '01', classId: classAId });
    expect(st1.status).toBe(201);
    studentInId = st1.body.student.id;

    const st2 = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Student Outside', registerNo: regOut, rollNo: '02', classId: classAId });
    expect(st2.status).toBe(201);
    studentOutId = st2.body.student.id;
  }, 25000);

  it('2. Admin builds timetable and clash is blocked with 409', async () => {
    const slot1 = await request(app)
      .post('/api/timetable/slot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId: classAId,
        subjectId,
        facultyId,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:50',
        roomNumber: 'R101',
      });
    expect(slot1.status).toBe(200);

    // Same faculty, same day+period in Class B must be rejected
    const clashSlot = await request(app)
      .post('/api/timetable/slot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId: classBId,
        subjectId,
        facultyId,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:50',
        roomNumber: 'R102',
      });
    expect(clashSlot.status).toBe(409);
  });

  it('3. Student cannot edit timetable (403) and Faculty/Students log in', async () => {
    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empId,
      password: '1234',
      deviceId: `fac_dev_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    facultyToken = fLogin.body.token;

    const s1Login = await request(app).post('/api/auth/login').send({
      identifier: regIn,
      password: '1234',
      deviceId: `st1_dev_${runId}`,
    });
    expect(s1Login.status).toBe(200);
    studentInToken = s1Login.body.token;

    const s2Login = await request(app).post('/api/auth/login').send({
      identifier: regOut,
      password: '1234',
      deviceId: `st2_dev_${runId}`,
    });
    expect(s2Login.status).toBe(200);
    studentOutToken = s2Login.body.token;

    const forbidden = await request(app)
      .post('/api/timetable/slot')
      .set('Authorization', `Bearer ${studentInToken}`)
      .send({
        classId: classAId,
        subjectId,
        facultyId,
        dayOfWeek: 'TUESDAY',
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:50',
        roomNumber: 'R101',
      });
    expect(forbidden.status).toBe(403);
  });

  it('4. Faculty starts GPS session, inside student succeeds, outside fails, double-tap blocked, close auto-absents', async () => {
    const startRes = await request(app)
      .post('/api/attendance/start')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: classAId,
        subjectId,
        anchorLat: 13.0827,
        anchorLng: 80.2707,
        radiusMeters: 200,
        durationMinutes: 10,
      });
    expect(startRes.status).toBe(200);
    sessionId = startRes.body.session.id;
    rotatingToken = startRes.body.session.rotatingToken;

    // Student inside radius (~10m away) -> 200 PRESENT
    const markIn = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${studentInToken}`)
      .send({
        sessionId,
        rotatingToken,
        latitude: 13.08275,
        longitude: 80.27075,
        accuracy: 10,
        timestamp: Date.now(),
        deviceId: `st1_dev_${runId}`,
      });
    expect(markIn.status).toBe(200);

    // Second tap blocked -> 409
    const doubleTap = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${studentInToken}`)
      .send({
        sessionId,
        rotatingToken,
        latitude: 13.08275,
        longitude: 80.27075,
        accuracy: 10,
        timestamp: Date.now(),
        deviceId: `st1_dev_${runId}`,
      });
    expect(doubleTap.status).toBe(409);

    // Student outside radius (~1.5km away) -> 400 rejected
    const markOut = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${studentOutToken}`)
      .send({
        sessionId,
        rotatingToken,
        latitude: 13.095,
        longitude: 80.28,
        accuracy: 10,
        timestamp: Date.now(),
        deviceId: `st2_dev_${runId}`,
      });
    expect(markOut.status).toBe(400);

    // Close session -> unmarked student auto-marked ABSENT
    const closeRes = await request(app)
      .post(`/api/attendance/session/${sessionId}/close`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(closeRes.status).toBe(200);

    const boardRes = await request(app)
      .get(`/api/attendance/session/${sessionId}/live`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.session.presentCount).toBe(1);
    expect(boardRes.body.session.absentCount).toBe(1);

    // Admin overview & Excel export work
    const dashRes = await request(app)
      .get('/api/admin/dashboard-stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);

    const exportRes = await request(app)
      .get(`/api/export/monthly-register?classId=${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(exportRes.status).toBe(200);

    // Saved sessions history + post-close CRUD edit + session Excel export
    const histRes = await request(app)
      .get(`/api/attendance/sessions?classId=${classAId}`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.sessions.some((s: any) => s.id === sessionId)).toBe(true);

    const editPast = await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        sessionId,
        records: [{ studentId: studentOutId, status: 'PRESENT', remarks: 'Late arrival verified' }],
      });
    expect(editPast.status).toBe(200);

    const updatedBoard = await request(app)
      .get(`/api/attendance/session/${sessionId}/live`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(updatedBoard.body.session.presentCount).toBe(2);
    expect(updatedBoard.body.session.absentCount).toBe(0);

    const sessExport = await request(app)
      .get(`/api/export/session/${sessionId}`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(sessExport.status).toBe(200);
  }, 30000);
});
