import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  MapPin,
  Clock,
  Radio,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Users,
  Smartphone,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

export const FacultyAttendancePage: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [radius, setRadius] = useState(500);
  const [duration, setDuration] = useState(10);
  const [mode, setMode] = useState<'HYBRID' | 'GPS' | 'MANUAL'>('HYBRID');
  const [isScanningLocation, setIsScanningLocation] = useState(false);
  const [anchorCoords, setAnchorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  // Demo roster
  const [students, setStudents] = useState([
    { id: '1', name: 'Arunachalam V', rollNo: '22CS001', status: 'NOT_MARKED', distance: null as string | null },
    { id: '2', name: 'Bhavani S', rollNo: '22CS002', status: 'NOT_MARKED', distance: null as string | null },
    { id: '3', name: 'Chandran M', rollNo: '22CS003', status: 'NOT_MARKED', distance: null as string | null },
    { id: '4', name: 'Divya P', rollNo: '22CS004', status: 'NOT_MARKED', distance: null as string | null },
    { id: '5', name: 'Eashwar K', rollNo: '22CS005', status: 'NOT_MARKED', distance: null as string | null },
    { id: '6', name: 'Gowtham N', rollNo: '22CS006', status: 'NOT_MARKED', distance: null as string | null },
    { id: '7', name: 'Hariharan T', rollNo: '22CS007', status: 'NOT_MARKED', distance: null as string | null },
    { id: '8', name: 'Janani R', rollNo: '22CS008', status: 'NOT_MARKED', distance: null as string | null },
    { id: '9', name: 'Karthik Raja S', rollNo: '22CS009', status: 'NOT_MARKED', distance: null as string | null },
    { id: '10', name: 'Lavanya M', rollNo: '22CS010', status: 'NOT_MARKED', distance: null as string | null },
  ]);

  // Countdown timer
  useEffect(() => {
    let timer: any;
    if (sessionActive && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeLeft]);

  // Start GPS Attendance Session
  const handleStartSession = () => {
    setIsScanningLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setAnchorCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAccuracy(Math.round(pos.coords.accuracy));
          setIsScanningLocation(false);
          setSessionActive(true);
          setTimeLeft(duration * 60);

          // Simulate incoming students marking attendance live
          simulateStudentResponses();
        },
        (err) => {
          // Fallback to campus coordinates
          setAnchorCoords({ lat: 13.0827, lng: 80.2707 });
          setAccuracy(12);
          setIsScanningLocation(false);
          setSessionActive(true);
          setTimeLeft(duration * 60);
          simulateStudentResponses();
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setAnchorCoords({ lat: 13.0827, lng: 80.2707 });
      setAccuracy(15);
      setIsScanningLocation(false);
      setSessionActive(true);
      setTimeLeft(duration * 60);
      simulateStudentResponses();
    }
  };

  const simulateStudentResponses = () => {
    setTimeout(() => {
      setStudents((prev) =>
        prev.map((s, idx) => {
          if (idx < 7) {
            return { ...s, status: 'PRESENT', distance: `${35 + idx * 18}m` };
          }
          return s;
        })
      );
    }, 1500);
  };

  const handleManualToggle = (id: string, newStatus: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus, distance: 'Manual Override' } : s))
    );
  };

  const handleMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((s) => ({ ...s, status: 'PRESENT', distance: s.distance || 'Manual' }))
    );
  };

  const handleCloseSession = () => {
    // Auto-mark non-responded as ABSENT
    setStudents((prev) =>
      prev.map((s) => (s.status === 'NOT_MARKED' ? { ...s, status: 'ABSENT' } : s))
    );
    setSessionActive(false);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  const presentCount = students.filter((s) => s.status === 'PRESENT').length;
  const percentage = Math.round((presentCount / students.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            GPS Attendance Controller
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Data Structures & Algorithms (CS301) • CSE – Year 2 – Section A
          </p>
        </div>

        {sessionActive && (
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={handleCloseSession}>
              Close Session Early
            </Button>
          </div>
        )}
      </div>

      {/* Controller / Radar Card */}
      {!sessionActive ? (
        <Card className="p-8 border-2 border-brand-200">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-md">
              <Radio className="w-8 h-8 animate-pulse text-brand-500" />
            </div>

            <div>
              <h2 className="text-2xl font-heading font-bold text-content">
                Initiate Geofenced GPS Session
              </h2>
              <p className="text-xs sm:text-sm text-content-secondary mt-1">
                Your device coordinates will serve as the geofence anchor point. Only enrolled
                students of CSE 2nd Year A can mark within the specified radius.
              </p>
            </div>

            {/* Config Sliders & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left p-6 rounded-2xl bg-surface-soft border border-border">
              {/* Radius */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-content uppercase">Geofence Radius</span>
                  <span className="font-mono text-xs font-bold text-brand-600">{radius} meters</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex gap-2 mt-2">
                  {[50, 100, 250, 500].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadius(r)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                        radius === r ? 'bg-brand-500 text-white' : 'bg-white text-content'
                      }`}
                    >
                      {r}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-content uppercase">Session Window</span>
                  <span className="font-mono text-xs font-bold text-brand-600">{duration} minutes</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex gap-2 mt-2">
                  {[5, 10, 15, 20].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                        duration === d ? 'bg-brand-500 text-white' : 'bg-white text-content'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              size="lg"
              variant="faculty"
              isLoading={isScanningLocation}
              onClick={handleStartSession}
              leftIcon={<MapPin className="w-5 h-5" />}
              className="px-8 text-base font-bold shadow-glass"
            >
              Capture Anchor & Start Attendance
            </Button>
          </div>
        </Card>
      ) : (
        /* Active Session Monitor */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <Card className="lg:col-span-3 p-6 bg-slate-950 text-white relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-300 ring-2 ring-teal-500/40">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Session Active & Broadcasting</h3>
                    <p className="text-xs text-slate-300">
                      Anchor Lat/Lng: <span className="font-mono text-accent-cyan">{anchorCoords?.lat.toFixed(4)}, {anchorCoords?.lng.toFixed(4)}</span> • Accuracy: {accuracy}m
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-accent-cyan">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="block text-[10px] uppercase text-slate-400">Time Remaining</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span>Radius: <strong className="text-white">{radius}m</strong></span>
                <span>Mode: <strong className="text-teal-300">Hybrid (GPS + Manual)</strong></span>
                <span className="text-accent-emerald font-bold">Socket.IO Push Delivered to 30 Students</span>
              </div>
            </Card>

            <Card className="flex flex-col items-center justify-center p-6 text-center">
              <ProgressRing progress={percentage} size={110} strokeWidth={9} color="#10B981" />
              <h4 className="font-bold text-sm text-content mt-2">{presentCount} of {students.length} Marked</h4>
            </Card>
          </div>

          {/* Roster & Quick Actions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-content">
                  Live Attendance Checklist & Manual Override
                </h3>
                <p className="text-xs text-content-secondary">
                  Tap check or cross to override GPS records if a student has phone battery/hardware issues.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleMarkAllPresent}>
                  Mark All Present
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={student.name} size="sm" />
                    <div>
                      <h4 className="font-bold text-xs text-content">{student.name}</h4>
                      <span className="text-[11px] text-content-secondary font-mono">{student.rollNo}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {student.distance && (
                      <span className="text-xs font-mono font-semibold text-content-secondary hidden sm:inline">
                        {student.distance}
                      </span>
                    )}

                    <Badge
                      variant={
                        student.status === 'PRESENT'
                          ? 'success'
                          : student.status === 'ABSENT'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {student.status}
                    </Badge>

                    {/* Manual override buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleManualToggle(student.id, 'PRESENT')}
                        className={`p-1.5 rounded-lg border transition-all ${
                          student.status === 'PRESENT'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-content-muted hover:bg-emerald-50'
                        }`}
                        title="Mark Present"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleManualToggle(student.id, 'ABSENT')}
                        className={`p-1.5 rounded-lg border transition-all ${
                          student.status === 'ABSENT'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-content-muted hover:bg-rose-50'
                        }`}
                        title="Mark Absent"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
