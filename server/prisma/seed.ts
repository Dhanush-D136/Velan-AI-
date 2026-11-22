import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const INDIAN_NAMES = [
  'Arunachalam V', 'Bhavani S', 'Chandran M', 'Divya P', 'Eashwar K',
  'Gowtham N', 'Hariharan T', 'Janani R', 'Karthik Raja S', 'Lavanya M',
  'Manikandan K', 'Nandhini D', 'Pradeep Kumar G', 'Pooja R', 'Praveen S',
  'Rajesh Kannan M', 'Rithika S', 'Sanjay Kumar P', 'Saravanan B', 'Shalini V',
  'Siddharth M', 'Sneha R', 'Subashini K', 'Suresh Babu N', 'Swetha G',
  'Tharun Kumar R', 'Vaishnavi S', 'Vigneshwaran P', 'Vijay Anand K', 'Vinoth Kumar S'
];

async function main() {
  console.log('🌱 Starting comprehensive seed for Velan AI...');

  // 1. Password Hashes
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const facultyPasswordHash = await bcrypt.hash('Faculty@123', 10);
  const studentPasswordHash = await bcrypt.hash('Student@123', 10);

  // 2. Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@velan.ai' },
    update: {},
    create: {
      email: 'admin@velan.ai',
      passwordHash: adminPasswordHash,
      name: 'Dr. K. Velan (Super Admin)',
      phone: '+91 94440 12345',
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });

  // Admin Device
  await prisma.userDevice.upsert({
    where: { deviceId: 'dev_admin_desktop' },
    update: {},
    create: {
      userId: admin.id,
      deviceId: 'dev_admin_desktop',
      label: 'Admin Workstation',
      platform: 'Web',
      status: 'ACTIVE',
    },
  });

  // 3. Departments
  const deptCSE = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {},
    create: { code: 'CSE', name: 'Computer Science and Engineering', hodName: 'Dr. Ramesh Kumar' },
  });

  const deptECE = await prisma.department.upsert({
    where: { code: 'ECE' },
    update: {},
    create: { code: 'ECE', name: 'Electronics and Communication Engineering', hodName: 'Dr. Meenakshi Sundaram' },
  });

  const deptMECH = await prisma.department.upsert({
    where: { code: 'MECH' },
    update: {},
    create: { code: 'MECH', name: 'Mechanical Engineering', hodName: 'Dr. Chandrasekhar P' },
  });

  // 4. Faculty Members (8 Faculty)
  const facultyData = [
    { email: 'dr.ramesh@velan.ai', name: 'Dr. Ramesh Kumar', empId: 'FAC001', deptId: deptCSE.id, desig: 'Professor & HOD' },
    { email: 'priya.s@velan.ai', name: 'Ms. Priya S', empId: 'FAC002', deptId: deptCSE.id, desig: 'Associate Professor' },
    { email: 'suresh.v@velan.ai', name: 'Dr. Suresh V', empId: 'FAC003', deptId: deptCSE.id, desig: 'Assistant Professor' },
    { email: 'anitha.m@velan.ai', name: 'Prof. Anitha M', empId: 'FAC004', deptId: deptCSE.id, desig: 'Assistant Professor' },
    { email: 'meenakshi.s@velan.ai', name: 'Dr. Meenakshi Sundaram', empId: 'FAC005', deptId: deptECE.id, desig: 'Professor & HOD' },
    { email: 'karthikeyan.r@velan.ai', name: 'Dr. Karthikeyan R', empId: 'FAC006', deptId: deptECE.id, desig: 'Associate Professor' },
    { email: 'chandrasekhar.p@velan.ai', name: 'Dr. Chandrasekhar P', empId: 'FAC007', deptId: deptMECH.id, desig: 'Professor & HOD' },
    { email: 'balaji.n@velan.ai', name: 'Mr. Balaji N', empId: 'FAC008', deptId: deptMECH.id, desig: 'Assistant Professor' },
  ];

  const facultyProfiles: Record<string, any> = {};

  for (const f of facultyData) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      update: {},
      create: {
        email: f.email,
        passwordHash: facultyPasswordHash,
        name: f.name,
        role: 'FACULTY',
        status: 'ACTIVE',
      },
    });

    const profile = await prisma.facultyProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        employeeId: f.empId,
        departmentId: f.deptId,
        designation: f.desig,
      },
    });

    facultyProfiles[f.empId] = profile;

    // Faculty Device Binding
    await prisma.userDevice.upsert({
      where: { deviceId: `dev_faculty_${f.empId.toLowerCase()}` },
      update: {},
      create: {
        userId: user.id,
        deviceId: `dev_faculty_${f.empId.toLowerCase()}`,
        label: `${f.name}'s Smartphone`,
        platform: 'Android',
        status: 'ACTIVE',
      },
    });
  }

  // 5. Academic Years & Classes
  // CSE Year 2 (2023-2027)
  const ayCSE2 = await prisma.academicYear.upsert({
    where: { departmentId_year_batch: { departmentId: deptCSE.id, year: 2, batch: '2023-2027' } },
    update: {},
    create: { departmentId: deptCSE.id, year: 2, batch: '2023-2027' },
  });

  const classCSE2A = await prisma.class.upsert({
    where: { academicYearId_section: { academicYearId: ayCSE2.id, section: 'A' } },
    update: {},
    create: {
      academicYearId: ayCSE2.id,
      section: 'A',
      name: 'CSE – Year 2 – A',
      roomNumber: 'Lab 302',
      advisorId: facultyProfiles['FAC001'].id,
    },
  });

  const classCSE2B = await prisma.class.upsert({
    where: { academicYearId_section: { academicYearId: ayCSE2.id, section: 'B' } },
    update: {},
    create: {
      academicYearId: ayCSE2.id,
      section: 'B',
      name: 'CSE – Year 2 – B',
      roomNumber: 'Hall 201',
      advisorId: facultyProfiles['FAC002'].id,
    },
  });

  // ECE Year 3 (2022-2026)
  const ayECE3 = await prisma.academicYear.upsert({
    where: { departmentId_year_batch: { departmentId: deptECE.id, year: 3, batch: '2022-2026' } },
    update: {},
    create: { departmentId: deptECE.id, year: 3, batch: '2022-2026' },
  });

  const classECE3A = await prisma.class.upsert({
    where: { academicYearId_section: { academicYearId: ayECE3.id, section: 'A' } },
    update: {},
    create: {
      academicYearId: ayECE3.id,
      section: 'A',
      name: 'ECE – Year 3 – A',
      roomNumber: 'Hall 105',
      advisorId: facultyProfiles['FAC005'].id,
    },
  });

  // MECH Year 1 (2024-2028)
  const ayMECH1 = await prisma.academicYear.upsert({
    where: { departmentId_year_batch: { departmentId: deptMECH.id, year: 1, batch: '2024-2028' } },
    update: {},
    create: { departmentId: deptMECH.id, year: 1, batch: '2024-2028' },
  });

  const classMECH1A = await prisma.class.upsert({
    where: { academicYearId_section: { academicYearId: ayMECH1.id, section: 'A' } },
    update: {},
    create: {
      academicYearId: ayMECH1.id,
      section: 'A',
      name: 'MECH – Year 1 – A',
      roomNumber: 'Mech Hall 1',
      advisorId: facultyProfiles['FAC007'].id,
    },
  });

  const classes = [classCSE2A, classCSE2B, classECE3A, classMECH1A];

  // 6. Curriculum Subjects
  const subjectsData = [
    { code: 'CS301', name: 'Data Structures and Algorithms', departmentId: deptCSE.id, year: 2, credits: 4, type: 'THEORY' },
    { code: 'CS302', name: 'Computer Networks', departmentId: deptCSE.id, year: 2, credits: 3, type: 'THEORY' },
    { code: 'CS303', name: 'Database Management Systems', departmentId: deptCSE.id, year: 2, credits: 3, type: 'THEORY' },
    { code: 'CS304', name: 'Operating Systems', departmentId: deptCSE.id, year: 2, credits: 4, type: 'THEORY' },
    { code: 'CS308', name: 'Operating Systems Laboratory', departmentId: deptCSE.id, year: 2, credits: 2, type: 'LAB' },
    { code: 'MA301', name: 'Discrete Mathematics', departmentId: deptCSE.id, year: 2, credits: 4, type: 'THEORY' },
    { code: 'EC301', name: 'Microcontrollers & Embedded Systems', departmentId: deptECE.id, year: 3, credits: 4, type: 'THEORY' },
    { code: 'ME101', name: 'Engineering Graphics & Design', departmentId: deptMECH.id, year: 1, credits: 4, type: 'THEORY' },
  ];

  const subjectsMap: Record<string, any> = {};
  for (const s of subjectsData) {
    const sub = await prisma.subject.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
    subjectsMap[s.code] = sub;
  }

  // 7. Class-Subject-Teacher Assignments (Rule: 1 teacher per (class, subject))
  const csAssignments = [
    { classId: classCSE2A.id, subjectId: subjectsMap['CS301'].id, facultyId: facultyProfiles['FAC001'].id },
    { classId: classCSE2A.id, subjectId: subjectsMap['CS302'].id, facultyId: facultyProfiles['FAC002'].id },
    { classId: classCSE2A.id, subjectId: subjectsMap['CS303'].id, facultyId: facultyProfiles['FAC003'].id },
    { classId: classCSE2A.id, subjectId: subjectsMap['MA301'].id, facultyId: facultyProfiles['FAC004'].id },
    { classId: classCSE2A.id, subjectId: subjectsMap['CS304'].id, facultyId: facultyProfiles['FAC001'].id },

    { classId: classCSE2B.id, subjectId: subjectsMap['CS301'].id, facultyId: facultyProfiles['FAC001'].id },
    { classId: classCSE2B.id, subjectId: subjectsMap['CS303'].id, facultyId: facultyProfiles['FAC002'].id },

    { classId: classECE3A.id, subjectId: subjectsMap['EC301'].id, facultyId: facultyProfiles['FAC005'].id },
    { classId: classMECH1A.id, subjectId: subjectsMap['ME101'].id, facultyId: facultyProfiles['FAC007'].id },
  ];

  const classSubjectsList: any[] = [];
  for (const csa of csAssignments) {
    const record = await prisma.classSubject.upsert({
      where: { classId_subjectId: { classId: csa.classId, subjectId: csa.subjectId } },
      update: { facultyId: csa.facultyId },
      create: csa,
    });
    classSubjectsList.push(record);
  }

  // 8. Timetable Slots for Class CSE 2A (Zero Conflict Schedule)
  const primaryCS = classSubjectsList.find(cs => cs.classId === classCSE2A.id && cs.subjectId === subjectsMap['CS301'].id);
  const networksCS = classSubjectsList.find(cs => cs.classId === classCSE2A.id && cs.subjectId === subjectsMap['CS302'].id);
  const dbmsCS = classSubjectsList.find(cs => cs.classId === classCSE2A.id && cs.subjectId === subjectsMap['CS303'].id);
  const mathsCS = classSubjectsList.find(cs => cs.classId === classCSE2A.id && cs.subjectId === subjectsMap['MA301'].id);

  if (primaryCS && networksCS && dbmsCS && mathsCS) {
    const slots = [
      { day: 'MONDAY', period: 1, cs: primaryCS, room: 'Lab 302', start: '09:00', end: '10:00' },
      { day: 'MONDAY', period: 2, cs: primaryCS, room: 'Lab 302', start: '10:00', end: '11:00' },
      { day: 'MONDAY', period: 3, cs: networksCS, room: 'Hall 201', start: '11:15', end: '12:15' },
      { day: 'MONDAY', period: 5, cs: dbmsCS, room: 'Hall 201', start: '14:00', end: '15:00' },

      { day: 'TUESDAY', period: 1, cs: mathsCS, room: 'Hall 201', start: '09:00', end: '10:00' },
      { day: 'TUESDAY', period: 2, cs: dbmsCS, room: 'Hall 201', start: '10:00', end: '11:00' },

      { day: 'WEDNESDAY', period: 1, cs: primaryCS, room: 'Lab 302', start: '09:00', end: '10:00', isLab: true },
      { day: 'WEDNESDAY', period: 2, cs: primaryCS, room: 'Lab 302', start: '10:00', end: '11:00', isLab: true },

      { day: 'THURSDAY', period: 2, cs: networksCS, room: 'Hall 201', start: '10:00', end: '11:00' },
      { day: 'THURSDAY', period: 3, cs: primaryCS, room: 'Hall 201', start: '11:15', end: '12:15' },

      { day: 'FRIDAY', period: 1, cs: mathsCS, room: 'Hall 201', start: '09:00', end: '10:00' },
      { day: 'FRIDAY', period: 4, cs: dbmsCS, room: 'Hall 201', start: '12:15', end: '13:15' },
    ];

    for (const s of slots) {
      await prisma.timetableSlot.upsert({
        where: {
          classId_dayOfWeek_periodNumber: {
            classId: classCSE2A.id,
            dayOfWeek: s.day,
            periodNumber: s.period,
          },
        },
        update: {},
        create: {
          classId: classCSE2A.id,
          classSubjectId: s.cs.id,
          facultyId: s.cs.facultyId,
          dayOfWeek: s.day,
          periodNumber: s.period,
          startTime: s.start,
          endTime: s.end,
          roomNumber: s.room,
          isLabBlock: !!s.isLab,
        },
      });
    }
  }

  // 9. Seed 120 Students (30 per class) with Profiles & Bound Devices
  console.log('👨‍🎓 Seeding 120 student accounts across 4 classes...');
  const seededStudents: any[] = [];

  for (let cIdx = 0; cIdx < classes.length; cIdx++) {
    const cls = classes[cIdx];
    const deptPrefix = cls.name.substring(0, 3);
    const yearNum = cls.name.includes('Year 2') ? '22' : cls.name.includes('Year 3') ? '21' : '24';

    const secLetter = cls.section;
    const startOffset = cIdx === 1 ? 30 : 0;

    for (let i = 0; i < 30; i++) {
      const idxInDept = startOffset + i + 1;
      const numStr = (i + 1).toString().padStart(3, '0');
      const deptNumStr = idxInDept.toString().padStart(3, '0');
      const rollNo = `${yearNum}${deptPrefix}${secLetter}${numStr}`;
      const regNo = `7100${yearNum}104${deptNumStr}`;
      const fullName = INDIAN_NAMES[i];
      const email = i === 0 && cIdx === 0 ? 'student.arun@velan.ai' : `student.${rollNo.toLowerCase()}@velan.ai`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: studentPasswordHash,
          name: fullName,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });

      const studentProfile = await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          registerNo: regNo,
          rollNo,
          classId: cls.id,
          parentPhone: `+91 94432 ${10000 + i}`,
        },
      });

      // Device lock binding
      const deviceId = `dev_phone_${deptPrefix.toLowerCase()}_${rollNo.toLowerCase()}`;
      await prisma.userDevice.upsert({
        where: { deviceId },
        update: {},
        create: {
          userId: user.id,
          deviceId,
          label: `${fullName}'s Phone`,
          platform: 'Android',
          status: 'ACTIVE',
        },
      });

      if (cIdx === 0) {
        seededStudents.push(studentProfile);
      }
    }
  }

  // 10. Seed 30 Days of Historical Attendance for CSE 2A
  console.log('📅 Seeding 30 days of historical attendance with realistic variations...');
  const anchorLat = 13.0827;
  const anchorLng = 80.2707;

  if (primaryCS) {
    for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
      const sessionDate = new Date();
      sessionDate.setDate(sessionDate.getDate() - dayOffset);
      sessionDate.setHours(10, 0, 0, 0);

      // Skip Sundays
      if (sessionDate.getDay() === 0) continue;

      const session = await prisma.attendanceSession.create({
        data: {
          classId: classCSE2A.id,
          classSubjectId: primaryCS.id,
          facultyId: facultyProfiles['FAC001'].id,
          anchorLat,
          anchorLng,
          radiusMeters: 500,
          mode: 'HYBRID',
          rotatingToken: `tok_hist_${dayOffset}_${Date.now()}`,
          isActive: false,
          createdAt: sessionDate,
          expiresAt: new Date(sessionDate.getTime() + 15 * 60 * 1000),
        },
      });

      // Record for each student in CSE 2A
      for (let sIdx = 0; sIdx < seededStudents.length; sIdx++) {
        const student = seededStudents[sIdx];
        // Realistic variations: Student #8 (Janani) and Student #9 (Karthik Raja) have frequent absences
        let status = 'PRESENT';
        let distance = Math.round(30 + Math.random() * 200);

        if (sIdx === 8 && Math.random() < 0.35) {
          status = 'ABSENT';
          distance = 850;
        } else if (sIdx === 7 && Math.random() < 0.20) {
          status = 'ABSENT';
          distance = 740;
        } else if (Math.random() < 0.05) {
          status = 'ABSENT';
          distance = 920;
        }

        await prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status,
            method: 'GPS',
            distanceMeters: distance,
            accuracy: 14.5,
            deviceId: `dev_phone_cse_${student.rollNo.toLowerCase()}`,
            markedAt: new Date(sessionDate.getTime() + (Math.random() * 8 + 1) * 60 * 1000),
          },
        });
      }
    }
  }

  // 11. Class Chat Room for CSE 2A
  const chatRoom = await prisma.chatRoom.upsert({
    where: { classId: classCSE2A.id },
    update: {},
    create: { classId: classCSE2A.id },
  });

  const facultyUser = await prisma.user.findUnique({ where: { email: 'dr.ramesh@velan.ai' } });
  if (facultyUser) {
    await prisma.chatMessage.create({
      data: {
        roomId: chatRoom.id,
        senderId: facultyUser.id,
        content: 'Welcome to Semester 4 Data Structures & Algorithms class portal! Lecture slides are uploaded to Materials.',
        type: 'ANNOUNCEMENT',
        isPinned: true,
      },
    });
  }

  // 12. Announcements
  await prisma.announcement.create({
    data: {
      title: 'Internal Assessment 1 Schedule Released',
      content: 'IA-1 commences from next Monday. Timetable is published in the Academic portal.',
      target: 'ALL',
      isPinned: true,
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('========================================================');
  console.log('Demo Logins:');
  console.log('Super Admin : admin@velan.ai / Admin@123');
  console.log('Faculty     : dr.ramesh@velan.ai / Faculty@123');
  console.log('Student     : student.arun@velan.ai / Student@123');
  console.log('========================================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
