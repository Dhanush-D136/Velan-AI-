import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Wiping all demo data and initializing production-clean Velan AI database...');

  // Delete all transactional and demo records in reverse dependency order
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

  // Delete non-admin users
  await prisma.user.deleteMany({});

  // Read admin credentials from environment variables (DO NOT print values to logs)
  const adminUsername = process.env.ADMIN_USER || process.env.ADMIN_USERNAME || 'Vel';
  const adminPassword =
    process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'elite minds');

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required in production.');
  }

  console.log(`👤 Seeding Admin account with username: ${adminUsername}`);
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
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

  // Default Universal Settings (Institution name is blank by default)
  await prisma.setting.upsert({
    where: { key: 'INSTITUTION_NAME' },
    update: { value: '' },
    create: { key: 'INSTITUTION_NAME', value: '', description: 'Universal Institution Name' },
  });

  await prisma.setting.upsert({
    where: { key: 'DEFAULT_GEOFENCE_RADIUS' },
    update: { value: '500' },
    create: { key: 'DEFAULT_GEOFENCE_RADIUS', value: '500', description: 'Default GPS geofence radius in meters' },
  });

  await prisma.setting.upsert({
    where: { key: 'MIN_ATTENDANCE_PERCENT' },
    update: { value: '75' },
    create: { key: 'MIN_ATTENDANCE_PERCENT', value: '75', description: 'Mandatory collegiate minimum attendance percentage' },
  });

  console.log('✅ Clean database initialized successfully with zero demo data.');
  console.log('👉 Super Admin created. Login using username: ' + adminUsername);
}

main()
  .catch((e) => {
    console.error('❌ Clean seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
