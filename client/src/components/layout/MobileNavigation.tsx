import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { getRoleNavItems } from './navConfig';
import { SidebarFooter } from './SidebarFooter';
import { acquireScrollLock } from '@/utils/scrollLock';
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
  hideBottomBar?: boolean;
}

const DRAWER_TRANSITION_MS = 200;

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onOpen, onClose, hideBottomBar = false }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const role = user?.role || UserRole.STUDENT;
  const navItems = getRoleNavItems(role);

  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);

  const pushedHistoryRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Deterministic mount/unmount with <250ms CSS slide transition (avoids stuck AnimatePresence exit)
  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement as HTMLElement | null;
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => {
      setIsRendered(false);
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
        openerRef.current = null;
      }
    }, DRAWER_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Safety net: any route or query change closes the drawer and scrolls to top
  useEffect(() => {
    pushedHistoryRef.current = false;
    onCloseRef.current();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  // Dismiss via UI controls (X, backdrop, Esc, swipe-left): pop dummy history entry if present
  const dismissDrawer = useCallback(() => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      if (window.history.state?.velanMobileMenu) {
        window.history.back();
      }
    }
    onCloseRef.current();
  }, []);

  // Dismiss via navigation item tap: never call history.back() so the new route stays
  const closeOnNavigate = useCallback(() => {
    pushedHistoryRef.current = false;
    onCloseRef.current();
  }, []);

  // Body scroll lock, Escape key, focus trap, and phone Back button (popstate)
  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      return;
    }

    const releaseLock = acquireScrollLock();

    if (!pushedHistoryRef.current && !window.history.state?.velanMobileMenu) {
      window.history.pushState({ velanMobileMenu: true }, '');
      pushedHistoryRef.current = true;
    }

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const onPopState = () => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onCloseRef.current();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissDrawer();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      releaseLock();
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, dismissDrawer]);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      dismissDrawer();
    }
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
      {!hideBottomBar && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden fixed inset-x-4 z-40 touch-manipulation"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        >
        <div className="flex items-center justify-around px-2 py-2 bg-white/95 backdrop-blur-xl border border-border/90 rounded-full shadow-2xl max-w-md mx-auto">
          {bottomLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to.split('/').length <= 2}
              onClick={closeOnNavigate}
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
      )}

      {/* Mobile Full Navigation Drawer */}
      {isRendered && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
          aria-hidden={!isVisible}
          className={clsx(
            'fixed inset-0 z-50 lg:hidden flex',
            isVisible ? 'pointer-events-auto' : 'pointer-events-none'
          )}
        >
          <div
            onClick={dismissDrawer}
            aria-hidden="true"
            className={clsx(
              'fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ease-out',
              isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
          />
          <aside
            ref={drawerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={clsx(
              'relative z-10 w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ease-out will-change-transform',
              isVisible ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
            )}
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
                ref={closeButtonRef}
                type="button"
                onClick={dismissDrawer}
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
                  onClick={closeOnNavigate}
                  style={{ touchAction: 'manipulation' }}
                  className={({ isActive }) =>
                    clsx(
                      'min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors touch-manipulation',
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
                  closeOnNavigate();
                  logout();
                }}
                style={{ touchAction: 'manipulation' }}
                className="min-h-[44px] w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-50 text-rose-700 font-semibold text-xs hover:bg-rose-100 touch-manipulation"
              >
                <LogOut className="w-4 h-4" />
                Sign Out ({user?.name})
              </button>
            </div>
            <SidebarFooter withSafeArea />
          </aside>
        </div>
      )}
    </>
  );
};
