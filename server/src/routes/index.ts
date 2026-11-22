import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as authCtrl from '../controllers/authController';
import * as attCtrl from '../controllers/attendanceController';
import * as ttCtrl from '../controllers/timetableController';
import * as acadCtrl from '../controllers/academicController';
import * as chatCtrl from '../controllers/chatController';
import * as aiCtrl from '../controllers/aiController';
import * as expCtrl from '../controllers/exportController';

export const apiRouter = Router();

// Auth Routes
apiRouter.post('/auth/login', authCtrl.login);
apiRouter.post('/auth/device-request', authCtrl.requestDeviceChange);
apiRouter.get('/auth/me', authenticateToken, authCtrl.getCurrentUser);
apiRouter.post('/auth/logout', authCtrl.logout);

// GPS Attendance Routes
apiRouter.post('/attendance/start', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.startSession);
apiRouter.post('/attendance/mark', authenticateToken, requireRole('STUDENT'), attCtrl.markAttendance);
apiRouter.get('/attendance/session/:sessionId/live', authenticateToken, attCtrl.getSessionLiveBoard);
apiRouter.post('/attendance/manual', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.submitManualAttendance);
apiRouter.post('/attendance/session/:sessionId/close', authenticateToken, requireRole('FACULTY', 'ADMIN'), attCtrl.closeSession);

// Timetable Routes
apiRouter.get('/timetable/class/:classId', authenticateToken, ttCtrl.getClassTimetable);
apiRouter.post('/timetable/conflicts', authenticateToken, requireRole('ADMIN'), ttCtrl.checkConflicts);
apiRouter.post('/timetable/slot', authenticateToken, requireRole('ADMIN'), ttCtrl.saveSlot);

// Academic Hierarchy & User Management
apiRouter.get('/academics/hierarchy', authenticateToken, acadCtrl.getAcademicHierarchy);
apiRouter.get('/academics/faculty', authenticateToken, acadCtrl.getFacultyList);
apiRouter.get('/academics/students', authenticateToken, acadCtrl.getStudentsList);
apiRouter.get('/academics/device-requests', authenticateToken, requireRole('ADMIN'), acadCtrl.getDeviceRequests);
apiRouter.post('/academics/device-requests/:requestId/decision', authenticateToken, requireRole('ADMIN'), acadCtrl.decideDeviceRequest);

// Chat Routes
apiRouter.get('/chat/room/:classId', authenticateToken, chatCtrl.getRoomMessages);
apiRouter.post('/chat/message', authenticateToken, chatCtrl.postMessage);

// AI Intelligence
apiRouter.post('/ai/ask', authenticateToken, aiCtrl.askAI);

// ExcelJS Exports
apiRouter.get('/export/monthly-register', authenticateToken, expCtrl.exportMonthlyRegister);
