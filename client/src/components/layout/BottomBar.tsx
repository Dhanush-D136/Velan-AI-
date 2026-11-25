import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import {
  LayoutDashboard,
  CalendarCheck2,
  CalendarDays,
  MessageSquare,
  History,
  Menu,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface BottomBarProps {
  onOpenMobileMenu?: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ onOpenMobileMenu }) => {
  const { user } = useAuthStore();
  const role = user?.role || UserRole.STUDENT;

  const getNavLinks = () => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          { to: '/admin', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/admin/live-attendance', label: 'Live', icon: <CalendarCheck2 className="w-5 h-5" /> },
          { to: '/admin/attendance-history', label: 'Edit Att.', icon: <History className="w-5 h-5" /> },
          { to: '/admin/timetable', label: 'Timetable', icon: <CalendarDays className="w-5 h-5" /> },
        ];
      case UserRole.FACULTY:
        return [
          { to: '/faculty', label: 'Today', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/faculty/attendance', label: 'Take GPS', icon: <CalendarCheck2 className="w-5 h-5" />, isAction: true },
          { to: '/faculty/history', label: 'Saved', icon: <History className="w-5 h-5" /> },
          { to: '/chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
        ];
      case UserRole.STUDENT:
      default:
        return [
          { to: '/student', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
          { to: '/student/mark-attendance', label: 'Mark GPS', icon: <CalendarCheck2 className="w-5 h-5" />, isAction: true },
          { to: '/student/attendance', label: 'History', icon: <History className="w-5 h-5" /> },
          { to: '/chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
        ];
    }
  };

  const links = getNavLinks();

  return (
    <nav className="lg:hidden fixed bottom-4 inset-x-4 z-40">
      <div className="flex items-center justify-around px-2 py-2 bg-white/95 backdrop-blur-xl border border-border/90 rounded-full shadow-2xl max-w-md mx-auto">
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

        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center p-2 rounded-2xl transition-all select-none text-content-secondary hover:text-brand-600"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">All</span>
        </button>
      </div>
    </nav>
  );
};
