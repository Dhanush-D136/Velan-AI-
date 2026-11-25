import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

dotenv.config();

const prisma = new PrismaClient();

const askConfirmation = (question: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes' || answer.trim().toLowerCase() === 'y');
    });
  });
};

async function backupDatabase() {
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // If SQLite file exists, copy it too
  const sqlitePath = path.resolve(process.cwd(), 'prisma/dev.db');
  if (fs.existsSync(sqlitePath)) {
    const dest = path.join(backupDir, `dev-backup-${timestamp}.db`);
    fs.copyFileSync(sqlitePath, dest);
    console.log(`💾 SQLite backup saved to: ${dest}`);
  }

  // Export JSON snapshot of current PostgreSQL/DB state
  const snapshot = {
    backedUpAt: new Date().toISOString(),
    departments: await prisma.department.findMany(),
    academicYears: await prisma.academicYear.findMany(),
    classes: await prisma.class.findMany(),
    subjects: await prisma.subject.findMany(),
    users: await prisma.user.findMany({
      select: { id: true, username: true, email: true, name: true, role: true, status: true },
    }),
    facultyProfiles: await prisma.facultyProfile.findMany(),
    studentProfiles: await prisma.studentProfile.findMany(),
    classSubjects: await prisma.classSubject.findMany(),
    timetableSlots: await prisma.timetableSlot.findMany(),
    attendanceSessions: await prisma.attendanceSession.findMany(),
    attendanceRecords: await prisma.attendanceRecord.findMany(),
    settings: await prisma.setting.findMany(),
  };

  const jsonDest = path.join(backupDir, `db-backup-${timestamp}.json`);
  fs.writeFileSync(jsonDest, JSON.stringify(snapshot, null, 2));
  console.log(`💾 JSON database backup saved to: ${jsonDest}`);
}

async function main() {
  const forceYes = process.argv.includes('--yes') || process.argv.includes('-y');

  if (!forceYes) {
    const confirmed = await askConfirmation(
      '⚠️  This will back up the database and wipe ALL non-admin data (departments, classes, faculty, students, timetables, attendance). Continue? (yes/no): '
    );
    if (!confirmed) {
      console.log('❌ Reset cancelled.');
      process.exit(0);
    }
  }

  await backupDatabase();

  console.log('🧹 Wiping all non-admin data...');
  await prisma.attendanceRecord.deleteMany({});
  await prisma.attendanceSession.deleteMany({});
  await prisma.timetableSlot.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.material.deleteMany({});
  await prisma.mark.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.pushSubscription.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.passwordResetRequest.deleteMany({});
  await prisma.profileEditRequest.deleteMany({});
  await prisma.deviceChangeRequest.deleteMany({});
  await prisma.userDevice.deleteMany({});
  await prisma.classSubject.deleteMany({});
  await prisma.studentProfile.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.facultyProfile.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.academicYear.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.fee.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.feedback.deleteMany({});
  await prisma.importJob.deleteMany({});

  // Delete all non-admin users; recreate/update the single Admin user from env
  await prisma.user.deleteMany({ where: { role: { not: 'ADMIN' } } });

  const adminUsername = process.env.ADMIN_USER || process.env.ADMIN_USERNAME || 'Vel';
  const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'elite minds');

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable must be set in production.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { username: adminUsername, passwordHash, status: 'ACTIVE', mustChangePassword: false },
    });
  } else {
    await prisma.user.create({
      data: {
        username: adminUsername,
        email: 'admin@velan.ai',
        name: 'System Administrator',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
  }

  console.log(`✅ Reset complete. Zero demo data remains. Admin account ready (${adminUsername}).`);
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
