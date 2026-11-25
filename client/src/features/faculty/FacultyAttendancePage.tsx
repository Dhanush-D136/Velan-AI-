import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  MapPin,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
  Users,
  Check,
  X,
  Plus,
  BookOpen,
} from 'lucide-react';

export const FacultyAttendancePage: React.FC = () => {
  const { showToast } = useToast();

  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>(''); // "classId|subjectId"
  const [radius, setRadius] = useState(500);
  const [duration, setDuration] = useState(10);
  const [anchorCoords, setAnchorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadFacultyOverview = useCallback(async () => {
    try {
      const res = await api.get('/api/attendance/faculty-overview');
      const pairs = res.data.classSubjects || [];
      setClassSubjects(pairs);
      if (pairs.length > 0 && !selectedPair) {
        setSelectedPair(`${pairs[0].classId}|${pairs[0].subjectId}`);
      }
      if (res.data.activeSession) {
        setActiveSessionId(res.data.activeSession.id);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, [selectedPair]);

  const loadSessionBoard = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await api.get(`/api/attendance/session/${activeSessionId}/live`);
      setSessionInfo(res.data.session);
      setRoster(res.data.roster || []);
      if (res.data.session?.expiresAt) {
        const sec = Math.max(0, Math.floor((new Date(res.data.session.expiresAt).getTime() - Date.now()) / 1000));
        setTimeLeft(sec);
      }
    } catch {
      // handled
    }
  }, [activeSessionId]);

  useEffect(() => {
    loadFacultyOverview();
  }, [loadFacultyOverview]);

  useEffect(() => {
    loadSessionBoard();
  }, [loadSessionBoard]);

  useRealtimeSync(
    ['attendance:marked', 'attendance:session_closed', 'attendance:session_extended', 'data:updated'],
    () => {
      loadSessionBoard();
    },
    { sessionId: activeSessionId || undefined }
  );

  // Countdown tick
  useEffect(() => {
    if (!sessionInfo?.isActive || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionInfo?.isActive, timeLeft]);

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by this browser.', 'error');
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAnchorCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(Math.round(pos.coords.accuracy));
        setIsCapturingGps(false);
        showToast(`GPS captured (±${Math.round(pos.coords.accuracy)}m accuracy)`, 'success');
      },
      (err) => {
        setIsCapturingGps(false);
        showToast(
          err.code === 1
            ? 'Location permission denied. Browser GPS requires HTTPS or localhost.'
            : 'Unable to capture GPS location. Please try again.',
          'error'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleStartSession = async () => {
    if (!selectedPair) {
      showToast('Select a Class & Subject first.', 'error');
      return;
    }
    if (!anchorCoords) {
      showToast('Please capture your GPS location first.', 'error');
      return;
    }

    const [classId, subjectId] = selectedPair.split('|');
    setIsStarting(true);
    try {
      const res = await api.post('/api/attendance/start', {
        classId,
        subjectId,
        anchorLat: anchorCoords.lat,
        anchorLng: anchorCoords.lng,
        radiusMeters: radius,
        durationMinutes: duration,
        mode: 'HYBRID',
      });
      setActiveSessionId(res.data.session.id);
      showToast('GPS Attendance session started! Students notified.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to start session', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const handleManualOverride = async (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    if (!activeSessionId) return;
    try {
      await api.post('/api/attendance/manual', {
        sessionId: activeSessionId,
        records: [{ studentId, status }],
      });
      showToast(`Marked ${status}`, 'success');
      loadSessionBoard();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update attendance', 'error');
    }
  };

  const handleMarkAllPresent = async () => {
    if (!activeSessionId || roster.length === 0) return;
    try {
      await api.post('/api/attendance/manual', {
        sessionId: activeSessionId,
        records: roster.map((r) => ({ studentId: r.studentId, status: 'PRESENT' })),
      });
      showToast('All students marked PRESENT', 'success');
      loadSessionBoard();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to mark all present', 'error');
    }
  };

  const handleExtend = async () => {
    if (!activeSessionId) return;
    try {
      await api.post(`/api/attendance/session/${activeSessionId}/extend`, { minutes: 5 });
      showToast('Session extended by +5 minutes', 'success');
      loadSessionBoard();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to extend session', 'error');
    }
  };

  const handleCloseEarly = async () => {
    if (!activeSessionId) return;
    try {
      await api.post(`/api/attendance/session/${activeSessionId}/close`);
      showToast('Session closed. Remaining unmarked students marked ABSENT.', 'success');
      loadSessionBoard();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to close session', 'error');
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!isLoading && classSubjects.length === 0 && !activeSessionId) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          GPS Attendance Controller
        </h1>
        <EmptyState
          icon={BookOpen}
          title="No subjects assigned to you yet"
          description="Ask the Admin to assign your Class & Subject in Classes & Subjects or the Timetable Builder."
        />
      </div>
    );
  }

  const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
  const totalCount = roster.length;
  const progress = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          GPS Attendance Controller
        </h1>
        <p className="text-xs sm:text-sm text-content-secondary mt-1">
          Configure classroom geofence anchor, broadcast live session, and manage manual overrides.
        </p>
      </div>

      {!activeSessionId || (sessionInfo && !sessionInfo.isActive) ? (
        <Card className="p-6 space-y-6">
          {sessionInfo && !sessionInfo.isActive && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
              <span>
                <strong>Session Completed:</strong> {sessionInfo.presentCount} Present • {sessionInfo.absentCount} Absent
              </span>
              <Button size="sm" variant="secondary" onClick={() => { setActiveSessionId(null); setSessionInfo(null); }}>
                Start New Session
              </Button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
              Select Class & Subject *
            </label>
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm font-semibold outline-none focus:border-brand-500"
            >
              {classSubjects.map((cs) => (
                <option key={cs.id} value={`${cs.classId}|${cs.subjectId}`}>
                  {cs.class?.name} — {cs.subject?.code} {cs.subject?.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-2">
                Geofence Radius: {radius}m
              </label>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 200, 500, 1000].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      radius === r
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-content-secondary border-border'
                    }`}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-2">
                Time Limit: {duration} min
              </label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      duration === d
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-content-secondary border-border'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-content flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-600" />
                Classroom GPS Anchor
              </h4>
              {anchorCoords ? (
                <p className="text-xs font-mono text-emerald-700 mt-1">
                  {anchorCoords.lat.toFixed(6)}, {anchorCoords.lng.toFixed(6)} (±{accuracy}m)
                </p>
              ) : (
                <p className="text-xs text-content-secondary mt-1">
                  Tap "Capture My GPS Location" before starting the session.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isCapturingGps}
              onClick={handleCaptureGps}
              leftIcon={<Radio className="w-4 h-4" />}
            >
              Capture My GPS Location
            </Button>
          </div>

          <Button
            size="lg"
            className="w-full"
            isLoading={isStarting}
            onClick={handleStartSession}
            leftIcon={<MapPin className="w-5 h-5" />}
          >
            Start Live GPS Session
          </Button>
        </Card>
      ) : (
        sessionInfo && (
          <div className="space-y-6">
            <Card className="bg-slate-900 text-white p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <Badge variant="success" size="sm">LIVE GEOFENCE ACTIVE</Badge>
                  <h2 className="text-xl font-heading font-bold mt-2">
                    {sessionInfo.subjectName} ({sessionInfo.subjectCode})
                  </h2>
                  <p className="text-xs text-slate-300">
                    {sessionInfo.className} • Radius: {sessionInfo.radiusMeters}m
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-accent-cyan font-mono text-2xl font-bold">
                      <Clock className="w-5 h-5" />
                      {formatTimer(timeLeft)}
                    </div>
                    <span className="text-[11px] text-slate-300">
                      {presentCount} / {totalCount} Present
                    </span>
                  </div>
                  <ProgressRing progress={progress} size={56} strokeWidth={5} color="#10B981" />
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={handleExtend}>
                  +5 Min
                </Button>
                <Button size="sm" variant="secondary" leftIcon={<Users className="w-3.5 h-3.5" />} onClick={handleMarkAllPresent}>
                  Mark All Present
                </Button>
                <Button size="sm" variant="danger" onClick={handleCloseEarly}>
                  Close Session & Auto-Absent Unmarked
                </Button>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="divide-y divide-border">
                {roster.map((st) => (
                  <div key={st.studentId} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={st.name} size="sm" />
                      <div>
                        <h4 className="text-sm font-bold text-content">{st.name}</h4>
                        <span className="text-xs font-mono text-content-secondary">
                          {st.rollNo} • {st.registerNo}
                          {st.distanceMeters != null ? ` • ${Math.round(st.distanceMeters)}m` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={st.status === 'PRESENT' ? 'success' : st.status === 'ABSENT' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {st.status === 'PRESENT' ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : st.status === 'ABSENT' ? (
                          <XCircle className="w-3 h-3 mr-1" />
                        ) : null}
                        {st.status}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleManualOverride(st.studentId, 'PRESENT')}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        title="Mark Present"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManualOverride(st.studentId, 'ABSENT')}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                        title="Mark Absent"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      )}
    </div>
  );
};
