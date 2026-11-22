import { z } from 'zod';
import { AttendanceMode, AttendanceStatus, DayOfWeek, SubjectType, UserRole } from '../types';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Please enter your username, Register Number, or Employee ID'),
  password: z.string().min(1, 'Please enter your password'),
  deviceId: z.string().min(1, 'Device identifier is required'),
  deviceLabel: z.string().optional(),
  platform: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .refine((val) => val !== '1234', {
      message: 'Password cannot stay 1234. Please choose a new password.',
    }),
});

export const completeProfileSchema = z.object({
  personalEmail: z.string().email('Please enter a valid email address'),
  phone: z.string().min(5, 'Please enter a valid phone number'),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  bloodGroup: z.string().min(1, 'Blood group is required'),
  address: z.string().min(3, 'Address is required'),
  guardianName: z.string().min(2, 'Parent or guardian name is required'),
  guardianPhone: z.string().min(5, 'Parent or guardian phone is required'),
  photoUrl: z.string().optional().nullable(),
});

export const requestProfileEditSchema = z.object({
  reason: z.string().min(5, 'Please provide a clear reason for profile edit permission'),
});

export const requestPasswordResetSchema = z.object({
  identifier: z.string().min(1, 'Please enter your username, Register Number, or Employee ID'),
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
  identifier: z.string().min(1),
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

export const departmentCreateSchema = z.object({
  code: z.string().min(2, 'Department code must be at least 2 characters (e.g. CSE)').toUpperCase(),
  name: z.string().min(3, 'Department name is required'),
  hodName: z.string().optional(),
});

export const academicYearCreateSchema = z.object({
  departmentId: z.string().min(1, 'Department is required'),
  year: z.number().int().min(1).max(5),
  batch: z.string().min(4, 'Batch is required (e.g. 2024–2028)'),
});

export const classCreateSchema = z.object({
  academicYearId: z.string().min(1, 'Academic Year is required'),
  section: z.string().min(1, 'Section is required (e.g. A, B)').toUpperCase(),
  roomNumber: z.string().optional().nullable(),
  advisorId: z.string().optional().nullable(),
});

export const subjectCreateSchema = z.object({
  departmentId: z.string().min(1, 'Department is required'),
  year: z.number().int().min(1).max(5),
  code: z.string().min(2, 'Subject code is required (e.g. CS301)').toUpperCase(),
  name: z.string().min(2, 'Subject title is required'),
  type: z.nativeEnum(SubjectType).default(SubjectType.THEORY),
  credits: z.number().int().min(1).max(10).default(3),
});

export const classSubjectAssignSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  facultyId: z.string().min(1, 'Faculty is required'),
});

export const facultyCreateSchema = z.object({
  name: z.string().min(2, 'Faculty name is required'),
  employeeId: z.string().min(2, 'Employee ID is required (e.g. FAC001)').toUpperCase(),
  departmentId: z.string().min(1, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

export const studentCreateSchema = z.object({
  name: z.string().min(2, 'Student name is required'),
  registerNo: z.string().min(2, 'Register Number is required'),
  rollNo: z.string().min(2, 'Roll Number is required'),
  classId: z.string().min(1, 'Class is required'),
});

export const chatMessageSchema = z.object({
  classId: z.string().min(1),
  content: z.string().min(1),
  type: z.string().default('TEXT'),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  replyToId: z.string().optional(),
});
