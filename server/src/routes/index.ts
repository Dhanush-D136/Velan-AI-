import { Router } from 'express';
import multer from 'multer';
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

export const apiRouter = Router();

// ==========================================
// AUTHENTICATION & PASSWORD FLOWS
// ==========================================
apiRouter.post('/auth/login', authCtrl.login);
apiRouter.post('/auth/change-password', authenticateToken, authCtrl.changePassword);
apiRouter.post('/auth/forgot-password', authCtrl.requestPasswordReset);
apiRouter.post('/auth/device-request', authCtrl.requestDeviceChange);
apiRouter.get('/auth/me', authenticateToken, authCtrl.getCurrentUser);
apiRouter.post('/auth/logout', authCtrl.logout);

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
apiRouter.get('/attendance/live-sessions', authenticateToken, requireRole('ADMIN'), attCtrl.getLiveSessionsList);
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
// CHAT & AI & EXPORT
// ==========================================
apiRouter.get('/chat/room/:classId', authenticateToken, chatCtrl.getRoomMessages);
apiRouter.post('/chat/message', authenticateToken, chatCtrl.postMessage);
apiRouter.post('/ai/ask', authenticateToken, aiCtrl.askAI);
apiRouter.get('/export/monthly-register', authenticateToken, expCtrl.exportMonthlyRegister);
