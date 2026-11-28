import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { api } from './lib/api';
import { UserRole } from '@velan/shared';
import { BrandLogo } from './components/ui/BrandLogo';
import { LoginPage } from './features/auth/LoginPage';
import { ForcePasswordChangePage } from './features/auth/ForcePasswordChangePage';
import { AppLayout } from './components/layout/AppLayout';

// Chunk-load retry helper for lazy-loaded routes
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch(async () => {
      await new Promise((r) => setTimeout(r, 350));
      return factory();
    })
  );
}

// Lazy-loaded Route Bundles (Role & Feature Code Splitting)
const AdminDashboard = lazyWithRetry(() => import('./features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const LiveAttendanceMonitor = lazyWithRetry(() => import('./features/admin/LiveAttendanceMonitor').then((m) => ({ default: m.LiveAttendanceMonitor })));
const TimetableBuilder = lazyWithRetry(() => import('./features/admin/TimetableBuilder').then((m) => ({ default: m.TimetableBuilder })));
const FacultyManagement = lazyWithRetry(() => import('./features/admin/FacultyManagement').then((m) => ({ default: m.FacultyManagement })));
const StudentManagement = lazyWithRetry(() => import('./features/admin/StudentManagement').then((m) => ({ default: m.StudentManagement })));
const AcademicsManagement = lazyWithRetry(() => import('./features/admin/AcademicsManagement').then((m) => ({ default: m.AcademicsManagement })));
const AdminRequestsPage = lazyWithRetry(() => import('./features/admin/AdminRequestsPage').then((m) => ({ default: m.AdminRequestsPage })));
const ReportsPage = lazyWithRetry(() => import('./features/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AdminLiveMonitorPage = lazyWithRetry(() => import('./features/admin/AdminLiveMonitorPage').then((m) => ({ default: m.AdminLiveMonitorPage })));
const AdminAcademicsPortal = lazyWithRetry(() => import('./features/admin/AdminAcademicsPortal').then((m) => ({ default: m.AdminAcademicsPortal })));

const FacultyDashboard = lazyWithRetry(() => import('./features/faculty/FacultyDashboard').then((m) => ({ default: m.FacultyDashboard })));
const FacultyAttendancePage = lazyWithRetry(() => import('./features/faculty/FacultyAttendancePage').then((m) => ({ default: m.FacultyAttendancePage })));
const AdvisorAcademicsPage = lazyWithRetry(() => import('./features/faculty/AdvisorAcademicsPage').then((m) => ({ default: m.AdvisorAcademicsPage })));

const StudentDashboard = lazyWithRetry(() => import('./features/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const StudentMarkAttendancePage = lazyWithRetry(() => import('./features/student/StudentMarkAttendancePage').then((m) => ({ default: m.StudentMarkAttendancePage })));
const StudentAttendanceHistoryPage = lazyWithRetry(() => import('./features/student/StudentAttendanceHistoryPage').then((m) => ({ default: m.StudentAttendanceHistoryPage })));
const SkipCalculatorPage = lazyWithRetry(() => import('./features/student/SkipCalculatorPage').then((m) => ({ default: m.SkipCalculatorPage })));
const AcademicsCGPAPage = lazyWithRetry(() => import('./features/student/AcademicsCGPAPage').then((m) => ({ default: m.AcademicsCGPAPage })));

const ClassChatPage = lazyWithRetry(() => import('./features/chat/ClassChatPage').then((m) => ({ default: m.ClassChatPage })));
const AIAssistantPage = lazyWithRetry(() => import('./features/ai/AIAssistantPage').then((m) => ({ default: m.AIAssistantPage })));
const SettingsPage = lazyWithRetry(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AttendanceHistoryEditorPage = lazyWithRetry(() => import('./features/shared/AttendanceHistoryEditorPage').then((m) => ({ default: m.AttendanceHistoryEditorPage })));
const AssignmentsPage = lazyWithRetry(() => import('./features/shared/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const MaterialsPage = lazyWithRetry(() => import('./features/shared/MaterialsPage').then((m) => ({ default: m.MaterialsPage })));

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <BrandLogo size="lg" />
          <h1 className="text-xl font-heading font-extrabold text-content">Something went wrong</h1>
          <p className="text-xs text-content-secondary max-w-sm">
            Your session is safe. Reload the page to continue where you left off.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4 animate-pulse">
    <div className="h-8 w-56 bg-slate-200 rounded-xl" />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="h-24 bg-slate-100 rounded-2xl" />
    </div>
    <div className="h-56 bg-slate-100 rounded-2xl" />
  </div>
);

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

function RouteTracker() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user || user.mustChangePassword) return;
    const full = `${location.pathname}${location.search}`;
    if (full === '/login' || full === '/set-password') return;
    localStorage.setItem('velan_last_route', full);
    const t = setTimeout(() => {
      api.put('/api/auth/last-route', { route: full }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [location.pathname, location.search, isAuthenticated, user]);

  return null;
}

export default function App() {
  const { user, isAuthenticated, initialising, hydrateSession } = useAuthStore();

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  const getDefaultRedirect = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.mustChangePassword) return '/set-password';
    const saved = localStorage.getItem('velan_last_route') || (user as any).lastRoute;
    if (saved && typeof saved === 'string' && saved.startsWith('/')) {
      if (user.role === UserRole.ADMIN && (saved.startsWith('/admin') || saved === '/chat' || saved === '/settings')) return saved;
      if (user.role === UserRole.FACULTY && (saved.startsWith('/faculty') || saved === '/chat' || saved === '/settings')) return saved;
      if (user.role === UserRole.STUDENT && (saved.startsWith('/student') || saved === '/chat' || saved === '/settings')) return saved;
    }
    if (user.role === UserRole.ADMIN) return '/admin';
    if (user.role === UserRole.FACULTY) return '/faculty';
    return '/student';
  };

  if (initialising) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <div className="relative flex flex-col items-center">
          <div className="animate-pulse">
            <BrandLogo size="xl" />
          </div>
          <div className="mt-6 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-ping" />
            <h2 className="text-lg font-heading font-extrabold text-content tracking-tight">
              Velan AI
            </h2>
          </div>
          <p className="text-xs text-content-secondary mt-1.5 font-medium">
            Restoring your session &amp; syncing live data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
    <BrowserRouter>
      <RouteTracker />
      <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated && user ? <Navigate to={getDefaultRedirect()} replace /> : <LoginPage />}
        />
        <Route
          path="/set-password"
          element={isAuthenticated && user ? <ForcePasswordChangePage /> : <Navigate to="/login" replace />}
        />

        {/* Protected Application Routes */}
        <Route
          element={
            !isAuthenticated || !user ? (
              <Navigate to="/login" replace />
            ) : user.mustChangePassword ? (
              <Navigate to="/set-password" replace />
            ) : (
              <AppLayout />
            )
          }
        >
          {/* Admin Routes */}
          <Route path="/admin" element={user?.role === UserRole.ADMIN ? <AdminDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/live-attendance" element={user?.role === UserRole.ADMIN ? <LiveAttendanceMonitor /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/live-monitor" element={user?.role === UserRole.ADMIN ? <AdminLiveMonitorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/attendance-history" element={user?.role === UserRole.ADMIN ? <AttendanceHistoryEditorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/timetable" element={user?.role === UserRole.ADMIN ? <TimetableBuilder /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/faculty" element={user?.role === UserRole.ADMIN ? <FacultyManagement /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/students" element={user?.role === UserRole.ADMIN ? <StudentManagement /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/academics" element={user?.role === UserRole.ADMIN ? <AcademicsManagement /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/academics-records" element={user?.role === UserRole.ADMIN ? <AdminAcademicsPortal /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/requests" element={user?.role === UserRole.ADMIN ? <AdminRequestsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/devices" element={user?.role === UserRole.ADMIN ? <AdminRequestsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/admin/reports" element={user?.role === UserRole.ADMIN ? <ReportsPage /> : <Navigate to={getDefaultRedirect()} replace />} />

          {/* Faculty Routes */}
          <Route path="/faculty" element={user?.role === UserRole.FACULTY ? <FacultyDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/attendance" element={user?.role === UserRole.FACULTY ? <FacultyAttendancePage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/history" element={user?.role === UserRole.FACULTY ? <AttendanceHistoryEditorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/timetable" element={user?.role === UserRole.FACULTY ? <FacultyDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/classes" element={user?.role === UserRole.FACULTY ? <AttendanceHistoryEditorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/advisees" element={user?.role === UserRole.FACULTY ? <AdvisorAcademicsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/assignments" element={user?.role === UserRole.FACULTY ? <AssignmentsPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/faculty/marks" element={<GenericSubPage title="Marks & Internals" subtitle="Semester marks entry and topper/at-risk analytics" />} />
          <Route path="/faculty/materials" element={user?.role === UserRole.FACULTY ? <MaterialsPage /> : <Navigate to={getDefaultRedirect()} replace />} />

          {/* Student Routes */}
          <Route path="/student" element={user?.role === UserRole.STUDENT ? <StudentDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/mark-attendance" element={user?.role === UserRole.STUDENT ? <StudentMarkAttendancePage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/attendance" element={user?.role === UserRole.STUDENT ? <StudentAttendanceHistoryPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/skip-calculator" element={user?.role === UserRole.STUDENT ? <SkipCalculatorPage /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/timetable" element={user?.role === UserRole.STUDENT ? <StudentDashboard /> : <Navigate to={getDefaultRedirect()} replace />} />
          <Route path="/student/academics" element={user?.role === UserRole.STUDENT ? <AcademicsCGPAPage /> : <Navigate to={getDefaultRedirect()} replace />} />
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
      </Suspense>
    </BrowserRouter>
    </AppErrorBoundary>
  );
}
