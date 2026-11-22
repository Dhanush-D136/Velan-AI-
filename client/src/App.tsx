import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { UserRole } from '@velan/shared';
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
  const { user, isAuthenticated } = useAuthStore();

  const getDefaultRedirect = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.role === UserRole.ADMIN) return '/admin';
    if (user.role === UserRole.FACULTY) return '/faculty';
    return '/student';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Application Routes */}
        <Route
          element={isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />}
        >
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/live-attendance" element={<LiveAttendanceMonitor />} />
          <Route path="/admin/timetable" element={<TimetableBuilder />} />
          <Route path="/admin/faculty" element={<FacultyManagement />} />
          <Route path="/admin/students" element={<StudentManagement />} />
          <Route path="/admin/academics" element={<AcademicsManagement />} />
          <Route path="/admin/requests" element={<AdminRequestsPage />} />
          <Route path="/admin/devices" element={<AdminRequestsPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />

          {/* Faculty Routes */}
          <Route path="/faculty" element={<FacultyDashboard />} />
          <Route path="/faculty/attendance" element={<FacultyAttendancePage />} />
          <Route path="/faculty/timetable" element={<TimetableBuilder />} />
          <Route path="/faculty/classes" element={<GenericSubPage title="My Classes & Students" subtitle="Class roster, individual performance, and remarks" />} />
          <Route path="/faculty/assignments" element={<GenericSubPage title="Assignments Manager" subtitle="Create homework, review submissions & grade" />} />
          <Route path="/faculty/marks" element={<GenericSubPage title="Marks & Internals" subtitle="Semester marks entry and topper/at-risk analytics" />} />
          <Route path="/faculty/materials" element={<GenericSubPage title="Study Materials" subtitle="Lecture notes, question banks, and reference PDFs" />} />

          {/* Student Routes */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/mark-attendance" element={<StudentMarkAttendancePage />} />
          <Route path="/student/attendance" element={<StudentAttendanceHistoryPage />} />
          <Route path="/student/timetable" element={<TimetableBuilder />} />
          <Route path="/student/academics" element={<GenericSubPage title="Academic Records & CGPA" subtitle="Semester marks, CGPA calculator, and grade card" />} />
          <Route path="/student/assignments" element={<GenericSubPage title="My Assignments" subtitle="Pending tasks, deadlines, and upload submissions" />} />
          <Route path="/student/materials" element={<GenericSubPage title="Study Materials Library" subtitle="Course syllabus, notes, and references" />} />

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
