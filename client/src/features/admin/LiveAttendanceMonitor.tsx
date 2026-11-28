import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const LiveAttendanceMonitor: React.FC = () => {
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [board, setBoard] = useState<{ session: any; roster: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/api/attendance/live-sessions');
      const list = res.data.sessions || [];
      setLiveSessions(list);
      if (list.length > 0 && (!selectedSessionId || !list.some((s: any) => s.id === selectedSessionId))) {
        setSelectedSessionId(list[0].id);
      } else if (list.length === 0) {
        setSelectedSessionId('');
        setBoard(null);
      }
    } catch {
      // handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [selectedSessionId]);

  const fetchBoard = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      const res = await api.get(`/api/attendance/session/${selectedSessionId}/live`);
      setBoard(res.data);
    } catch {
      // handled
    }
  }, [selectedSessionId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useRealtimeSync(
    ['attendance:session_started', 'attendance:session_closed', 'attendance:marked', 'data:updated'],
    () => {
      fetchSessions();
      fetchBoard();
    },
    { sessionId: selectedSessionId || undefined }
  );

  const formatRemaining = (expiresAt: string) => {
    const diffSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} left`;
  };

  if (!isLoading && liveSessions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          Live Attendance Monitor
        </h1>
        <EmptyState
          icon={MapPin}
          title="No active GPS sessions right now"
          description="When faculty launch a GPS attendance session, live student check-ins, distances, and countdown timers will stream here automatically."
          actionLabel="Refresh"
          onAction={fetchSessions}
        />
      </div>
    );
  }

  const session = board?.session;
  const roster = board?.roster || [];
  const percentage = session && session.totalEnrolled > 0
    ? Math.round((session.presentCount / session.totalEnrolled) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
              Live Attendance Monitor
            </h1>
            <Badge variant="success" size="sm">
              <span className="w-2 h-2 rounded-full bg-accent-emerald  mr-1" />
              Live Socket.IO Stream
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Real-time GPS geofence radar, active radius, and instant student verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-border bg-white text-xs sm:text-sm font-semibold text-content outline-none shadow-sm focus:border-brand-500"
          >
            {liveSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.class?.name} — {s.classSubject?.subject?.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              fetchSessions();
              fetchBoard();
            }}
          >
            Sync
          </Button>
        </div>
      </div>

      {session && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <Card className="lg:col-span-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                      GEOFENCE ANCHOR ACTIVE
                    </span>
                    <span className="text-xs text-slate-300 font-mono">Radius: {session.radiusMeters}m</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">
                    {session.subjectName} ({session.subjectCode})
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Faculty Anchor: <span className="text-white font-medium">{session.facultyName}</span> • Coords:{' '}
                    <span className="font-mono text-accent-cyan">
                      {session.anchorLat.toFixed(4)}°, {session.anchorLng.toFixed(4)}°
                    </span>
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                  <div className="flex items-center gap-2 text-accent-cyan">
                    <Clock className="w-5 h-5 " />
                    <span className="text-xl font-mono font-bold">{formatRemaining(session.expiresAt)}</span>
                  </div>
                  <span className="text-xs text-slate-300 mt-1">{session.className}</span>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col items-center justify-center p-6 text-center">
              <ProgressRing progress={percentage} size={88} strokeWidth={8} color="#10B981" />
              <h4 className="font-heading font-bold text-base text-content mt-3">
                {session.presentCount} / {session.totalEnrolled} Present
              </h4>
              <span className="text-xs text-content-secondary">
                {session.notMarkedCount} pending • {session.absentCount} absent
              </span>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-soft border-b border-border text-[11px] font-bold text-content-secondary uppercase tracking-wider">
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Roll No</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Method</th>
                    <th className="py-3.5 px-4">Distance</th>
                    <th className="py-3.5 px-4">Time Marked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {roster.map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <Avatar name={s.name} size="sm" />
                        <span className="font-semibold text-content text-xs sm:text-sm">{s.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-content-secondary">{s.rollNo}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={s.status === 'PRESENT' ? 'success' : s.status === 'ABSENT' ? 'danger' : 'warning'}
                          size="sm"
                        >
                          {s.status === 'PRESENT' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : s.status === 'ABSENT' ? (
                            <XCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <AlertCircle className="w-3 h-3 mr-1" />
                          )}
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono font-medium text-content-secondary">
                          {s.method || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-content">
                          {s.distanceMeters != null ? `${Math.round(s.distanceMeters)}m` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-content-muted">
                        {s.markedAt ? new Date(s.markedAt).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
