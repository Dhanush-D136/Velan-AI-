import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import {
  LayoutDashboard,
  CalendarCheck2,
  CalendarDays,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';

export const BottomBar: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role || UserRole.STUDENT;

  const getNavLinks = () => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          { to: '/admin', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/admin/live-attendance', label: 'Live', icon: <CalendarCheck2 className="w-5 h-5" /> },
          { to: '/admin/timetable', label: 'Timetable', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
          { to: '/ai-insights', label: 'AI', icon: <Sparkles className="w-5 h-5" /> },
        ];
      case UserRole.FACULTY:
        return [
          { to: '/faculty', label: 'Today', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/faculty/attendance', label: 'Take GPS', icon: <CalendarCheck2 className="w-5 h-5" />, isAction: true },
          { to: '/faculty/timetable', label: 'Timetable', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
        ];
      case UserRole.STUDENT:
      default:
        return [
          { to: '/student', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/student/mark-attendance', label: 'Mark GPS', icon: <CalendarCheck2 className="w-5 h-5" />, isAction: true },
          { to: '/student/attendance', label: 'History', icon: <CalendarDays className="w-5 h-5" /> },
          { to: '/chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
          { to: '/ai-assistant', label: 'AI Tutor', icon: <Sparkles className="w-5 h-5" /> },
        ];
    }
  };

  const links = getNavLinks();

  return (
    <nav className="lg:hidden fixed bottom-4 inset-x-4 z-40">
      <div className="flex items-center justify-around px-3 py-2 bg-white/95 backdrop-blur-xl border border-border/90 rounded-full shadow-2xl max-w-md mx-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to.split('/').length <= 2}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center p-2 rounded-2xl transition-all select-none',
                link.isAction
                  ? 'bg-brand-gradient text-white shadow-glass px-4 -my-3 scale-105'
                  : isActive
                  ? 'text-brand-600 font-bold'
                  : 'text-content-secondary hover:text-content'
              )
            }
          >
            {link.icon}
            <span className="text-[10px] mt-0.5 font-medium">{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
