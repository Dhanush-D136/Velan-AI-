import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 2 Features End-to-End Flow', () => {
  let adminToken = '';
  let facultyToken = '';
  let student1Token = '';
  let student2Token = '';

  let deptId = '';
  let yearId = '';
  let classAId = '';
  let classBId = '';
  let subjectId = '';
  let facultyId = '';
  let facultyUserId = '';
  let student1Id = '';
  let student1UserId = '';
  let student2Id = '';
  let student2UserId = '';
  let slotId = '';

  const runId = Math.floor(10000 + Math.random() * 89999);
  const deptCode = `P2D${runId}`;
  const subjCode = `P2S${runId}`;
  const empId = `P2F${runId}`;
  const reg1 = `P2R1_${runId}`;
  const reg2 = `P2R2_${runId}`;

  const todayDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDay = todayDays[new Date().getDay()];

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `admin_p2_${runId}`,
    });
    expect(res.status).toBe(200);
    adminToken = res.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: deptCode, name: `Phase 2 Dept ${runId}` });
    expect(dRes.status).toBe(201);
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, batch: `2025-2029-${runId}` });
    expect(yRes.status).toBe(201);
    yearId = yRes.body.academicYear.id;

    const cARes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'R-201' });
    expect(cARes.status).toBe(201);
    classAId = cARes.body.class.id;

    const cBRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'B', roomNumber: 'R-202' });
    expect(cBRes.status).toBe(201);
    classBId = cBRes.body.class.id;

    const sRes = await request(app)
      .post('/api/academics/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, code: subjCode, name: 'Phase 2 AI', type: 'THEORY', credits: 4 });
    expect(sRes.status).toBe(201);
    subjectId = sRes.body.subject.id;

    const fRes = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Prof Phase2 ${runId}`, employeeId: empId, departmentId: deptId });
    expect(fRes.status).toBe(201);
    facultyId = fRes.body.faculty.id;
    facultyUserId = fRes.body.faculty.userId;

    const fLogin = await request(app).post('/api/auth/login').send({
      identifier: empId,
      password: '1234',
      deviceId: `fac_p2_${runId}`,
    });
    expect(fLogin.status).toBe(200);
    facultyToken = fLogin.body.token;

    const st1Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Student One ${runId}`, rollNo: `RO1_${runId}`, registerNo: reg1, classId: classAId });
    expect(st1Res.status).toBe(201);
    student1Id = st1Res.body.student.id;
    student1UserId = st1Res.body.student.userId;

    const st2Res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Student Two ${runId}`, rollNo: `RO2_${runId}`, registerNo: reg2, classId: classBId });
    expect(st2Res.status).toBe(201);
    student2Id = st2Res.body.student.id;
    student2UserId = st2Res.body.student.userId;

    const st2Login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ identifier: reg2, password: '1234', deviceId: `st2_pc_${runId}` });
    expect(st2Login.status).toBe(200);
    student2Token = st2Login.body.token;

    // Assign timetable slot for today in Class A
    const ttRes = await request(app)
      .post('/api/timetable/slot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classId: classAId,
        subjectId,
        facultyId,
        dayOfWeek: todayDay,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:50',
        roomNumber: 'R-201',
        isLabBlock: false,
      });
    expect(ttRes.status).toBe(200);
    slotId = ttRes.body.slot.id;
  });

  afterAll(async () => {
    if (classAId) await prisma.class.delete({ where: { id: classAId } }).catch(() => {});
    if (classBId) await prisma.class.delete({ where: { id: classBId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
    if (facultyUserId) await prisma.user.delete({ where: { id: facultyUserId } }).catch(() => {});
    if (student1UserId) await prisma.user.delete({ where: { id: student1UserId } }).catch(() => {});
    if (student2UserId) await prisma.user.delete({ where: { id: student2UserId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. 2-Device Limit: allows 1 Phone + 1 Computer, blocks 3rd, and allows after Admin revoke', async () => {
    const phoneLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile')
      .send({ identifier: reg1, password: '1234', deviceId: `st1_phone_${runId}` });
    expect(phoneLogin.status).toBe(200);
    student1Token = phoneLogin.body.token;

    const pcLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .send({ identifier: reg1, password: '1234', deviceId: `st1_pc_${runId}` });
    expect(pcLogin.status).toBe(200);

    const thirdLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')
      .send({ identifier: reg1, password: '1234', deviceId: `st1_phone2_${runId}` });
    expect(thirdLogin.status).toBe(403);
    expect(thirdLogin.body.error).toContain('already registered on 2 devices');

    const devList = await request(app)
      .get(`/api/academics/students/${student1Id}/devices`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(devList.status).toBe(200);
    expect(devList.body.devices.length).toBe(2);

    const phoneDev = devList.body.devices.find((d: any) => d.deviceType === 'PHONE');
    const revokeRes = await request(app)
      .delete(`/api/academics/students/${student1Id}/devices/${phoneDev.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revokeRes.status).toBe(200);

    const retryPhoneLogin = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')
      .send({ identifier: reg1, password: '1234', deviceId: `st1_phone2_${runId}` });
    expect(retryPhoneLogin.status).toBe(200);
  });

  it('2. Admin Edit Class assigns advisor and updates student overview', async () => {
    const editRes = await request(app)
      .put(`/api/academics/classes/${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ section: 'A', roomNumber: 'Lab-305', advisorId: facultyId });
    expect(editRes.status).toBe(200);
    expect((editRes.body.class || editRes.body.classSection).advisorId).toBe(facultyId);

    const stOv = await request(app)
      .get('/api/attendance/student-overview')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(stOv.status).toBe(200);
    expect(stOv.body.student.class.advisorName).toContain(`Prof Phase2 ${runId}`);
  });

  it('3. Attendance Start -> Notification -> Manual Mark All -> Close -> Day-wise % -> Delete Session + AuditLog', async () => {
    const startRes = await request(app)
      .post('/api/attendance/start')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: classAId,
        subjectId,
        anchorLat: 13.0827,
        anchorLng: 80.2707,
        radiusMeters: 50,
        durationMinutes: 10,
        periodNumber: 1,
      });
    expect(startRes.status).toBe(200);
    const sessionId = startRes.body.session.id;

    // Student1 received a notification
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    // Mark All Present manually while open
    const manualRes = await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        sessionId,
        records: [{ studentId: student1Id, status: 'PRESENT' }],
      });
    expect(manualRes.status).toBe(200);

    // Before closing, closed-session dayWiseAttendance is still 0
    const openOv = await request(app)
      .get('/api/attendance/student-overview')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(openOv.body.stats.totalSessions).toBe(0);

    // Close session
    const closeRes = await request(app)
      .post(`/api/attendance/session/${sessionId}/close`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(closeRes.status).toBe(200);

    // After closing, student overview computes overall & day-wise %
    const closedOv = await request(app)
      .get('/api/attendance/student-overview')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(closedOv.body.stats.totalSessions).toBe(1);
    expect(closedOv.body.stats.overallPercent).toBe(100);
    expect(closedOv.body.dayWiseAttendance.length).toBe(1);
    expect(closedOv.body.dayWiseAttendance[0].percent).toBe(100);

    // Faculty Today's classes shows studentCount and COMPLETED state
    const facOv = await request(app)
      .get('/api/attendance/faculty-overview')
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(facOv.status).toBe(200);
    expect(facOv.body.todaysSlots.length).toBeGreaterThanOrEqual(1);
    expect(facOv.body.todaysSlots[0].studentCount).toBe(1);
    expect(facOv.body.todaysSlots[0].state).toBe('COMPLETED');

    // Delete session & verify AuditLog
    const delRes = await request(app)
      .delete(`/api/attendance/session/${sessionId}`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(delRes.status).toBe(200);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SESSION_DELETED', details: { contains: sessionId } },
    });
    expect(audit).not.toBeNull();
  }, 15000);

  it('4. Assignments & Materials validation, class scoping, and admin moderation', async () => {
    const now = Date.now();
    const badAssign = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'Invalid Dates',
        description: 'Test',
        startDate: new Date(now + 86400000).toISOString(),
        dueDate: new Date(now).toISOString(),
        links: [{ title: 'Drive', url: 'https://drive.google.com/file/d/123' }],
      });
    expect(badAssign.status).toBe(400);

    const goodAssign = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'Phase 2 Assignment',
        description: 'Solve all',
        startDate: new Date(now - 3600000).toISOString(),
        dueDate: new Date(now + 86400000).toISOString(),
        submissionDate: new Date(now + 2 * 86400000).toISOString(),
        links: [{ title: 'Drive', url: 'https://drive.google.com/file/d/123' }],
      });
    expect(goodAssign.status).toBe(201);

    const st1Assign = await request(app)
      .get('/api/assignments')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(st1Assign.body.assignments.some((a: any) => a.title === 'Phase 2 Assignment')).toBe(true);

    const st2Assign = await request(app)
      .get('/api/assignments')
      .set('Authorization', `Bearer ${student2Token}`);
    expect(st2Assign.body.assignments.some((a: any) => a.title === 'Phase 2 Assignment')).toBe(false);

    const matRes = await request(app)
      .post('/api/materials')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        classId: classAId,
        subjectId,
        title: 'Unit 1 Notes',
        type: 'notes',
        links: [{ title: 'PDF', url: 'https://drive.google.com/file/d/abc' }],
      });
    expect(matRes.status).toBe(201);

    const st1Mat = await request(app)
      .get('/api/materials?type=notes')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(st1Mat.body.materials.some((m: any) => m.title === 'Unit 1 Notes')).toBe(true);

    const delMat = await request(app)
      .delete(`/api/materials/${matRes.body.material.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delMat.status).toBe(200);
  });

  it('5. Student Request to Admin & Reply + Chat Auto-Join & Live Revoke', async () => {
    const reqCreate = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ type: 'PROFILE_CORRECTION', subject: 'Name spelling', message: 'Please update initial' });
    expect(reqCreate.status).toBe(201);

    const reqReply = await request(app)
      .post(`/api/requests/${reqCreate.body.request.id}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED', adminReply: 'Updated in records' });
    expect(reqReply.status).toBe(200);

    const myReqs = await request(app)
      .get('/api/requests/my')
      .set('Authorization', `Bearer ${student1Token}`);
    expect(myReqs.body.requests[0].adminReply).toBe('Updated in records');

    // Chat Auto-Join
    const roomsRes = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(roomsRes.status).toBe(200);
    expect(roomsRes.body.rooms.some((r: any) => r.classId === classAId)).toBe(true);

    const postMsg = await request(app)
      .post('/api/chat/message')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ classId: classAId, content: 'Exam tomorrow', type: 'TEXT', isPinned: true });
    expect(postMsg.status).toBe(200);
    expect(postMsg.body.message.isPinned).toBe(true);

    // Cross-class Student2 is blocked from Class A chat
    const st2Chat = await request(app)
      .get(`/api/chat/room/${classAId}`)
      .set('Authorization', `Bearer ${student2Token}`);
    expect(st2Chat.status).toBe(403);

    // Removing timetable slot & advisor revokes faculty chat access live
    await request(app)
      .delete(`/api/timetable/slot/${slotId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .put(`/api/academics/classes/${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ section: 'A', roomNumber: 'Lab-305', advisorId: null });

    const facAfterRevoke = await request(app)
      .get(`/api/chat/room/${classAId}`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(facAfterRevoke.status).toBe(403);
  }, 15000);
});
