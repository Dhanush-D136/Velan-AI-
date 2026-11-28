import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { getRoleNavItems } from './navConfig';
import {
  LayoutDashboard,
  CalendarCheck2,
  CalendarDays,
  MessageSquare,
  History,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';

interface MobileNavigationProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onOpen, onClose }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const role = user?.role || UserRole.STUDENT;
  const navItems = getRoleNavItems(role);
  const pushedHistoryRef = useRef(false);

  // Close drawer and scroll new page to top on every route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Body scroll lock + Back button (popstate) closes menu first
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
      }
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (!pushedHistoryRef.current) {
      window.history.pushState({ velanMobileMenu: true }, '');
      pushedHistoryRef.current = true;
    }

    const onPopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onClose();
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('popstate', onPopState);
    };
  }, [isOpen, onClose]);

  const handleCloseButton = () => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    }
    onClose();
  };

  const getBottomLinks = () => {
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

  const bottomLinks = getBottomLinks();

  return (
    <>
      {/* Mobile Floating Bottom Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-4 inset-x-4 z-40 touch-manipulation"
      >
        <div className="flex items-center justify-around px-2 py-2 bg-white/95 backdrop-blur-xl border border-border/90 rounded-full shadow-2xl max-w-md mx-auto">
          {bottomLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to.split('/').length <= 2}
              style={{ touchAction: 'manipulation' }}
              className={({ isActive }) =>
                clsx(
                  'min-h-[44px] min-w-[44px] flex flex-col items-center justify-center p-2 rounded-2xl transition-all select-none touch-manipulation',
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
            type="button"
            onClick={onOpen}
            aria-label="Open all menu options"
            aria-expanded={isOpen}
            style={{ touchAction: 'manipulation' }}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center p-2 rounded-2xl transition-all select-none text-content-secondary hover:text-brand-600 touch-manipulation"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">All</span>
          </button>
        </div>
      </nav>

      {/* Mobile Full Navigation Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
            className="fixed inset-0 z-50 lg:hidden flex"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={handleCloseButton}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%', pointerEvents: 'none' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <BrandLogo size="sm" />
                  <div>
                    <h2 className="font-heading font-extrabold text-lg text-content">Velan AI</h2>
                    <p className="text-[10px] font-bold uppercase text-content-secondary">
                      {role} Portal
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseButton}
                  aria-label="Close mobile menu"
                  style={{ touchAction: 'manipulation' }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-content-secondary hover:bg-surface-muted touch-manipulation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to.split('/').length <= 2}
                    onClick={onClose}
                    style={{ touchAction: 'manipulation' }}
                    className={({ isActive }) =>
                      clsx(
                        'min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all touch-manipulation',
                        isActive
                          ? 'bg-brand-gradient text-white shadow-md'
                          : 'text-content-secondary hover:text-content hover:bg-surface-soft'
                      )
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="p-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  style={{ touchAction: 'manipulation' }}
                  className="min-h-[44px] w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-50 text-rose-700 font-semibold text-xs hover:bg-rose-100 touch-manipulation"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out ({user?.name})
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
