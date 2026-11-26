import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
import * as authCtrl from '../controllers/authController';
import * as attCtrl from '../controllers/attendanceController';
import * as ttCtrl from '../controllers/timetableController';
import * as acadCtrl from '../controllers/academicController';
import * as chatCtrl from '../controllers/chatController';
import * as aiCtrl from '../controllers/aiController';
import * as expCtrl from '../controllers/exportController';
import * as notifCtrl from '../controllers/notificationController';
import * as resCtrl from '../controllers/resourceController';
import * as reqCtrl from '../controllers/requestController';
import * as skipCtrl from '../controllers/skipController';
import * as acadRecCtrl from '../controllers/academicsRecordController';
import * as monCtrl from '../controllers/monitorController';
import * as rushCtrl from '../controllers/rushQueueController';
import * as mentorCtrl from '../controllers/mentorController';

const deviceRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many device reset requests. Please try again later.' },
});

export const apiRouter = Router();

// ==========================================
// AUTHENTICATION & PASSWORD FLOWS
// ==========================================
apiRouter.post('/auth/login', authCtrl.login);
apiRouter.post('/auth/change-password', authenticateToken, authCtrl.changePassword);
apiRouter.post('/auth/forgot-password', authCtrl.requestPasswordReset);
apiRouter.post('/auth/device-request', deviceRequestLimiter, authCtrl.requestDeviceChange);
apiRouter.get('/auth/me', authenticateToken, authCtrl.getCurrentUser);
apiRouter.put('/auth/profile', authenticateToken, authCtrl.updateMyProfile);
apiRouter.get('/auth/devices', authenticateToken, authCtrl.getMyDevices);
apiRouter.get('/auth/my-history', authenticateToken, authCtrl.getMyAuthHistory);
apiRouter.post('/auth/logout', authCtrl.logout);
apiRouter.post('/logout', authCtrl.logout);
apiRouter.post('/presence/heartbeat', authenticateToken, authCtrl.presenceHeartbeat);

// Student Profile Completion & Locks
apiRouter.post('/student/profile', authenticateToken, requireRole('STUDENT'), authCtrl.completeStudentProfile);
apiRouter.post('/student/request-profile-edit', authenticateToken, requireRole('STUDENT'), authCtrl.requestProfileEdit);

// ==========================================
// ACADEMIC HIERARCHY & CRUD (DEPARTMENTS, YEARS, CLASSES)
// ==========================================
apiRouter.get('/academics/hierarchy', authenticateToken, acadCtrl.getAcademicHierarchy);
apiRouter.get('/academics/departments', authenticateToken, acadCtrl.getDepartments);
apiRouter.post('/academics/departments', authenticateToken, requireRole('ADMIN'), acadCtrl.createDepartment);
apiRouter.put('/academics/departments/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.updateDepartment);
apiRouter.delete('/academics/departments/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.deleteDepartment);

apiRouter.get('/academics/years', authenticateToken, acadCtrl.getAcademicYears);
apiRouter.post('/academics/years', authenticateToken, requireRole('ADMIN'), acadCtrl.createAcademicYear);
apiRouter.delete('/academics/years/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.deleteAcademicYear);

apiRouter.get('/academics/classes', authenticateToken, acadCtrl.getClasses);
apiRouter.post('/academics/classes', authenticateToken, requireRole('ADMIN'), acadCtrl.createClass);
apiRouter.put('/academics/classes/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.updateClass);
apiRouter.delete('/academics/classes/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.deleteClass);

// ==========================================
// SUBJECTS & TEACHER ASSIGNMENTS
// ==========================================
apiRouter.get('/academics/subjects', authenticateToken, acadCtrl.getSubjects);
apiRouter.post('/academics/subjects', authenticateToken, requireRole('ADMIN'), acadCtrl.createSubject);
apiRouter.delete('/academics/subjects/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.deleteSubject);

apiRouter.get('/academics/assignments', authenticateToken, acadCtrl.getClassSubjectAssignments);
apiRouter.post('/academics/assignments', authenticateToken, requireRole('ADMIN'), acadCtrl.assignClassSubject);
apiRouter.delete('/academics/assignments/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.removeClassSubject);

// ==========================================
// FACULTY MANAGEMENT
// ==========================================
apiRouter.get('/academics/faculty', authenticateToken, acadCtrl.getFacultyList);
apiRouter.post('/academics/faculty', authenticateToken, requireRole('ADMIN'), acadCtrl.createFaculty);
apiRouter.put('/academics/faculty/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.updateFaculty);
apiRouter.delete('/academics/faculty/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.deleteFaculty);
apiRouter.post('/academics/faculty/:id/reset-password', authenticateToken, requireRole('ADMIN'), acadCtrl.resetFacultyPassword);
apiRouter.post('/academics/faculty/import-excel', authenticateToken, requireRole('ADMIN'), acadCtrl.importFacultyFromExcel);

// ==========================================
// STUDENT MANAGEMENT & EXCEL IMPORT
// ==========================================
apiRouter.get('/academics/students', authenticateToken, acadCtrl.getStudentsList);
apiRouter.post('/academics/students', authenticateToken, requireRole('ADMIN'), acadCtrl.createStudent);
apiRouter.put('/academics/students/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.updateStudent);
apiRouter.delete('/academics/students/:id', authenticateToken, requireRole('ADMIN'), acadCtrl.deleteStudent);
apiRouter.post('/academics/students/:id/reset-password', authenticateToken, requireRole('ADMIN'), acadCtrl.resetStudentPassword);
apiRouter.get('/academics/students/template', authenticateToken, acadCtrl.getStudentExcelTemplate);
apiRouter.post('/academics/students/import-excel', authenticateToken, requireRole('ADMIN'), upload.single('file'), acadCtrl.importStudentsFromExcel);
apiRouter.get('/academics/students/:id/devices', authenticateToken, requireRole('ADMIN'), acadCtrl.getStudentDevices);
apiRouter.delete('/academics/students/:id/devices/:deviceId', authenticateToken, requireRole('ADMIN'), acadCtrl.revokeStudentDevice);

// ==========================================
// ADMIN REQUESTS QUEUE (PASSWORD, PROFILE, DEVICE)
// ==========================================
apiRouter.get('/academics/requests', authenticateToken, requireRole('ADMIN'), acadCtrl.getAdminRequests);
apiRouter.post('/academics/requests/password/:id/decision', authenticateToken, requireRole('ADMIN'), acadCtrl.decidePasswordReset);
apiRouter.post('/academics/requests/profile-edit/:id/decision', authenticateToken, requireRole('ADMIN'), acadCtrl.decideProfileEdit);
apiRouter.post('/academics/device-requests/:requestId/decision', authenticateToken, requireRole('ADMIN'), acadCtrl.decideDeviceRequest);

// ==========================================
// SYSTEM SETTINGS & ADMIN OVERVIEW
// ==========================================
apiRouter.get('/settings', authenticateToken, acadCtrl.getSystemSettings);
apiRouter.put('/settings', authenticateToken, requireRole('ADMIN'), acadCtrl.updateSystemSettings);
apiRouter.get('/settings/bell-schedule', authenticateToken, acadCtrl.getBellSchedule);
apiRouter.put('/settings/bell-schedule', authenticateToken, requireRole('ADMIN'), acadCtrl.updateBellSchedule);
apiRouter.get('/admin/dashboard-stats', authenticateToken, requireRole('ADMIN'), acadCtrl.getDashboardStats);

// ==========================================
// GPS ATTENDANCE
// ==========================================
apiRouter.post('/attendance/start', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.startSession);
apiRouter.post('/attendance/mark', authenticateToken, requireRole('STUDENT'), attCtrl.markAttendance);
apiRouter.get('/attendance/session/:sessionId/live', authenticateToken, attCtrl.getSessionLiveBoard);
apiRouter.post('/attendance/session/:sessionId/extend', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.extendSession);
apiRouter.post('/attendance/manual', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.submitManualAttendance);
apiRouter.post('/attendance/session/:sessionId/close', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.closeSession);
apiRouter.delete('/attendance/session/:sessionId', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.deleteSession);
apiRouter.get('/attendance/live-sessions', authenticateToken, requireRole('ADMIN'), attCtrl.getLiveSessionsList);
apiRouter.get('/attendance/sessions', authenticateToken, requireRole('ADMIN', 'FACULTY'), attCtrl.getAttendanceSessionsHistory);
apiRouter.get('/attendance/faculty-overview', authenticateToken, requireRole('FACULTY'), attCtrl.getFacultyDashboardData);
apiRouter.get('/attendance/student-overview', authenticateToken, requireRole('STUDENT'), attCtrl.getStudentDashboardData);

// ==========================================
// TIMETABLE
// ==========================================
apiRouter.get('/timetable/class/:classId', authenticateToken, ttCtrl.getClassTimetable);
apiRouter.get('/timetable/my-faculty', authenticateToken, requireRole('FACULTY'), ttCtrl.getFacultyTimetable);
apiRouter.get('/timetable/my-student', authenticateToken, requireRole('STUDENT'), ttCtrl.getStudentTimetable);
apiRouter.post('/timetable/conflicts', authenticateToken, requireRole('ADMIN'), ttCtrl.checkConflicts);
apiRouter.post('/timetable/slot', authenticateToken, requireRole('ADMIN'), ttCtrl.saveSlot);
apiRouter.delete('/timetable/slot/:id', authenticateToken, requireRole('ADMIN'), ttCtrl.deleteSlot);

// ==========================================
// CHAT & AI & EXPORT & RESOURCES & NOTIFICATIONS
// ==========================================
apiRouter.get('/chat/rooms', authenticateToken, chatCtrl.getChatRooms);
apiRouter.get('/chat/room/:classId', authenticateToken, chatCtrl.getRoomMessages);
apiRouter.post('/chat/message', authenticateToken, chatCtrl.postMessage);
apiRouter.post('/ai/ask', authenticateToken, aiCtrl.askAI);
apiRouter.get('/export/monthly-register', authenticateToken, expCtrl.exportMonthlyRegister);
apiRouter.get('/export/session/:sessionId', authenticateToken, requireRole('ADMIN', 'FACULTY'), expCtrl.exportSessionExcel);

// Assignments & Material Library
apiRouter.get('/assignments', authenticateToken, resCtrl.getAssignments);
apiRouter.get('/assignments/teaching-pairs', authenticateToken, requireRole('FACULTY'), resCtrl.getMyTeachingPairs);
apiRouter.post('/assignments', authenticateToken, requireRole('FACULTY'), resCtrl.createAssignment);
apiRouter.put('/assignments/:id', authenticateToken, requireRole('FACULTY'), resCtrl.updateAssignment);
apiRouter.delete('/assignments/:id', authenticateToken, requireRole('FACULTY'), resCtrl.deleteAssignment);

apiRouter.get('/materials', authenticateToken, resCtrl.getMaterials);
apiRouter.post('/materials', authenticateToken, requireRole('FACULTY'), resCtrl.createMaterial);
apiRouter.put('/materials/:id', authenticateToken, requireRole('FACULTY'), resCtrl.updateMaterial);
apiRouter.delete('/materials/:id', authenticateToken, requireRole('FACULTY', 'ADMIN'), resCtrl.deleteMaterial);

// General Student Requests & Replies
apiRouter.post('/requests', authenticateToken, reqCtrl.createStudentRequest);
apiRouter.get('/requests/my', authenticateToken, reqCtrl.getMyRequests);
apiRouter.get('/requests', authenticateToken, requireRole('ADMIN'), reqCtrl.getAllRequests);
apiRouter.post('/requests/:id/decision', authenticateToken, requireRole('ADMIN'), reqCtrl.decideStudentRequest);

// Notifications, Preferences & Web Push
apiRouter.get('/push/vapid-public-key', notifCtrl.getVapidPublicKey);
apiRouter.post('/push/subscribe', authenticateToken, notifCtrl.subscribePush);
apiRouter.get('/notifications', authenticateToken, notifCtrl.getMyNotifications);
apiRouter.post('/notifications/read', authenticateToken, notifCtrl.markNotificationsRead);
apiRouter.get('/notifications/preferences', authenticateToken, notifCtrl.getMyPreferences);
apiRouter.put('/notifications/preferences', authenticateToken, notifCtrl.updateMyPreferences);

// ==========================================
// PHASE 3: SKIP CALCULATOR, HOLIDAYS & SEMESTER DATES
// ==========================================
apiRouter.get('/skip/overview', authenticateToken, requireRole('STUDENT'), skipCtrl.getSkipOverview);
apiRouter.get('/skip/semester-dates', authenticateToken, skipCtrl.getSemesterDates);
apiRouter.post('/skip/semester-dates', authenticateToken, requireRole('ADMIN'), skipCtrl.upsertSemesterDate);
apiRouter.put('/skip/semester-dates/:id', authenticateToken, requireRole('ADMIN'), skipCtrl.upsertSemesterDate);
apiRouter.delete('/skip/semester-dates/:id', authenticateToken, requireRole('ADMIN'), skipCtrl.deleteSemesterDate);
apiRouter.get('/skip/holidays', authenticateToken, skipCtrl.getHolidays);
apiRouter.post('/skip/holidays', authenticateToken, requireRole('ADMIN'), skipCtrl.createHoliday);
apiRouter.delete('/skip/holidays/:id', authenticateToken, requireRole('ADMIN'), skipCtrl.deleteHoliday);
apiRouter.put('/skip/thresholds', authenticateToken, requireRole('ADMIN'), skipCtrl.updateThresholds);

// ==========================================
// PHASE 3: ACADEMICS, GPA / CGPA & GRADING SCALE
// ==========================================
apiRouter.get('/academics-records/grading-scales', authenticateToken, acadRecCtrl.getGradingScales);
apiRouter.post('/academics-records/grading-scales', authenticateToken, requireRole('ADMIN'), acadRecCtrl.upsertGradingScale);
apiRouter.put('/academics-records/cgpa-multiplier', authenticateToken, requireRole('ADMIN'), acadRecCtrl.updateCgpaMultiplier);
apiRouter.get('/academics-records/credit-lookup', authenticateToken, acadRecCtrl.getCreditLookups);
apiRouter.post('/academics-records/credit-lookup', authenticateToken, requireRole('ADMIN'), acadRecCtrl.upsertCreditLookup);
apiRouter.delete('/academics-records/credit-lookup/:id', authenticateToken, requireRole('ADMIN'), acadRecCtrl.deleteCreditLookup);

apiRouter.get('/academics-records/my', authenticateToken, requireRole('STUDENT'), acadRecCtrl.getMyAcademics);
apiRouter.post('/academics-records/my/semester', authenticateToken, requireRole('STUDENT'), acadRecCtrl.saveMySemester);
apiRouter.delete('/academics-records/my/semester/:id', authenticateToken, requireRole('STUDENT'), acadRecCtrl.deleteMySemester);

apiRouter.get('/academics-records/advisees', authenticateToken, requireRole('FACULTY'), acadRecCtrl.getAdviseeAcademics);
apiRouter.get('/academics-records/admin', authenticateToken, requireRole('ADMIN'), acadRecCtrl.getAdminAcademics);
apiRouter.get('/academics-records/student/:studentId', authenticateToken, acadRecCtrl.getStudentAcademicDetail);
apiRouter.post('/academics-records/student/:studentId/semester', authenticateToken, requireRole('ADMIN'), acadRecCtrl.adminSaveStudentSemester);

apiRouter.get('/academics-records/export/excel', authenticateToken, requireRole('FACULTY', 'ADMIN'), acadRecCtrl.exportAcademicsExcel);
apiRouter.get('/academics-records/export/pdf', authenticateToken, requireRole('FACULTY', 'ADMIN'), acadRecCtrl.exportAcademicsPdf);

// ==========================================
// PHASE 4: ADMIN LIVE MONITOR & SERVER HEALTH
// ==========================================
apiRouter.get('/admin/health', authenticateToken, requireRole('ADMIN'), monCtrl.getAdminHealth);
apiRouter.get('/admin/monitor/overview', authenticateToken, requireRole('ADMIN'), monCtrl.getMonitorOverview);
apiRouter.get('/admin/monitor/history', authenticateToken, requireRole('ADMIN'), monCtrl.getAuthHistory);
apiRouter.get('/admin/monitor/export/history', authenticateToken, requireRole('ADMIN'), monCtrl.exportAuthHistoryExcel);
apiRouter.get('/admin/monitor/export/never-logged-in', authenticateToken, requireRole('ADMIN'), monCtrl.exportNeverLoggedInExcel);
apiRouter.post('/admin/monitor/force-logout', authenticateToken, requireRole('ADMIN'), monCtrl.forceLogoutUser);
apiRouter.put('/admin/monitor/settings', authenticateToken, requireRole('ADMIN'), monCtrl.updateMonitorSettings);

// ==========================================
// PHASE 5: RUSH-HOUR CHECK-IN QUEUE & TICKETS
// ==========================================
apiRouter.get('/checkin/ticket/:id', authenticateToken, rushCtrl.getCheckinTicket);
apiRouter.get('/admin/rush-queue/config', authenticateToken, requireRole('ADMIN'), rushCtrl.getRushQueueConfig);
apiRouter.put('/admin/rush-queue/config', authenticateToken, requireRole('ADMIN'), rushCtrl.updateRushQueueConfig);
apiRouter.get('/admin/rush-queue/stats', authenticateToken, requireRole('ADMIN'), rushCtrl.getRushQueueStats);

// ==========================================
// PHASE 6: MENTOR SYSTEM
// ==========================================
apiRouter.get('/admin/mentors/overview', authenticateToken, requireRole('ADMIN'), mentorCtrl.getAdminMentorsOverview);
apiRouter.get('/admin/mentors/class/:classId', authenticateToken, requireRole('ADMIN'), mentorCtrl.getClassMentorBoard);
apiRouter.put('/admin/mentors/class/:classId/mentors', authenticateToken, requireRole('ADMIN'), mentorCtrl.setClassMentors);
apiRouter.post('/admin/mentors/class/:classId/bulk-assign', authenticateToken, requireRole('ADMIN'), deviceRequestLimiter, mentorCtrl.bulkAssignMentees);
apiRouter.post('/admin/mentors/class/:classId/auto-distribute', authenticateToken, requireRole('ADMIN'), mentorCtrl.autoDistributeMentees);
apiRouter.get('/admin/mentors/class/:classId/export', authenticateToken, requireRole('ADMIN'), mentorCtrl.exportMentorMappingExcel);
apiRouter.post('/admin/mentors/class/:classId/import', authenticateToken, requireRole('ADMIN'), mentorCtrl.importMentorMapping);
apiRouter.post('/admin/mentors/faculty/:facultyId/reassign', authenticateToken, requireRole('ADMIN'), mentorCtrl.reassignFacultyMentees);

apiRouter.get('/mentoring/roles', authenticateToken, requireRole('FACULTY'), mentorCtrl.getMyMentoringRoles);
apiRouter.get('/mentoring/mentees', authenticateToken, requireRole('FACULTY'), mentorCtrl.getScopedMentees);
apiRouter.get('/mentoring/student/:studentId', authenticateToken, mentorCtrl.getFullStudentDetail);
apiRouter.post('/mentoring/student/:studentId/notes', authenticateToken, requireRole('FACULTY', 'ADMIN'), mentorCtrl.createMentorNote);
apiRouter.delete('/mentoring/notes/:noteId', authenticateToken, requireRole('FACULTY', 'ADMIN'), mentorCtrl.deleteMentorNote);
apiRouter.post('/mentoring/announce', authenticateToken, requireRole('FACULTY'), mentorCtrl.sendMenteeAnnouncement);
