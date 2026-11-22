import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import {
  LayoutDashboard,
  CalendarCheck2,
  CalendarDays,
  Users,
  GraduationCap,
  BookOpen,
  MessageSquare,
  FileSpreadsheet,
  Settings,
  Sparkles,
  ClipboardList,
  FolderOpen,
  Award,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role || UserRole.ADMIN;

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/admin/live-attendance', label: 'Live Attendance', icon: <CalendarCheck2 className="w-5 h-5" /> },
          { to: '/admin/timetable', label: 'Timetable Builder', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/admin/faculty', label: 'Faculty Directory', icon: <Users className="w-5 h-5" /> },
          { to: '/admin/students', label: 'Students Directory', icon: <GraduationCap className="w-5 h-5" /> },
          { to: '/admin/academics', label: 'Classes & Subjects', icon: <BookOpen className="w-5 h-5" /> },
          { to: '/admin/requests', label: 'Requests & Approvals', icon: <ClipboardList className="w-5 h-5" /> },
          { to: '/admin/reports', label: 'Reports & Excel', icon: <FileSpreadsheet className="w-5 h-5" /> },
          { to: '/chat', label: 'Class Chat', icon: <MessageSquare className="w-5 h-5" /> },
          { to: '/ai-insights', label: 'AI Intelligence', icon: <Sparkles className="w-5 h-5" /> },
          { to: '/settings', label: 'System Settings', icon: <Settings className="w-5 h-5" /> },
        ];
      case UserRole.FACULTY:
        return [
          { to: '/faculty', label: 'Today & Classes', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/faculty/attendance', label: 'Take Attendance', icon: <CalendarCheck2 className="w-5 h-5" /> },
          { to: '/faculty/timetable', label: 'My Timetable', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/faculty/classes', label: 'My Classes', icon: <GraduationCap className="w-5 h-5" /> },
          { to: '/faculty/assignments', label: 'Assignments', icon: <ClipboardList className="w-5 h-5" /> },
          { to: '/faculty/marks', label: 'Marks & Internal', icon: <Award className="w-5 h-5" /> },
          { to: '/faculty/materials', label: 'Study Materials', icon: <FolderOpen className="w-5 h-5" /> },
          { to: '/chat', label: 'Class Chat', icon: <MessageSquare className="w-5 h-5" /> },
          { to: '/ai-insights', label: 'AI Insights', icon: <Sparkles className="w-5 h-5" /> },
        ];
      case UserRole.STUDENT:
        return [
          { to: '/student', label: 'Home Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/student/mark-attendance', label: 'Mark Attendance', icon: <CalendarCheck2 className="w-5 h-5" /> },
          { to: '/student/attendance', label: 'Attendance & Heatmap', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/student/timetable', label: 'Timetable', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/student/academics', label: 'Academics & CGPA', icon: <Award className="w-5 h-5" /> },
          { to: '/student/assignments', label: 'Assignments', icon: <ClipboardList className="w-5 h-5" /> },
          { to: '/student/materials', label: 'Materials Library', icon: <FolderOpen className="w-5 h-5" /> },
          { to: '/chat', label: 'Class Chat', icon: <MessageSquare className="w-5 h-5" /> },
          { to: '/ai-assistant', label: 'AI Study Assistant', icon: <Sparkles className="w-5 h-5" /> },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-2rem)] sticky top-4 my-4 ml-4 bg-white/90 backdrop-blur-xl border border-border rounded-3xl shadow-glass overflow-hidden z-20 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border/80">
        <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-md shadow-brand-500/25 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading font-extrabold text-xl tracking-tight text-content flex items-center gap-1.5">
            Velan <span className="bg-clip-text text-transparent bg-brand-gradient">AI</span>
          </h2>
          <p className="text-[11px] font-medium text-content-secondary tracking-wide uppercase">
            {role} Portal
          </p>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length <= 2}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 select-none group',
                isActive
                  ? 'bg-brand-gradient text-white shadow-glass'
                  : 'text-content-secondary hover:text-content hover:bg-surface-soft'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'transition-colors',
                    isActive ? 'text-white' : 'text-content-muted group-hover:text-brand-500'
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer Pill */}
      <div className="p-4 border-t border-border/80 bg-surface-soft/60">
        <div className="flex items-center justify-between text-xs text-content-secondary px-2">
          <span>v1.0 • Enterprise</span>
          <span className="flex items-center gap-1 text-accent-emerald font-semibold">
            <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" /> Live System
          </span>
        </div>
      </div>
    </aside>
  );
};
