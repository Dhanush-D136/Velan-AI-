import React from 'react';
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
  History,
  Calculator,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export const getRoleNavItems = (role?: UserRole): NavItem[] => {
  switch (role) {
    case UserRole.ADMIN:
      return [
        { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { to: '/admin/live-attendance', label: 'Live Attendance', icon: <CalendarCheck2 className="w-5 h-5" /> },
        { to: '/admin/live-monitor', label: 'Live Monitor', icon: <ClipboardList className="w-5 h-5" /> },
        { to: '/admin/attendance-history', label: 'Edit & Past Attendance', icon: <History className="w-5 h-5" /> },
        { to: '/admin/timetable', label: 'Timetable Builder', icon: <CalendarDays className="w-5 h-5" /> },
        { to: '/admin/faculty', label: 'Faculty Directory', icon: <Users className="w-5 h-5" /> },
        { to: '/admin/students', label: 'Students Directory', icon: <GraduationCap className="w-5 h-5" /> },
        { to: '/admin/academics', label: 'Classes & Subjects', icon: <BookOpen className="w-5 h-5" /> },
        { to: '/admin/academics-records', label: 'Academics & Grading', icon: <Award className="w-5 h-5" /> },
        { to: '/admin/requests', label: 'Requests & Approvals', icon: <ClipboardList className="w-5 h-5" /> },
        { to: '/admin/reports', label: 'Reports & Excel', icon: <FileSpreadsheet className="w-5 h-5" /> },
        { to: '/chat', label: 'Class Chat', icon: <MessageSquare className="w-5 h-5" /> },
        { to: '/ai-insights', label: 'AI Intelligence', icon: <Sparkles className="w-5 h-5" /> },
        { to: '/settings', label: 'System Settings', icon: <Settings className="w-5 h-5" /> },
      ];
    case UserRole.FACULTY:
      return [
        { to: '/faculty', label: 'Today & Classes', icon: <LayoutDashboard className="w-5 h-5" /> },
        { to: '/faculty/attendance', label: 'Take GPS Attendance', icon: <CalendarCheck2 className="w-5 h-5" /> },
        { to: '/faculty/history', label: 'Saved & Past Attendance', icon: <History className="w-5 h-5" /> },
        { to: '/faculty/timetable', label: 'My Timetable', icon: <CalendarDays className="w-5 h-5" /> },
        { to: '/faculty/classes', label: 'My Classes', icon: <GraduationCap className="w-5 h-5" /> },
        { to: '/faculty/advisees', label: 'My Advisees / Academics', icon: <Award className="w-5 h-5" /> },
        { to: '/faculty/assignments', label: 'Assignments', icon: <ClipboardList className="w-5 h-5" /> },
        { to: '/faculty/marks', label: 'Marks & Internal', icon: <Award className="w-5 h-5" /> },
        { to: '/faculty/materials', label: 'Study Materials', icon: <FolderOpen className="w-5 h-5" /> },
        { to: '/chat', label: 'Class Chat', icon: <MessageSquare className="w-5 h-5" /> },
        { to: '/ai-insights', label: 'AI Insights', icon: <Sparkles className="w-5 h-5" /> },
        { to: '/settings', label: 'Profile & Settings', icon: <Settings className="w-5 h-5" /> },
      ];
    case UserRole.STUDENT:
    default:
      return [
        { to: '/student', label: 'Home Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        { to: '/student/mark-attendance', label: 'Mark GPS Attendance', icon: <CalendarCheck2 className="w-5 h-5" /> },
        { to: '/student/attendance', label: 'Attendance History', icon: <History className="w-5 h-5" /> },
        { to: '/student/skip-calculator', label: 'Can I Skip?', icon: <Calculator className="w-5 h-5" /> },
        { to: '/student/timetable', label: 'Class Timetable', icon: <CalendarDays className="w-5 h-5" /> },
        { to: '/student/academics', label: 'Academics & CGPA', icon: <Award className="w-5 h-5" /> },
        { to: '/student/assignments', label: 'Assignments', icon: <ClipboardList className="w-5 h-5" /> },
        { to: '/student/materials', label: 'Materials Library', icon: <FolderOpen className="w-5 h-5" /> },
        { to: '/chat', label: 'Class Chat', icon: <MessageSquare className="w-5 h-5" /> },
        { to: '/ai-assistant', label: 'AI Study Assistant', icon: <Sparkles className="w-5 h-5" /> },
        { to: '/settings', label: 'Profile & Settings', icon: <Settings className="w-5 h-5" /> },
      ];
  }
};
