import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomBar } from './BottomBar';
import { getRoleNavItems } from './navConfig';
import { Modal } from '@/components/ui/Modal';
import { Command, Search, Sparkles, CalendarCheck2, Users, FileText, Loader2, X, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

export const AppLayout: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServerWaking, setIsServerWaking] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const mobileNavItems = getRoleNavItems(user?.role);

  // Free-tier server wake-up monitor
  useEffect(() => {
    let isCancelled = false;
    let timer: any = null;

    const checkServerHealth = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2500)
        );
        await Promise.race([api.get('/health'), timeoutPromise]);
        if (!isCancelled) setIsServerWaking(false);
      } catch (e) {
        if (!isCancelled) {
          setIsServerWaking(true);
          timer = setTimeout(checkServerHealth, 3000);
        }
      }
    };

    checkServerHealth();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Listen for Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commands = [
    { label: 'Take GPS Attendance Session', icon: <CalendarCheck2 className="w-4 h-4 text-brand-500" />, action: () => navigate(user?.role === 'FACULTY' ? '/faculty/attendance' : '/admin/live-attendance') },
    { label: 'Live Attendance Monitor', icon: <CalendarCheck2 className="w-4 h-4 text-emerald-500" />, action: () => navigate('/admin/live-attendance') },
    { label: 'Timetable Builder', icon: <FileText className="w-4 h-4 text-indigo-500" />, action: () => navigate('/admin/timetable') },
    { label: 'Student Directory', icon: <Users className="w-4 h-4 text-cyan-500" />, action: () => navigate('/admin/students') },
    { label: 'AI Attendance Insights', icon: <Sparkles className="w-4 h-4 text-pink-500" />, action: () => navigate('/ai-insights') },
    { label: 'Class Chat Room', icon: <Search className="w-4 h-4 text-amber-500" />, action: () => navigate('/chat') },
  ];

  const filteredCommands = commands.filter((c) =>
    c.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white flex flex-col antialiased">
      {/* Calm free-tier waking up server banner */}
      {isServerWaking && (
        <div className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-sm animate-pulse z-50">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Waking up server, please wait…</span>
        </div>
      )}

      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Desktop Floating Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-10">
          <Header
            onOpenCommandPalette={() => setIsCommandOpen(true)}
            onOpenNotifications={() => setIsNotificationOpen(true)}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          />

          <main className="flex-1 px-4 sm:px-8 py-6 portal-pattern-grid">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>

      {/* Mobile Floating Bottom Bar */}
      <BottomBar onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

      {/* Mobile Full Navigation Drawer (all desktop options accessible on mobile) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative z-10 w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-heading font-extrabold text-lg text-content">Velan AI</h2>
                    <p className="text-[10px] font-bold uppercase text-content-secondary">
                      {user?.role} Portal
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-content-secondary hover:bg-surface-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {mobileNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to.split('/').length <= 2}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all',
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
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-50 text-rose-700 font-semibold text-xs hover:bg-rose-100"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out ({user?.name})
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Command Palette (Ctrl+K) */}
      <Modal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        size="md"
        showCloseButton={false}
      >
        <div className="p-2">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
            <Search className="w-5 h-5 text-brand-500" />
            <input
              type="text"
              autoFocus
              placeholder="Type a command or natural language search..."
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-content-muted"
            />
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-100 rounded text-content-muted">
              ESC
            </span>
          </div>

          <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
            {filteredCommands.length > 0 ? (
              filteredCommands.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => {
                    cmd.action();
                    setIsCommandOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-content hover:bg-brand-50/70 hover:text-brand-600 transition-colors text-left"
                >
                  {cmd.icon}
                  <span>{cmd.label}</span>
                </button>
              ))
            ) : (
              <p className="p-4 text-center text-xs text-content-muted">No matches found</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Notifications Drawer/Modal */}
      <Modal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        title="Notifications Center"
        description="Stay updated with attendance, timetable changes & alerts"
        size="sm"
      >
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-brand-50/60 border border-brand-200/60 flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-brand-500 mt-2 shrink-0 animate-ping" />
            <div>
              <p className="text-xs font-bold text-brand-900">Attendance Session Active</p>
              <p className="text-xs text-content-secondary mt-0.5">
                Data Structures (CS301) attendance window is open. 8 minutes remaining.
              </p>
              <span className="text-[10px] text-content-muted mt-1 block">Just now</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-surface-soft border border-border flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-accent-emerald mt-2 shrink-0" />
            <div>
              <p className="text-xs font-bold text-content">Timetable Published</p>
              <p className="text-xs text-content-secondary mt-0.5">
                CSE 2nd Year Section A timetable has been updated by Admin.
              </p>
              <span className="text-[10px] text-content-muted mt-1 block">2 hours ago</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
