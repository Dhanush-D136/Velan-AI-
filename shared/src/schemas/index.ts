import { z } from 'zod';
import { AttendanceMode, AttendanceStatus, DayOfWeek, SubjectType, UserRole } from '../types';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  deviceId: z.string().min(1, 'Device identifier is required'),
  deviceLabel: z.string().optional(),
  platform: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const startAttendanceSessionSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  anchorLat: z.number().min(-90).max(90),
  anchorLng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(30).max(2000).default(500),
  durationMinutes: z.number().min(1).max(120).default(10),
  mode: z.nativeEnum(AttendanceMode).default(AttendanceMode.HYBRID),
});

export const markAttendanceSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  rotatingToken: z.string().min(1, 'Security token is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000),
  timestamp: z.number(),
  deviceId: z.string().min(1, 'Device identifier is required'),
  isMocked: z.boolean().optional(),
});

export const manualAttendanceSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.nativeEnum(AttendanceStatus),
      remarks: z.string().optional(),
    })
  ),
});

export const deviceChangeRequestSchema = z.object({
  email: z.string().email(),
  newDeviceId: z.string().min(1),
  deviceLabel: z.string().optional(),
  platform: z.string().optional(),
  reason: z.string().min(5, 'Please provide a clear reason for device reset'),
});

export const timetableSlotCreateSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  facultyId: z.string().min(1),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  periodNumber: z.number().int().min(1).max(10),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  roomNumber: z.string().min(1, 'Room number is required'),
  isLabBlock: z.boolean().optional().default(false),
});

export const facultyCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  employeeId: z.string().min(1),
  departmentId: z.string().min(1),
  designation: z.string().min(1),
});

export const studentCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  registerNo: z.string().min(1),
  rollNo: z.string().min(1),
  classId: z.string().min(1),
  parentPhone: z.string().optional(),
});

export const classCreateSchema = z.object({
  academicYearId: z.string().min(1),
  section: z.string().min(1),
  advisorId: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
});

export const subjectCreateSchema = z.object({
  departmentId: z.string().min(1),
  year: z.number().int().min(1).max(5),
  code: z.string().min(2),
  name: z.string().min(2),
  type: z.nativeEnum(SubjectType).default(SubjectType.THEORY),
  credits: z.number().int().min(1).max(10).default(3),
});

export const classSubjectAssignSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  facultyId: z.string().min(1),
});

export const chatMessageSchema = z.object({
  classId: z.string().min(1),
  content: z.string().min(1),
  type: z.string().default('TEXT'),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  replyToId: z.string().optional(),
});
