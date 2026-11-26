import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomBar } from './BottomBar';
import { getRoleNavItems } from './navConfig';
import { Modal } from '@/components/ui/Modal';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Command, Search, Sparkles, CalendarCheck2, Users, FileText, Loader2, X, LogOut, Bell, CheckCheck, Smartphone } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { useToast } from '@/components/ui/Toast';
import { clsx } from 'clsx';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const AppLayout: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServerWaking, setIsServerWaking] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, deviceId } = useAuthStore();
  const { showToast } = useToast();
  const mobileNavItems = getRoleNavItems(user?.role);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await api.get('/api/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore silent fetch failure
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushSupported(false);
    } else {
      setPushPermission(Notification.permission);
    }
  }, []);

  useRealtimeSync(
    ['notification:new'],
    () => {
      fetchNotifications();
    },
    { userId: user?.id }
  );

  // Forced logout listener
  useRealtimeSync(
    ['auth:forced_logout'],
    (payload: any) => {
      showToast(payload?.reason || 'Your session was ended by an administrator.', 'error');
      logout('forced_logout');
      navigate('/login');
    },
    { userId: user?.id }
  );

  // 30-second Page Visibility API heartbeat + Optional Idle auto-logout (DEFAULT OFF)
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const onReconnect = (ev: any) => setIsReconnecting(!!ev.detail);
    window.addEventListener('velan:reconnecting', onReconnect);
    return () => window.removeEventListener('velan:reconnecting', onReconnect);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let lastInteractionAt = Date.now();
    const markInteraction = () => {
      lastInteractionAt = Date.now();
    };
    window.addEventListener('mousemove', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction, { passive: true });
    window.addEventListener('touchstart', markInteraction, { passive: true });

    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      const isRecentlyActive = Date.now() - lastInteractionAt < 5 * 60 * 1000;
      api.post('/api/presence/heartbeat', { active: isRecentlyActive }).catch(() => {});
    };

    sendHeartbeat();
    const hbTimer = setInterval(sendHeartbeat, 30_000);

    // Idle auto-logout is OPTIONAL and OFF by default (only active if admin enables IDLE_AUTO_LOGOUT_ENABLED)
    let idleCheckTimer: any = null;
    api.get('/api/settings').then((res) => {
      const enabled = res.data?.settings?.IDLE_AUTO_LOGOUT_ENABLED === 'true';
      const mins = Number(res.data?.settings?.IDLE_TIMEOUT_MINUTES || 30);
      if (!enabled) return;
      const idleLimitMs = Math.max(5, mins) * 60 * 1000;
      idleCheckTimer = setInterval(() => {
        const idleFor = Date.now() - lastInteractionAt;
        if (idleFor >= idleLimitMs) {
          setIdleWarningOpen(false);
          logout('idle_timeout');
          navigate('/login');
        } else if (idleFor >= idleLimitMs - 60_000) {
          setIdleWarningOpen(true);
        }
      }, 15_000);
    }).catch(() => {});

    const onVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(hbTimer);
      if (idleCheckTimer) clearInterval(idleCheckTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('touchstart', markInteraction);
    };
  }, [user?.id, logout, navigate]);

  const handleMarkRead = async (notificationId?: string) => {
    try {
      await api.post('/api/notifications/read', notificationId ? { notificationId } : {});
      fetchNotifications();
    } catch {
      showToast('Failed to update notifications', 'error');
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported) {
      showToast('Web Push is not supported in this browser. On iOS, add Velan AI to Home Screen first.', 'error');
      return;
    }
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') {
        showToast('Notification permission denied', 'error');
        return;
      }
      const { data: keyData } = await api.get('/api/push/vapid-public-key');
      if (!keyData?.publicKey) {
        showToast('In-app notifications enabled (server VAPID keys not configured yet).', 'info');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      await api.post('/api/push/subscribe', { subscription, deviceId });
      showToast('Push notifications enabled for this device!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not enable push notifications', 'error');
    } finally {
      setPushLoading(false);
    }
  };

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
      {/* Reconnecting banner on transient network/5xx errors */}
      {isReconnecting && (
        <div className="bg-amber-500 text-white text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm z-50">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Reconnecting to server… Your session is preserved.</span>
        </div>
      )}

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
            onOpenNotifications={() => {
              setIsNotificationOpen(true);
              fetchNotifications();
            }}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            unreadNotificationsCount={unreadCount}
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
                  <BrandLogo size="sm" />
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
        description="Live updates for attendance, chat, assignments, materials & requests"
        size="md"
      >
        <div className="space-y-3">
          {/* Web Push Banner */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs text-content-secondary">
              <Smartphone className="w-4 h-4 text-brand-500 shrink-0" />
              <span>
                {!pushSupported
                  ? 'Install on Home Screen (iOS Safari) over HTTPS to enable push alerts.'
                  : pushPermission === 'granted'
                    ? 'Browser push alerts are enabled for this device.'
                    : 'Enable push alerts to get notified even when the tab is closed.'}
              </span>
            </div>
            {pushSupported && pushPermission !== 'granted' && (
              <button
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="px-3 py-1.5 rounded-xl bg-brand-gradient text-white text-xs font-bold shadow-sm disabled:opacity-60"
              >
                {pushLoading ? 'Enabling...' : 'Enable Push'}
              </button>
            )}
          </div>

          {/* Actions Row */}
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => handleMarkRead()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read ({unreadCount})
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-content-muted text-xs flex flex-col items-center gap-2">
                <Bell className="w-6 h-6 opacity-40" />
                <span>No notifications yet.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) handleMarkRead(n.id);
                    if (n.link) {
                      setIsNotificationOpen(false);
                      navigate(n.link);
                    }
                  }}
                  className={clsx(
                    'p-3 rounded-2xl border flex items-start gap-3 transition-colors cursor-pointer',
                    n.isRead
                      ? 'bg-surface-soft border-border hover:bg-slate-50'
                      : 'bg-brand-50/60 border-brand-200/70 hover:bg-brand-50'
                  )}
                >
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full mt-1.5 shrink-0',
                      n.isRead ? 'bg-slate-300' : 'bg-brand-500 animate-pulse'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={clsx('text-xs font-bold truncate', n.isRead ? 'text-content' : 'text-brand-900')}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-content-muted shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-content-secondary mt-0.5 break-words">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Idle Auto-Logout 1-Minute Warning */}
      <Modal
        isOpen={idleWarningOpen}
        onClose={() => setIdleWarningOpen(false)}
        title="Are you still there?"
        description="You have been inactive for 29 minutes. You will be logged out in 1 minute for security."
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIdleWarningOpen(false);
              logout('idle_timeout');
              navigate('/login');
            }}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold"
          >
            Sign Out
          </button>
          <button
            onClick={() => {
              setIdleWarningOpen(false);
              api.post('/api/presence/heartbeat', { active: true }).catch(() => {});
            }}
            className="px-4 py-2 rounded-xl bg-brand-gradient text-white text-xs font-bold"
          >
            Stay Logged In
          </button>
        </div>
      </Modal>
    </div>
  );
};
