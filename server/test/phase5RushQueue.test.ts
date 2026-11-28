import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';
import { rushQueueService } from '../src/services/rushQueueService';

describe('Phase 5: Rush-Hour Check-In Queue & Batched Saver', () => {
  let adminToken = '';
  let facultyToken = '';
  let student1Token = '';
  let student2Token = '';

  let deptId = '';
  let yearId = '';
  let classId = '';
  let subjectId = '';
  let facultyId = '';
  let facultyUserId = '';
  let student1Id = '';
  let student1UserId = '';
  let student2Id = '';
  let student2UserId = '';

  const runId = Math.floor(10000 + Math.random() * 89999);
  const empId = `P5F_${runId}`;
  const reg1 = `P5R1_${runId}`;
  const reg2 = `P5R2_${runId}`;

  beforeAll(async () => {
    await rushQueueService.updateConfig({ enabled: false, triggerThreshold: 30 }, undefined).catch(() => {});
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `admin_p5_${runId}`,
    });
    adminToken = res.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `P5D${runId}`, name: `Phase 5 Dept ${runId}` });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, batch: `2024-2028-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'R501' });
    classId = cRes.body.class.id;

    const sRes = await request(app)
      .post('/api/academics/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, code: `P5S${runId}`, name: 'Distributed Systems', type: 'THEORY', credits: 4 });
    subjectId = sRes.body.subject.id;

    const fRes = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Prof P5 ${runId}`, employeeId: empId, departmentId: deptId });
    facultyId = fRes.body.faculty.id;
    facultyUserId = fRes.body.faculty.userId;

    await request(app)
      .post('/api/academics/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classId, subjectId, facultyId });

    const st1Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P5 Student1 ${runId}`, rollNo: `P5RO1_${runId}`, registerNo: reg1, classId });
    student1Id = st1Res.body.student.id;
    student1UserId = st1Res.body.student.userId;

    const st2Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P5 Student2 ${runId}`, rollNo: `P5RO2_${runId}`, registerNo: reg2, classId });
    student2Id = st2Res.body.student.id;
    student2UserId = st2Res.body.student.userId;

    const fLogin = await request(app).post('/api/auth/login').send({ identifier: empId, password: fRes.body.tempPassword, deviceId: `f5_${runId}` });
    const fPwd = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${fLogin.body.token}`).send({ currentPassword: fRes.body.tempPassword, newPassword: 'VelanTest#2026' });
    facultyToken = fPwd.body.token;

    const s1Login = await request(app).post('/api/auth/login').send({ identifier: reg1, password: st1Res.body.tempPassword, deviceId: `s1_${runId}` });
    const s1Pwd = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${s1Login.body.token}`).send({ currentPassword: st1Res.body.tempPassword, newPassword: 'VelanTest#2026' });
    student1Token = s1Pwd.body.token;

    const s2Login = await request(app).post('/api/auth/login').send({ identifier: reg2, password: st2Res.body.tempPassword, deviceId: `s2_${runId}` });
    const s2Pwd = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${s2Login.body.token}`).send({ currentPassword: st2Res.body.tempPassword, newPassword: 'VelanTest#2026' });
    student2Token = s2Pwd.body.token;
  }, 25000);

  afterAll(async () => {
    await rushQueueService.updateConfig({ enabled: false, triggerThreshold: 30 }, undefined).catch(() => {});
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
    if (facultyUserId) await prisma.user.delete({ where: { id: facultyUserId } }).catch(() => {});
    if (student1UserId) await prisma.user.delete({ where: { id: student1UserId } }).catch(() => {});
    if (student2UserId) await prisma.user.delete({ where: { id: student2UserId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Default OFF: saves immediately; Admin toggle writes AuditLog', async () => {
    const cfgRes = await request(app)
      .get('/api/admin/rush-queue/config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body.config.enabled).toBe(false);

    const startRes = await request(app)
      .post('/api/attendance/start')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ classId, subjectId, anchorLat: 13.0827, anchorLng: 80.2707, radiusMeters: 150, durationMinutes: 10 });
    const sessionId = startRes.body.session.id;

    const markRes = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        sessionId,
        rotatingToken: startRes.body.session.rotatingToken,
        latitude: 13.0827,
        longitude: 80.2707,
        accuracy: 10,
        timestamp: Date.now(),
        deviceId: `s1_${runId}`,
      });
    expect(markRes.status).toBe(200);
    expect(markRes.body.queued).toBeUndefined();

    // Toggle ON and verify AuditLog
    const tog = await request(app)
      .put('/api/admin/rush-queue/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, triggerThreshold: 1 });
    expect(tog.status).toBe(200);
    expect(tog.body.config.enabled).toBe(true);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'RUSH_QUEUE_TOGGLED' } });
    expect(audit).not.toBeNull();
  }, 15000);

  it('2. Queue ON: rejects out-of-range immediately, queues valid student, reuses ticket, drains before close', async () => {
    // Ensure threshold=1 and enabled=true so 2nd request queues
    await request(app)
      .put('/api/admin/rush-queue/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, triggerThreshold: 1, maxPerSecond: 20 });

    const startRes = await request(app)
      .post('/api/attendance/start')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ classId, subjectId, anchorLat: 13.0827, anchorLng: 80.2707, radiusMeters: 150, durationMinutes: 10 });
    const sessionId = startRes.body.session.id;

    // Out-of-range student2 rejected immediately (400) and never queued
    const farRes = await request(app)
      .post('/api/attendance/mark')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        sessionId,
        rotatingToken: startRes.body.session.rotatingToken,
        latitude: 13.095,
        longitude: 80.285,
        accuracy: 10,
        timestamp: Date.now(),
        deviceId: `s2_${runId}`,
      });
    expect(farRes.status).toBe(400);

    // Enqueue student1 via rushQueueService (simulating burst crossing threshold)
    const ticket1 = await rushQueueService.enqueueTicket({
      sessionId,
      studentId: student1Id,
      userId: student1UserId,
      studentName: `P5 Student1 ${runId}`,
      rollNo: `P5RO1_${runId}`,
      pressedAt: new Date(),
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      deviceId: `s1_${runId}`,
      distanceMeters: 5,
      flags: null,
    });
    expect(ticket1.state).toBe('queued');

    // Pressing twice reuses the same ticket
    const ticket1Again = await rushQueueService.enqueueTicket({
      sessionId,
      studentId: student1Id,
      userId: student1UserId,
      studentName: `P5 Student1 ${runId}`,
      rollNo: `P5RO1_${runId}`,
      pressedAt: new Date(),
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      deviceId: `s1_${runId}`,
      distanceMeters: 5,
      flags: null,
    });
    expect(ticket1Again.ticketId).toBe(ticket1.ticketId);
    expect(ticket1Again.reused).toBe(true);

    // Polling fallback works
    const pollRes = await request(app)
      .get(`/api/checkin/ticket/${ticket1.ticketId}`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(pollRes.status).toBe(200);

    // Close session drains queue first -> student1 is PRESENT, student2 is ABSENT
    const closeRes = await request(app)
      .post(`/api/attendance/session/${sessionId}/close`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(closeRes.status).toBe(200);

    const recs = await prisma.attendanceRecord.findMany({ where: { sessionId } });
    const s1Rec = recs.find((r) => r.studentId === student1Id);
    const s2Rec = recs.find((r) => r.studentId === student2Id);
    expect(s1Rec?.status).toBe('PRESENT');
    expect(s2Rec?.status).toBe('ABSENT');
  }, 15000);
});
