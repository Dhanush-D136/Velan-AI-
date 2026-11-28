import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { RushWaitingScreen, RushQueueConfigUI } from '@/components/attendance/RushWaitingScreen';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  MapPin,
  Radio,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const StudentMarkAttendancePage: React.FC = () => {
  const { user, getDeviceId } = useAuthStore();
  const { showToast } = useToast();

  const [activeSession, setActiveSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<'SUCCESS' | 'REJECTED' | null>(null);
  const [queuedTicket, setQueuedTicket] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('velan_active_checkin_ticket');
      return saved ? JSON.parse(saved).ticket : null;
    } catch {
      return null;
    }
  });
  const [queueConfig, setQueueConfig] = useState<RushQueueConfigUI | null>(() => {
    try {
      const saved = sessionStorage.getItem('velan_active_checkin_ticket');
      return saved ? JSON.parse(saved).config : null;
    } catch {
      return null;
    }
  });
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const classId = user?.studentProfile?.classId;
  const isSecureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await api.get('/api/attendance/student-overview');
      const sess = res.data?.activeSession || null;
      setActiveSession(sess);
      if (sess?.alreadyMarked && sess?.myRecord) {
        setResult('SUCCESS');
        setDistance(sess.myRecord.distanceMeters != null ? Math.round(sess.myRecord.distanceMeters) : null);
      } else if (!sess) {
        setResult(null);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  useRealtimeSync(
    ['attendance:session_started', 'attendance:session_closed', 'attendance:session_extended'],
    fetchActiveSession,
    { classId }
  );

  const handleMarkAttendance = () => {
    if (!activeSession) return;
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setIsScanning(true);
    setResult(null);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.post('/api/attendance/mark', {
            sessionId: activeSession.id,
            rotatingToken: activeSession.rotatingToken,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 15,
            timestamp: pos.timestamp || Date.now(),
            deviceId: getDeviceId(),
          });

          if (res.status === 202 && res.data?.queued && res.data?.ticket) {
            sessionStorage.setItem(
              'velan_active_checkin_ticket',
              JSON.stringify({ ticket: res.data.ticket, config: res.data.config })
            );
            setQueuedTicket(res.data.ticket);
            setQueueConfig(res.data.config);
            return;
          }

          setDistance(res.data.distanceMeters != null ? Math.round(res.data.distanceMeters) : null);
          setResult('SUCCESS');
          showToast('Attendance verified and recorded!', 'success');
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.65 } });
          fetchActiveSession();
        } catch (err: any) {
          const msg = err.response?.data?.error || err.response?.data?.message || 'Verification failed';
          setErrorMsg(msg);
          if (err.response?.data?.distanceMeters != null) {
            setDistance(Math.round(err.response.data.distanceMeters));
          }
          setResult('REJECTED');
          showToast(msg, 'error');
        } finally {
          setIsScanning(false);
        }
      },
      (err) => {
        setIsScanning(false);
        const msg =
          err.code === 1
            ? 'Location permission denied. Please enable GPS location access in your browser settings (HTTPS required on mobile).'
            : 'Could not read your GPS coordinates. Please move near a window and try again.';
        setErrorMsg(msg);
        setResult('REJECTED');
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto">
        <InlineLoader label="Checking active GPS session..." subtext="Syncing with your class faculty" />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-heading font-extrabold text-content">GPS Attendance Check-In</h1>
        <EmptyState
          icon={MapPin}
          title="No active attendance session right now"
          description="The GPS check-in button appears automatically when your faculty opens an attendance session for your class."
          actionLabel="Refresh"
          onAction={fetchActiveSession}
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {queuedTicket && queueConfig && (
        <RushWaitingScreen
          ticketId={queuedTicket.ticketId}
          initialTicket={queuedTicket}
          config={queueConfig}
          onSuccess={(r) => {
            setQueuedTicket(null);
            setDistance(r.distanceMeters != null ? Math.round(r.distanceMeters) : null);
            setResult('SUCCESS');
            showToast('Attendance verified and recorded!', 'success');
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.65 } });
            fetchActiveSession();
          }}
          onRetry={() => {
            sessionStorage.removeItem('velan_active_checkin_ticket');
            setQueuedTicket(null);
          }}
          onClose={() => setQueuedTicket(null)}
        />
      )}
      {!isSecureContext && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            Browser GPS requires an <strong>HTTPS</strong> connection on mobile devices. Open this app over HTTPS to mark attendance.
          </span>
        </div>
      )}

      {activeSession && (
        <Card className="text-center p-8 relative overflow-hidden">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Badge variant="brand">GEOFENCE ACTIVE</Badge>
            <span className="text-xs text-content-secondary font-mono">
              Ends {new Date(activeSession.expiresAt).toLocaleTimeString()}
            </span>
          </div>

          <h1 className="text-2xl font-heading font-extrabold text-content">
            {activeSession.subjectName} ({activeSession.subjectCode})
          </h1>
          <p className="text-xs text-content-secondary mt-1">
            {activeSession.facultyName} • {activeSession.className}
          </p>

          <div className="my-8 flex flex-col items-center justify-center">
            <div className="relative">
              {isScanning && (
                <>
                  <div className="absolute inset-0 rounded-full bg-brand-500 animate-radar-pulse opacity-75" />
                  <div className="absolute -inset-4 rounded-full border-2 border-brand-500/50  opacity-40" />
                </>
              )}

              <button
                onClick={handleMarkAttendance}
                disabled={isScanning || result === 'SUCCESS'}
                className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center text-white transition-all duration-300 shadow-2xl active:scale-95 ${
                  result === 'SUCCESS'
                    ? 'bg-emerald-500 shadow-emerald-500/30'
                    : result === 'REJECTED'
                    ? 'bg-rose-500 shadow-rose-500/30'
                    : 'bg-brand-gradient hover:scale-105 shadow-brand-500/40'
                }`}
              >
                {isScanning ? (
                  <>
                    <Radio className="w-10 h-10 animate-spin mb-1 text-white" />
                    <span className="text-xs font-bold uppercase tracking-wider">Getting your location</span>
                    <span className="text-[10px] text-white/80">Verifying your location...</span>
                  </>
                ) : result === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 mb-1" />
                    <span className="text-sm font-bold uppercase tracking-wider">Verified!</span>
                    {distance != null && (
                      <span className="text-xs font-mono font-semibold">{distance}m away</span>
                    )}
                  </>
                ) : result === 'REJECTED' ? (
                  <>
                    <XCircle className="w-12 h-12 mb-1" />
                    <span className="text-sm font-bold uppercase tracking-wider">Rejected</span>
                    <span className="text-[11px] font-semibold mt-1">Tap to Retry</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-10 h-10 mb-2" />
                    <span className="text-sm font-bold uppercase tracking-wider">Mark My</span>
                    <span className="text-sm font-bold uppercase tracking-wider">Attendance</span>
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="mt-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs max-w-sm">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-content-muted pt-4 border-t border-border">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Server-verified Haversine distance &amp; hardware device lock</span>
          </div>
        </Card>
      )}
    </div>
  );
};
