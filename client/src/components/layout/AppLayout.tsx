import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomBar } from './BottomBar';
import { Modal } from '@/components/ui/Modal';
import { Command, Search, Sparkles, CalendarCheck2, Users, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export const AppLayout: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

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
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Desktop Floating Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-10">
          <Header
            onOpenCommandPalette={() => setIsCommandOpen(true)}
            onOpenNotifications={() => setIsNotificationOpen(true)}
          />

          <main className="flex-1 px-4 sm:px-8 py-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Floating Bottom Bar */}
      <BottomBar />

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
