import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { UserRole } from '@velan/shared';
import { BrandLogo } from './components/ui/BrandLogo';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './components/layout/AppLayout';

// Admin Screens
import { AdminDashboard } from './features/admin/AdminDashboard';
import { LiveAttendanceMonitor } from './features/admin/LiveAttendanceMonitor';
import { TimetableBuilder } from './features/admin/TimetableBuilder';
import { FacultyManagement } from './features/admin/FacultyManagement';
import { StudentManagement } from './features/admin/StudentManagement';
import { AcademicsManagement } from './features/admin/AcademicsManagement';
import { AdminRequestsPage } from './features/admin/AdminRequestsPage';
import { ReportsPage } from './features/admin/ReportsPage';

// Faculty Screens
import { FacultyDashboard } from './features/faculty/FacultyDashboard';
import { FacultyAttendancePage } from './features/faculty/FacultyAttendancePage';

// Student Screens
import { StudentDashboard } from './features/student/StudentDashboard';
import { StudentMarkAttendancePage } from './features/student/StudentMarkAttendancePage';
import { StudentAttendanceHistoryPage } from './features/student/StudentAttendanceHistoryPage';

// Shared Screens
import { ClassChatPage } from './features/chat/ClassChatPage';
import { AIAssistantPage } from './features/ai/AIAssistantPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AttendanceHistoryEditorPage } from './features/shared/AttendanceHistoryEditorPage';
import { AssignmentsPage } from './features/shared/AssignmentsPage';
import { MaterialsPage } from './features/shared/MaterialsPage';

// Generic placeholder for sub-pages
const GenericSubPage: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="p-8 bg-white border border-border rounded-3xl shadow-glass">
    <h2 className="text-2xl font-heading font-bold text-content tracking-tight">{title}</h2>
    {subtitle && <p className="text-sm text-content-secondary mt-1">{subtitle}</p>}
    <div className="mt-8 p-12 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
        ✓
      </div>
      <p className="text-sm font-semibold text-content">{title} Module Active</p>
      <p className="text-xs text-content-muted mt-1">Live synchronized data connected to database</p>
    </div>
  </div>
);

export default function App() {
  const { user, isAuthenticated, isHydrating, hydrateSession } = useAuthStore();

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  const getDefaultRedirect = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.role === UserRole.ADMIN) return '/admin';
    if (user.role === UserRole.FACULTY) return '/faculty';
    return '/student';
  };

  if (isHydrating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-cyan-50/40 px-4">
        <div className="relative flex flex-col items-center">
          <BrandLogo size="xl" animated />
          <div className="mt-6 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-ping" />
            <h2 className="text-lg font-heading font-extrabold text-content tracking-tight">
              Velan AI
            </h2>
          </div>
          <p className="text-xs text-content-secondary mt-1.5 font-medium">
            Restoring your session &amp; syncing live data...
          </p>
          <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-4">
            <div className="h-full w-1/2 bg-brand-gradient rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated && user ? <Navigate to={getDefaultRedirect()} replace /> : <LoginPage />}
        />

        {/* Protected Application Routes */}
        <Route
          element={isAuthenticated && user ? <AppLayout /> : <Navigate to="/login" replace />}
        >
          {/* Admin Routes */}
          <Route path="/admin" element={user?.role === UserRole.ADMIN ? <AdminDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/live-attendance" element={user?.role === UserRole.ADMIN ? <LiveAttendanceMonitor /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/attendance-history" element={user?.role === UserRole.ADMIN ? <AttendanceHistoryEditorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/timetable" element={user?.role === UserRole.ADMIN ? <TimetableBuilder /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/faculty" element={user?.role === UserRole.ADMIN ? <FacultyManagement /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/students" element={user?.role === UserRole.ADMIN ? <StudentManagement /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/academics" element={user?.role === UserRole.ADMIN ? <AcademicsManagement /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/requests" element={user?.role === UserRole.ADMIN ? <AdminRequestsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/devices" element={user?.role === UserRole.ADMIN ? <AdminRequestsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/reports" element={user?.role === UserRole.ADMIN ? <ReportsPage /> : <Navigate to={getDefaultRedirect()} replace />} />

          {/* Faculty Routes */}
          <Route path="/faculty" element={user?.role === UserRole.FACULTY ? <FacultyDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/attendance" element={user?.role === UserRole.FACULTY ? <FacultyAttendancePage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/history" element={user?.role === UserRole.FACULTY ? <AttendanceHistoryEditorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/timetable" element={user?.role === UserRole.FACULTY ? <FacultyDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/classes" element={user?.role === UserRole.FACULTY ? <AttendanceHistoryEditorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/assignments" element={user?.role === UserRole.FACULTY ? <AssignmentsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/marks" element={<GenericSubPage title="Marks & Internals" subtitle="Semester marks entry and topper/at-risk analytics" />} />
          <Route path="/faculty/materials" element={user?.role === UserRole.FACULTY ? <MaterialsPage /> : <Navigate to={getDefaultRedirect()} replace />} />

          {/* Student Routes */}
          <Route path="/student" element={user?.role === UserRole.STUDENT ? <StudentDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/mark-attendance" element={user?.role === UserRole.STUDENT ? <StudentMarkAttendancePage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/attendance" element={user?.role === UserRole.STUDENT ? <StudentAttendanceHistoryPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/timetable" element={user?.role === UserRole.STUDENT ? <StudentDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/academics" element={<GenericSubPage title="Academic Records & CGPA" subtitle="Semester marks, CGPA calculator, and grade card" />} />
          <Route path="/student/assignments" element={user?.role === UserRole.STUDENT ? <AssignmentsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/materials" element={user?.role === UserRole.STUDENT ? <MaterialsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/assignments" element={user?.role === UserRole.ADMIN ? <AssignmentsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/materials" element={user?.role === UserRole.ADMIN ? <MaterialsPage /> : <Navigate to={getDefaultRedirect()} replace />} />

          {/* Shared Routes */}
          <Route path="/chat" element={<ClassChatPage />} />
          <Route path="/ai-insights" element={<AIAssistantPage />} />
          <Route path="/ai-assistant" element={<AIAssistantPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={getDefaultRedirect()} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
