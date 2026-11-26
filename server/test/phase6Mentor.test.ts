import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';
import { computeEvenDistribution } from '../src/controllers/mentorController';

describe('Phase 6: Mentor System, Permissions, Bulk & Auto-Distribution', () => {
  let adminToken = '';
  let advisorToken = '';
  let mentor2Token = '';
  let nonMentorToken = '';
  let student1Token = '';

  let deptId = '';
  let yearId = '';
  let classId = '';
  let advisorId = '';
  let advisorUserId = '';
  let mentor2Id = '';
  let mentor2UserId = '';
  let mentor3Id = '';
  let mentor3UserId = '';
  let nonMentorUserId = '';

  const studentIds: string[] = [];
  const studentUserIds: string[] = [];

  const runId = Math.floor(10000 + Math.random() * 89999);

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      deviceId: `admin_p6_${runId}`,
    });
    adminToken = res.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `P6D${runId}`, name: `Phase 6 Dept ${runId}` });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 2, batch: `2025-2029-${runId}` });
    yearId = yRes.body.academicYear.id;

    const f1 = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Advisor ${runId}`, employeeId: `P6F1_${runId}`, departmentId: deptId });
    advisorId = f1.body.faculty.id;
    advisorUserId = f1.body.faculty.userId;

    const f2 = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Mentor2 ${runId}`, employeeId: `P6F2_${runId}`, departmentId: deptId });
    mentor2Id = f2.body.faculty.id;
    mentor2UserId = f2.body.faculty.userId;

    const f3 = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Mentor3 ${runId}`, employeeId: `P6F3_${runId}`, departmentId: deptId });
    mentor3Id = f3.body.faculty.id;
    mentor3UserId = f3.body.faculty.userId;

    const f4 = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `NonMentor ${runId}`, employeeId: `P6F4_${runId}`, departmentId: deptId });
    nonMentorUserId = f4.body.faculty.userId;

    const cRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'R601', advisorId });
    classId = cRes.body.class.id;

    for (let i = 1; i <= 6; i++) {
      const sRes = await request(app)
        .post('/api/academics/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `P6 Student ${i}`,
          rollNo: `P6RO${i}_${runId}`,
          registerNo: `P6RG${i}_${runId}`,
          classId,
        });
      studentIds.push(sRes.body.student.id);
      studentUserIds.push(sRes.body.student.userId);
    }

    advisorToken = (await request(app).post('/api/auth/login').send({ identifier: `P6F1_${runId}`, password: '1234', deviceId: `d1_${runId}` })).body.token;
    mentor2Token = (await request(app).post('/api/auth/login').send({ identifier: `P6F2_${runId}`, password: '1234', deviceId: `d2_${runId}` })).body.token;
    nonMentorToken = (await request(app).post('/api/auth/login').send({ identifier: `P6F4_${runId}`, password: '1234', deviceId: `d4_${runId}` })).body.token;
    student1Token = (await request(app).post('/api/auth/login').send({ identifier: `P6RG1_${runId}`, password: '1234', deviceId: `s1_${runId}` })).body.token;
  }, 30000);

  afterAll(async () => {
    await prisma.menteeAssignment.deleteMany({ where: { classId } }).catch(() => {});
    if (classId) await prisma.class.delete({ where: { id: classId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    for (const uid of studentUserIds) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    for (const uid of [advisorUserId, mentor2UserId, mentor3UserId, nonMentorUserId]) {
      if (uid) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  });

  it('1. Auto-distribute math: 60 -> 20/20/20, 62 -> 21/21/20, 59 -> 20/20/19', () => {
    const m = ['m1', 'm2', 'm3'];
    const d60 = computeEvenDistribution(Array.from({ length: 60 }, (_, i) => `s${i}`), m);
    expect(d60.map((g) => g.studentIds.length)).toEqual([20, 20, 20]);

    const d62 = computeEvenDistribution(Array.from({ length: 62 }, (_, i) => `s${i}`), m);
    expect(d62.map((g) => g.studentIds.length)).toEqual([21, 21, 20]);

    const d59 = computeEvenDistribution(Array.from({ length: 59 }, (_, i) => `s${i}`), m);
    expect(d59.map((g) => g.studentIds.length)).toEqual([20, 20, 19]);
  });

  it('2. Admin sets 3 mentors, auto-distributes 6 students, and enforces strict access + reassignment', async () => {
    const setRes = await request(app)
      .put(`/api/admin/mentors/class/${classId}/mentors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ facultyIds: [advisorId, mentor2Id, mentor3Id] });
    expect(setRes.status).toBe(200);

    const distRes = await request(app)
      .post(`/api/admin/mentors/class/${classId}/auto-distribute`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commit: true });
    expect(distRes.status).toBe(200);

    const boardRes = await request(app)
      .get(`/api/admin/mentors/class/${classId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(boardRes.body.stats.isComplete).toBe(true);

    // Mentor2 sees ONLY their 2 mentees
    const m2Res = await request(app)
      .get(`/api/mentoring/mentees?classId=${classId}`)
      .set('Authorization', `Bearer ${mentor2Token}`);
    expect(m2Res.status).toBe(200);
    expect(m2Res.body.students.length).toBe(2);

    // Advisor sees all 6 students + mentorGroups
    const advRes = await request(app)
      .get(`/api/mentoring/mentees?classId=${classId}`)
      .set('Authorization', `Bearer ${advisorToken}`);
    expect(advRes.status).toBe(200);
    expect(advRes.body.students.length).toBe(6);
    expect(advRes.body.mentorGroups.length).toBe(3);

    // Non-mentor faculty gets 403
    const nonRes = await request(app)
      .get(`/api/mentoring/mentees?classId=${classId}`)
      .set('Authorization', `Bearer ${nonMentorToken}`);
    expect(nonRes.status).toBe(403);

    // Mentor2 cannot view student[0] (belongs to advisor) -> 403
    const forbiddenStudent = await request(app)
      .get(`/api/mentoring/student/${studentIds[0]}`)
      .set('Authorization', `Bearer ${mentor2Token}`);
    expect(forbiddenStudent.status).toBe(403);

    // Reassign student[0] to mentor2 -> mentor2 gains access live!
    await request(app)
      .post(`/api/admin/mentors/class/${classId}/bulk-assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [studentIds[0]], mentorId: mentor2Id });

    const allowedNow = await request(app)
      .get(`/api/mentoring/student/${studentIds[0]}`)
      .set('Authorization', `Bearer ${mentor2Token}`);
    expect(allowedNow.status).toBe(200);
  }, 20000);

  it('3. Mentor notes hidden from student, faculty delete blocked while having mentees, Excel import preview', async () => {
    const noteRes = await request(app)
      .post(`/api/mentoring/student/${studentIds[0]}/notes`)
      .set('Authorization', `Bearer ${mentor2Token}`)
      .send({ type: 'meeting', note: 'Discussed attendance plan' });
    expect(noteRes.status).toBe(201);

    // Student views own detail -> mentorNotes omitted; cannot create note (403)
    const stView = await request(app)
      .get(`/api/mentoring/student/${studentIds[0]}`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(stView.status).toBe(200);
    expect(stView.body.mentorNotes).toBeUndefined();

    const stPostNote = await request(app)
      .post(`/api/mentoring/student/${studentIds[0]}/notes`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ type: 'meeting', note: 'Hack' });
    expect(stPostNote.status).toBe(403);

    // Deleting mentor2 is blocked (409) while they still have mentees
    const delBlocked = await request(app)
      .delete(`/api/academics/faculty/${mentor2Id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delBlocked.status).toBe(409);

    // Excel import preview validates valid, invalid & duplicate
    const impPreview = await request(app)
      .post(`/api/admin/mentors/class/${classId}/import`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        commit: false,
        rows: [
          { registerNo: `P6RG1_${runId}`, mentorEmployeeId: `P6F3_${runId}` },
          { registerNo: `P6RG1_${runId}`, mentorEmployeeId: `P6F3_${runId}` }, // duplicate
          { registerNo: 'NONEXISTENT', mentorEmployeeId: `P6F3_${runId}` },
        ],
      });
    expect(impPreview.status).toBe(200);
    expect(impPreview.body.valid.length).toBe(1);
    expect(impPreview.body.invalid.length).toBe(2);
  }, 15000);
});
