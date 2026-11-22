export enum UserRole {
  ADMIN = 'ADMIN',
  FACULTY = 'FACULTY',
  STUDENT = 'STUDENT',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  ON_DUTY = 'ON_DUTY',
}

export enum AttendanceMethod {
  GPS = 'GPS',
  MANUAL = 'MANUAL',
}

export enum AttendanceMode {
  GPS = 'GPS',
  MANUAL = 'MANUAL',
  HYBRID = 'HYBRID',
}

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

export enum DeviceRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}

export enum SubjectType {
  THEORY = 'THEORY',
  LAB = 'LAB',
  ELECTIVE = 'ELECTIVE',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ChatMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  facultyProfile?: {
    id: string;
    employeeId: string;
    departmentId: string;
    departmentName?: string;
    designation: string;
  } | null;
  studentProfile?: {
    id: string;
    registerNo: string;
    rollNo: string;
    classId: string;
    className?: string;
    departmentName?: string;
    semester?: number;
    parentPhone?: string | null;
  } | null;
}

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp?: number;
  isMocked?: boolean;
}

export interface AttendanceSessionDto {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  facultyId: string;
  facultyName: string;
  anchorLat: number;
  anchorLng: number;
  radiusMeters: number;
  mode: AttendanceMode;
  rotatingToken: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  onDutyCount: number;
}

export interface AttendanceRecordDto {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  registerNo: string;
  rollNo: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  distanceMeters?: number | null;
  accuracy?: number | null;
  deviceId?: string | null;
  flags?: string | null;
  markedAt: string;
  markedBy?: string | null;
}

export interface TimetableSlotDto {
  id: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  facultyId: string;
  facultyName: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomNumber: string;
  isLabBlock?: boolean;
}

export interface TimetableConflict {
  type: 'FACULTY_DOUBLE_BOOKED' | 'ROOM_CLASH' | 'MAX_HOURS_EXCEEDED';
  message: string;
  details: {
    facultyId?: string;
    facultyName?: string;
    roomNumber?: string;
    dayOfWeek: DayOfWeek;
    periodNumber: number;
    conflictingClass?: string;
  };
}
