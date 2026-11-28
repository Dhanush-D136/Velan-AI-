import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

describe('Phase 11: Students Directory — Numeric Register Sorting, Bulk Selection & Safe Bulk Delete', () => {
  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `P11D${runId}`;
  const prefix = `1130${runId}`; // 8 digits + 3 digits = 11-digit numeric register numbers

  let adminToken = '';
  let studentToken = '';
  let deptId = '';
  let yearId = '';
  let classAId = '';
  let classBId = '';

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'Vel',
      password: process.env.ADMIN_PASSWORD || 'elite minds',
      expectedRole: 'ADMIN',
      deviceId: `p11_admin_${runId}`,
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;

    const dRes = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Phase 11 Dept ${runId}`, code: deptCode });
    deptId = dRes.body.department.id;

    const yRes = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: deptId, year: 3, batch: `2024-2028-P11-${runId}` });
    yearId = yRes.body.academicYear.id;

    const cARes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'A', roomNumber: 'P11-101' });
    classAId = cARes.body.class.id;

    const cBRes = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYearId: yearId, section: 'B', roomNumber: 'P11-102' });
    classBId = cBRes.body.class.id;

    // Bulk-create 61 students: 001..059 + lateral 301 & 303 (intentionally out of name order)
    const rows: any[] = [];
    for (let i = 59; i >= 1; i--) {
      const suf = String(i).padStart(3, '0');
      rows.push({
        rollNo: `VH${runId}${suf}`,
        registerNo: `${prefix}${suf}`,
        name: i === 1 ? `Zebra Student ${suf}` : `Student ${suf}`,
      });
    }
    rows.push({ rollNo: `VH${runId}303`, registerNo: `${prefix}303`, name: 'AAA Lateral 303' });
    rows.push({ rollNo: `VH${runId}301`, registerNo: `${prefix}301`, name: 'AAB Lateral 301' });

    const impRes = await request(app)
      .post('/api/academics/students/import-excel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classId: classAId, students: rows });
    expect(impRes.status).toBe(200);
    expect(impRes.body.successCount).toBe(61);

    // Log in as one student to test 403 enforcement
    const sLogin = await request(app).post('/api/auth/login').send({
      identifier: `${prefix}001`,
      password: '1234',
      expectedRole: 'STUDENT',
      deviceId: `p11_st_${runId}`,
    });
    const chg = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${sLogin.body.token}`)
      .send({ newPassword: 'ok', confirmPassword: 'ok' });
    studentToken = chg.body.token;
  }, 45000);

  afterAll(async () => {
    const remaining = await prisma.studentProfile.findMany({
      where: { classId: { in: [classAId, classBId].filter(Boolean) } },
      select: { userId: true },
    });
    if (remaining.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: remaining.map((r) => r.userId) } } }).catch(() => {});
    }
    if (classAId) await prisma.class.delete({ where: { id: classAId } }).catch(() => {});
    if (classBId) await prisma.class.delete({ where: { id: classBId } }).catch(() => {});
    if (yearId) await prisma.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    if (deptId) await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
  }, 30000);

  it('1. 61-student class lists in strict numeric register-number order (001..006 first, 301 & 303 last) & pagination/idsOnly work', async () => {
    const res = await request(app)
      .get(`/api/academics/students?classId=${classAId}&page=1&limit=50`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(61);
    expect(res.body.students.length).toBe(50);
    const firstSix = res.body.students.slice(0, 6).map((s: any) => s.registerNo);
    expect(firstSix).toEqual([
      `${prefix}001`,
      `${prefix}002`,
      `${prefix}003`,
      `${prefix}004`,
      `${prefix}005`,
      `${prefix}006`,
    ]);

    const page2 = await request(app)
      .get(`/api/academics/students?classId=${classAId}&page=2&limit=50`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.students.length).toBe(11);
    const lastTwo = page2.body.students.slice(-2).map((s: any) => s.registerNo);
    expect(lastTwo).toEqual([`${prefix}301`, `${prefix}303`]);

    const idsRes = await request(app)
      .get(`/api/academics/students?classId=${classAId}&idsOnly=true`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(idsRes.status).toBe(200);
    expect(idsRes.body.ids.length).toBe(61);
  }, 20000);

  it('2. Non-admin gets 403 on all bulk student endpoints', async () => {
    const endpoints = [
      '/api/academics/students/bulk-delete',
      '/api/academics/students/bulk-restore',
      '/api/academics/students/bulk-reset-passwords',
      '/api/academics/students/bulk-move-class',
      '/api/academics/students/bulk-export',
    ];
    for (const ep of endpoints) {
      const r = await request(app)
        .post(ep)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentIds: ['fake'] });
      expect(r.status).toBe(403);
    }
  });

  it('3. Bulk soft-delete of 61 students -> disappears from active list & login -> Recycle Bin restore brings all 61 back', async () => {
    const idsRes = await request(app)
      .get(`/api/academics/students?classId=${classAId}&idsOnly=true`)
      .set('Authorization', `Bearer ${adminToken}`);
    const allIds: string[] = idsRes.body.ids;
    expect(allIds.length).toBe(61);

    const t0 = Date.now();
    const delRes = await request(app)
      .post('/api/academics/students/bulk-delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: allIds });
    const elapsed = Date.now() - t0;
    expect(delRes.status).toBe(200);
    expect(delRes.body.deletedCount).toBe(61);
    expect(elapsed).toBeLessThan(10000);

    // Active list is now 0
    const activeAfter = await request(app)
      .get(`/api/academics/students?classId=${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(activeAfter.body.total).toBe(0);

    // Recycle Bin has 61
    const binRes = await request(app)
      .get(`/api/academics/students?classId=${classAId}&deleted=true`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(binRes.body.total).toBe(61);

    // Undo / Restore all 61
    const restoreRes = await request(app)
      .post('/api/academics/students/bulk-restore')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: allIds });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.restoredCount).toBe(61);

    const activeRestored = await request(app)
      .get(`/api/academics/students?classId=${classAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(activeRestored.body.total).toBe(61);
    expect(activeRestored.body.students[0].registerNo).toBe(`${prefix}001`);
  }, 30000);

  it('4. Bulk reset passwords, move-to-class & permanent delete work cleanly', async () => {
    const listRes = await request(app)
      .get(`/api/academics/students?classId=${classAId}&limit=3`)
      .set('Authorization', `Bearer ${adminToken}`);
    const threeIds = listRes.body.students.map((s: any) => s.id);

    const resetRes = await request(app)
      .post('/api/academics/students/bulk-reset-passwords')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: threeIds });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.resetCount).toBe(3);

    const moveRes = await request(app)
      .post('/api/academics/students/bulk-move-class')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: threeIds, targetClassId: classBId });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.movedCount).toBe(3);

    const permRes = await request(app)
      .post('/api/academics/students/bulk-delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: threeIds, permanent: true });
    expect(permRes.status).toBe(200);
    expect(permRes.body.purgedCount).toBe(3);
  }, 25000);
});
