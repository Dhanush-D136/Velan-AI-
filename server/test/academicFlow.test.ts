import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('End-to-End Academic Creation & Authentication Flow', () => {
  let adminToken: string;
  let departmentId: string;
  let academicYearId: string;
  let classId: string;
  let facultyId: string;
  let studentId: string;
  let facultyTempPwd = '';
  let studentTempPwd = '';

  const runId = Math.floor(1000 + Math.random() * 9000);
  const deptCode = `CS${runId}`;
  const rollNo = `24C${runId}`;
  const regNo = `71002410${runId}`;
  const empId = `FAC${runId}`;

  beforeAll(async () => {
    // 1. Admin login with username "Vel"
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'Vel',
        password: process.env.ADMIN_PASSWORD || 'elite minds',
        deviceId: 'dev_e2e_runner',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.role).toBe('ADMIN');
    adminToken = loginRes.body.token;
  });

  it('1. Admin creates a new Department', async () => {
    const res = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: deptCode,
        name: `Computer Science ${runId}`,
        hodName: 'Dr. Ramesh Kumar',
      });

    expect(res.status).toBe(201);
    expect(res.body.department).toBeDefined();
    expect(res.body.department.code).toBe(deptCode);
    departmentId = res.body.department.id;
  });

  it('2. Admin creates an Academic Year inside the Department', async () => {
    const res = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId,
        year: 2,
        batch: `2024–2028-${runId}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.academicYear).toBeDefined();
    academicYearId = res.body.academicYear.id;
  });

  it('3. Admin creates a Section / Class inside the Year', async () => {
    const res = await request(app)
      .post('/api/academics/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        academicYearId,
        section: 'A',
        roomNumber: 'Hall 301',
      });

    expect(res.status).toBe(201);
    expect(res.body.class).toBeDefined();
    classId = res.body.class.id;
  });

  it('4. Admin registers a new Faculty member (one-time temp password)', async () => {
    const res = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Dr. Ramesh ${runId}`,
        employeeId: empId,
        departmentId,
        designation: 'Professor & HOD',
        email: `ramesh_${runId}@velan.ai`,
      });

    expect(res.status).toBe(201);
    expect(res.body.faculty).toBeDefined();
    expect(res.body.faculty.employeeId).toBe(empId);
    expect(res.body.tempPassword).toBeUndefined();
    facultyTempPwd = '1234';
    facultyId = res.body.faculty.id;
  });

  it('5. Admin registers a Student inside the Class (one-time temp password)', async () => {
    const res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Student ${runId}`,
        registerNo: regNo,
        rollNo: rollNo,
        classId,
      });

    expect(res.status).toBe(201);
    expect(res.body.student).toBeDefined();
    expect(res.body.student.registerNo).toBe(regNo);
    expect(res.body.tempPassword).toBeUndefined();
    studentTempPwd = '1234';
    studentId = res.body.student.id;
  });

  it('6. Verifies all created entities appear in the live lists', async () => {
    // Check hierarchy
    const hierRes = await request(app)
      .get('/api/academics/hierarchy')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(hierRes.status).toBe(200);
    const dept = hierRes.body.departments.find((d: any) => d.code === deptCode);
    expect(dept).toBeDefined();
    expect(dept.academicYears.length).toBeGreaterThan(0);

    // Check faculty
    const facRes = await request(app)
      .get('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(facRes.status).toBe(200);
    const fac = facRes.body.faculty.find((f: any) => f.employeeId === empId);
    expect(fac).toBeDefined();

    // Check students
    const studRes = await request(app)
      .get(`/api/academics/students?classId=${classId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(studRes.status).toBe(200);
    const stud = studRes.body.students.find((s: any) => s.registerNo === regNo);
    expect(stud).toBeDefined();
  });

  it('7. Student can authenticate with Register Number and temp password', async () => {
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: regNo,
        password: studentTempPwd,
        deviceId: `dev_student_phone_${runId}`,
      });

    expect(studentLogin.status).toBe(200);
    expect(studentLogin.body.user.role).toBe('STUDENT');
    expect(studentLogin.body.mustChangePassword).toBe(true);
  });

  it('8. Faculty can authenticate with Employee ID and temp password', async () => {
    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: empId,
        password: facultyTempPwd,
        deviceId: 'dev_faculty_laptop',
      });

    expect(facultyLogin.status).toBe(200);
    expect(facultyLogin.body.user.role).toBe('FACULTY');
    expect(facultyLogin.body.mustChangePassword).toBe(true);
  });
});
