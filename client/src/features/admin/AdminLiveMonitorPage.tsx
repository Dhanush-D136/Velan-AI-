import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  Activity,
  Users,
  ShieldAlert,
  Server,
  Download,
  Search,
  Clock,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

async function downloadMonitorExcel(path: string, filename: string) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const AdminLiveMonitorPage: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'PRESENCE' | 'HISTORY' | 'HEALTH' | 'SETTINGS'>('PRESENCE');
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);

  const [searchOnline, setSearchOnline] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyEventFilter, setHistoryEventFilter] = useState('ALL');
  const [idleTimeout, setIdleTimeout] = useState(30);
  const [retentionDays, setRetentionDays] = useState(90);

  const fetchAll = useCallback(async () => {
    try {
      const [ovRes, hRes, histRes, qRes] = await Promise.all([
        api.get('/api/admin/monitor/overview'),
        api.get('/api/admin/health'),
        api.get(`/api/admin/monitor/history?event=${historyEventFilter}&search=${encodeURIComponent(historySearch)}`),
        api.get('/api/admin/rush-queue/stats').catch(() => ({ data: null })),
      ]);
      setOverview(ovRes.data);
      setHealth(hRes.data);
      setHistory(histRes.data?.events || []);
      if (qRes?.data) setQueueStats(qRes.data);
      if (ovRes.data?.settings) {
        setIdleTimeout(ovRes.data.settings.idleTimeoutMinutes);
        setRetentionDays(ovRes.data.settings.authRetentionDays);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, [historyEventFilter, historySearch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const socket = getSocket();
    const token = localStorage.getItem('velan_token');
    socket.emit('join:admin', token);

    const onPresence = (presence: any) => {
      setOverview((prev: any) => (prev ? { ...prev, presence } : prev));
    };
    const onHealth = (h: any) => {
      setHealth((prev: any) => (prev ? { ...prev, ...h } : h));
    };
    const onAlert = (alert: any) => {
      showToast(`${alert.status}: ${alert.reason}`, 'error');
      fetchAll();
    };

    socket.on('admin:presence_update', onPresence);
    socket.on('admin:health_update', onHealth);
    socket.on('admin:health_alert', onAlert);
    return () => {
      socket.off('admin:presence_update', onPresence);
      socket.off('admin:health_update', onHealth);
      socket.off('admin:health_alert', onAlert);
    };
  }, [fetchAll, showToast]);

  if (isLoading) {
    return <InlineLoader label="Loading Admin Live Monitor..." subtext="Connecting real-time presence and server health telemetry" />;
  }

  const presence = overview?.presence || {
    totalOnline: 0,
    idleCount: 0,
    byRole: { STUDENT: 0, FACULTY: 0, ADMIN: 0 },
    activeSessionsCount: 0,
    devicesSplit: { phone: 0, computer: 0, tablet: 0 },
    peakConcurrentToday: 0,
    peakConcurrentAt: null,
    onlineUsers: [],
  };

  const filteredOnline = (presence.onlineUsers || []).filter((u: any) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (searchOnline.trim() && !u.name.toLowerCase().includes(searchOnline.toLowerCase())) return false;
    return true;
  });

  const healthColor =
    health?.status === 'STRUGGLING'
      ? 'bg-rose-50 border-rose-300 text-rose-900'
      : health?.status === 'DEGRADED'
        ? 'bg-amber-50 border-amber-300 text-amber-900'
        : 'bg-emerald-50 border-emerald-200 text-emerald-900';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Admin Live Monitor &amp; Server Health
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Real-time user presence, login telemetry, and live Node/DB health analysis.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === 'PRESENCE' ? 'primary' : 'secondary'} onClick={() => setTab('PRESENCE')} leftIcon={<Users className="w-4 h-4" />}>
            Live Presence
          </Button>
          <Button size="sm" variant={tab === 'HISTORY' ? 'primary' : 'secondary'} onClick={() => setTab('HISTORY')} leftIcon={<Clock className="w-4 h-4" />}>
            Auth History &amp; Trends
          </Button>
          <Button size="sm" variant={tab === 'HEALTH' ? 'primary' : 'secondary'} onClick={() => setTab('HEALTH')} leftIcon={<Server className="w-4 h-4" />}>
            Server Health
          </Button>
          <Button size="sm" variant={tab === 'SETTINGS' ? 'primary' : 'secondary'} onClick={() => setTab('SETTINGS')} leftIcon={<Sliders className="w-4 h-4" />}>
            Thresholds &amp; Privacy
          </Button>
        </div>
      </div>

      {/* Health Status Banner */}
      {health && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${healthColor}`}>
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 shrink-0" />
            <div>
              <strong>Server Status: {health.status}</strong> — {health.reason}
              <span className="block text-[11px] opacity-80 mt-0.5">{health.capacityInsight}</span>
            </div>
          </div>
          {queueStats && !queueStats.enabled && health.status !== 'HEALTHY' && (
            <Badge variant="warning" size="sm">
              Many check-ins are slow. Consider turning on the rush-hour queue in Settings.
            </Badge>
          )}
        </div>
      )}

      {tab === 'PRESENCE' && (
        <>
          {/* Top Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="p-4">
              <div className="text-xs text-content-muted">Online Now</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{presence.totalOnline}</div>
              <div className="text-[11px] text-content-secondary">
                {presence.byRole.STUDENT}S • {presence.byRole.FACULTY}F • {presence.byRole.ADMIN}A ({presence.idleCount} idle)
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Signed In Today</div>
              <div className="text-2xl font-extrabold text-content mt-1">{overview?.loggedInToday?.total || 0}</div>
              <div className="text-[11px] text-content-secondary">
                {overview?.loggedInToday?.STUDENT || 0} of {overview?.totals?.STUDENT || 0} students
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Never Logged In</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{overview?.neverLoggedIn?.length || 0}</div>
              <button
                onClick={() => downloadMonitorExcel('/api/admin/monitor/export/never-logged-in', 'Never_Logged_In.xlsx')}
                className="text-[11px] text-brand-600 font-bold underline mt-0.5"
              >
                Export Excel
              </button>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Active Devices</div>
              <div className="text-2xl font-extrabold text-content mt-1">{presence.activeSessionsCount}</div>
              <div className="text-[11px] text-content-secondary">
                {presence.devicesSplit.phone} Phone • {presence.devicesSplit.computer} PC
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Peak Today</div>
              <div className="text-2xl font-extrabold text-brand-600 mt-1">{presence.peakConcurrentToday}</div>
              <div className="text-[11px] text-content-secondary">
                {presence.peakConcurrentAt ? new Date(presence.peakConcurrentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Today Events</div>
              <div className="text-lg font-extrabold text-content mt-1">
                {overview?.todayCounts?.logins || 0} in / {overview?.todayCounts?.logouts || 0} out
              </div>
              <div className="text-[11px] text-rose-600 font-semibold">
                {overview?.todayCounts?.failedLogins || 0} failed logins
              </div>
            </Card>
          </div>

          {/* Suspicious Activity */}
          {(overview?.suspiciousFlags || []).length > 0 && (
            <Card className="bg-rose-50/60 border-rose-200 space-y-2">
              <h3 className="font-bold text-xs uppercase text-rose-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Suspicious Activity Detected
              </h3>
              {overview.suspiciousFlags.map((f: any, idx: number) => (
                <div key={idx} className="text-xs text-rose-900">• {f.message}</div>
              ))}
            </Card>
          )}

          {/* Who is Online Table */}
          <Card className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-heading font-bold text-base text-content">Who Is Online Right Now</h3>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search user..."
                    value={searchOnline}
                    onChange={(e) => setSearchOnline(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-border text-xs"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs bg-white"
                >
                  <option value="ALL">All Roles</option>
                  <option value="STUDENT">Student</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-soft text-[10px] uppercase text-content-muted border-b border-border">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Role / Class</th>
                    <th className="p-2.5">Device / Browser / OS</th>
                    <th className="p-2.5">Logged In</th>
                    <th className="p-2.5">Last Active</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOnline.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-content-muted">No matching online users</td></tr>
                  ) : (
                    filteredOnline.map((u: any) => (
                      <tr key={u.userId}>
                        <td className="p-2.5 font-bold text-content">{u.name}</td>
                        <td className="p-2.5">{u.role} {u.className ? `• ${u.className}` : ''}</td>
                        <td className="p-2.5">{u.deviceType} • {u.browser} / {u.os}</td>
                        <td className="p-2.5">{new Date(u.startedAt).toLocaleTimeString()}</td>
                        <td className="p-2.5">{new Date(u.lastActiveAt).toLocaleTimeString()}</td>
                        <td className="p-2.5">
                          <Badge variant={u.status === 'ONLINE' ? 'success' : 'warning'} size="sm">{u.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Class-wise Online & Never Logged In */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-3">
              <h3 className="font-heading font-bold text-base text-content">Class-Wise Online Activity</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
                {(overview?.classWise || []).map((c: any) => (
                  <div key={c.classId} className="p-3 rounded-xl bg-surface-soft border border-border flex items-center justify-between">
                    <div>
                      <div className="font-bold text-content">{c.className}</div>
                      {c.activeSession && (
                        <div className="text-[11px] text-brand-600 font-semibold">
                          GPS Session Open: {c.onlineStudents} online / {c.activeSession.markedCount} marked
                        </div>
                      )}
                    </div>
                    <Badge variant="neutral" size="sm">{c.onlineStudents} / {c.totalStudents} online</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-base text-content">Never Logged In ({overview?.neverLoggedIn?.length || 0})</h3>
                <Button size="sm" variant="secondary" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => downloadMonitorExcel('/api/admin/monitor/export/never-logged-in', 'Never_Logged_In.xlsx')}>
                  Export
                </Button>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto text-xs">
                {(overview?.neverLoggedIn || []).slice(0, 40).map((u: any) => (
                  <div key={u.userId} className="p-2.5 rounded-xl bg-surface-soft border border-border flex justify-between">
                    <span><strong>{u.name}</strong> ({u.identifier})</span>
                    <Badge variant="neutral" size="sm">{u.role} • {u.className}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'HISTORY' && (
        <div className="space-y-6">
          <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                placeholder="Search user or IP..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs"
              />
              <select
                value={historyEventFilter}
                onChange={(e) => setHistoryEventFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs bg-white"
              >
                <option value="ALL">All Events</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="login_failed">Login Failed</option>
                <option value="device_limit_blocked">Device Limit Blocked</option>
              </select>
            </div>
            <Button size="sm" variant="secondary" leftIcon={<Download className="w-4 h-4" />} onClick={() => downloadMonitorExcel('/api/admin/monitor/export/history', 'Auth_History.xlsx')}>
              Export History Excel
            </Button>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-soft text-[10px] uppercase text-content-muted border-b border-border">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">User</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Event</th>
                    <th className="p-2.5">Device / OS</th>
                    <th className="p-2.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((e) => (
                    <tr key={e.id}>
                      <td className="p-2.5 font-mono text-[11px]">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="p-2.5 font-bold">{e.userName}</td>
                      <td className="p-2.5">{e.role}</td>
                      <td className="p-2.5"><Badge variant={e.event.includes('fail') || e.event.includes('block') ? 'danger' : 'neutral'} size="sm">{e.event}</Badge></td>
                      <td className="p-2.5">{e.deviceType || '—'} • {e.browser || '—'} / {e.os || '—'}</td>
                      <td className="p-2.5 font-mono">{e.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'HEALTH' && health && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-content-muted">Event-Loop Lag p99</div>
              <div className="text-2xl font-extrabold text-content mt-1">{health.process.eventLoopLagP99Ms} ms</div>
              <div className="text-[11px] text-content-secondary">CPU: {health.process.cpuPercent}% • Uptime: {health.process.uptimeSec}s</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Memory (RSS / Heap)</div>
              <div className="text-2xl font-extrabold text-content mt-1">{health.process.memoryRssMb} MB</div>
              <div className="text-[11px] text-content-secondary">Heap: {health.process.memoryHeapMb} MB ({health.process.memoryPercent}%)</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">HTTP p95 / p99</div>
              <div className="text-2xl font-extrabold text-content mt-1">{health.http.p95Ms} / {health.http.p99Ms} ms</div>
              <div className="text-[11px] text-content-secondary">RPS: {health.http.rps} • 5xx: {health.http.error5xxRate}%</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-content-muted">Sockets &amp; Check-ins</div>
              <div className="text-2xl font-extrabold text-content mt-1">{health.realtime.connectedSockets} sockets</div>
              <div className="text-[11px] text-content-secondary">{health.domain.checkinsPerMin} check-ins/min (avg {health.domain.avgCheckinMs} ms)</div>
            </Card>
          </div>

          {queueStats && (
            <Card className="space-y-2">
              <h3 className="font-heading font-bold text-sm text-content">Rush-Hour Check-In Queue Telemetry</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>Status: <strong>{queueStats.enabled ? 'ON' : 'OFF'}</strong></div>
                <div>Waiting: <strong>{queueStats.queueLength}</strong></div>
                <div>p95 Wait: <strong>{queueStats.p95WaitSec}s</strong></div>
                <div>Saved / Rejected: <strong>{queueStats.savedCount} / {queueStats.rejectedCount}</strong></div>
                <div>Peak Queue Today: <strong>{queueStats.peakQueueLength}</strong></div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-3">
              <h3 className="font-heading font-bold text-base text-content">Slowest Endpoints</h3>
              <div className="space-y-1.5 text-xs">
                {(health.http.slowestEndpoints || []).map((ep: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-xl bg-surface-soft border border-border flex justify-between">
                    <span className="font-mono truncate">{ep.endpoint}</span>
                    <span className="font-bold">{ep.avgMs} ms avg ({ep.count} reqs)</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3">
              <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Health Incidents History
              </h3>
              {(health.incidents || []).length === 0 ? (
                <p className="text-xs text-content-secondary">No degraded or struggling incidents recorded.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                  {health.incidents.map((inc: any) => (
                    <div key={inc.id} className="p-2.5 rounded-xl bg-surface-soft border border-border">
                      <div className="flex justify-between font-bold">
                        <Badge variant={inc.status === 'STRUGGLING' ? 'danger' : 'warning'} size="sm">{inc.status}</Badge>
                        <span className="text-content-muted">{new Date(inc.startedAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-content-secondary">{inc.cause}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'SETTINGS' && (
        <Card className="space-y-4 max-w-xl">
          <h3 className="font-heading font-bold text-base text-content">Monitor, Idle &amp; Retention Settings</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label>
              <span className="text-content-muted block mb-1">Idle Auto-Logout (minutes)</span>
              <input type="number" value={idleTimeout} onChange={(e) => setIdleTimeout(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-border" />
            </label>
            <label>
              <span className="text-content-muted block mb-1">Auth Event Retention (days)</span>
              <input type="number" value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-border" />
            </label>
          </div>
          <p className="text-[11px] text-content-secondary">
            Privacy Notice: IP addresses and device metadata are stored strictly for campus security, attendance audit, and session monitoring, and are automatically purged after {retentionDays} days.
          </p>
          <Button
            size="sm"
            onClick={async () => {
              await api.put('/api/admin/monitor/settings', { idleTimeoutMinutes: idleTimeout, authRetentionDays: retentionDays });
              showToast('Monitor settings updated!', 'success');
            }}
          >
            Save Settings
          </Button>
        </Card>
      )}
    </div>
  );
};
