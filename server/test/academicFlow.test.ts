import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

const cleanupTestEntities = async () => {
  try {
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: '710024104001@student.local' },
          { email: 'ramesh@velan.ai' },
        ],
      },
    });
    for (const u of testUsers) {
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.studentProfile.deleteMany({ where: { registerNo: '710024104001' } }).catch(() => {});
    await prisma.facultyProfile.deleteMany({ where: { employeeId: 'FAC001' } }).catch(() => {});
    await prisma.class.deleteMany({ where: { name: { contains: 'CSE' } } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { batch: '2024–2028' } }).catch(() => {});
    await prisma.department.deleteMany({ where: { code: 'CSE' } }).catch(() => {});
  } catch (e) {
    // quiet cleanup
  }
};

describe('End-to-End Academic Creation & Authentication Flow', () => {
  let adminToken: string;
  let departmentId: string;
  let academicYearId: string;
  let classId: string;
  let facultyId: string;
  let studentId: string;

  beforeAll(async () => {
    // Clean up any stale records from prior runs
    await cleanupTestEntities();

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

  afterAll(async () => {
    await cleanupTestEntities();
  });

  it('1. Admin creates a new Department', async () => {
    const res = await request(app)
      .post('/api/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'CSE',
        name: 'Computer Science and Engineering',
        hodName: 'Dr. Ramesh Kumar',
      });

    expect(res.status).toBe(201);
    expect(res.body.department).toBeDefined();
    expect(res.body.department.code).toBe('CSE');
    departmentId = res.body.department.id;
  });

  it('2. Admin creates an Academic Year inside the Department', async () => {
    const res = await request(app)
      .post('/api/academics/years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId,
        year: 2,
        batch: '2024–2028',
      });

    expect(res.status).toBe(201);
    expect(res.body.academicYear).toBeDefined();
    expect(res.body.academicYear.batch).toBe('2024–2028');
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
    expect(res.body.class.name).toContain('CSE – Year 2 – A');
    classId = res.body.class.id;
  });

  it('4. Admin registers a new Faculty member (default password 1234)', async () => {
    const res = await request(app)
      .post('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. Ramesh Kumar',
        employeeId: 'FAC001',
        departmentId,
        designation: 'Professor & HOD',
        email: 'ramesh@velan.ai',
      });

    expect(res.status).toBe(201);
    expect(res.body.faculty).toBeDefined();
    expect(res.body.faculty.employeeId).toBe('FAC001');
    facultyId = res.body.faculty.id;
  });

  it('5. Admin registers a Student inside the Class (default password 1234)', async () => {
    const res = await request(app)
      .post('/api/academics/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Arunachalam V',
        registerNo: '710024104001',
        rollNo: '24CS001',
        classId,
      });

    expect(res.status).toBe(201);
    expect(res.body.student).toBeDefined();
    expect(res.body.student.registerNo).toBe('710024104001');
    studentId = res.body.student.id;
  });

  it('6. Verifies all created entities appear in the live lists', async () => {
    // Check hierarchy
    const hierRes = await request(app)
      .get('/api/academics/hierarchy')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(hierRes.status).toBe(200);
    const cseDept = hierRes.body.departments.find((d: any) => d.code === 'CSE');
    expect(cseDept).toBeDefined();
    expect(cseDept.academicYears.length).toBeGreaterThan(0);

    // Check faculty
    const facRes = await request(app)
      .get('/api/academics/faculty')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(facRes.status).toBe(200);
    const fac = facRes.body.faculty.find((f: any) => f.employeeId === 'FAC001');
    expect(fac).toBeDefined();

    // Check students
    const studRes = await request(app)
      .get(`/api/academics/students?classId=${classId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(studRes.status).toBe(200);
    const stud = studRes.body.students.find((s: any) => s.registerNo === '710024104001');
    expect(stud).toBeDefined();
  });

  it('7. Student can authenticate with Register Number and default password 1234', async () => {
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: '710024104001',
        password: '1234',
        deviceId: 'dev_student_phone_1',
      });

    expect(studentLogin.status).toBe(200);
    expect(studentLogin.body.user.role).toBe('STUDENT');
    expect(studentLogin.body.mustChangePassword).toBe(true);
  });

  it('8. Faculty can authenticate with Employee ID and default password 1234', async () => {
    const facultyLogin = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'FAC001',
        password: '1234',
        deviceId: 'dev_faculty_laptop',
      });

    expect(facultyLogin.status).toBe(200);
    expect(facultyLogin.body.user.role).toBe('FACULTY');
    expect(facultyLogin.body.mustChangePassword).toBe(true);
  });
});
