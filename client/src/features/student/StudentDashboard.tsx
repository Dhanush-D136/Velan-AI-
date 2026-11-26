import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { StudentProfileCompletion } from './StudentProfileCompletion';
import {
  CalendarCheck2,
  Clock,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  UserCheck,
  Lock,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    student: null,
    activeSession: null,
    todaysSlots: [],
    stats: {
      totalAttended: 0,
      totalSessions: 0,
      overallPercent: 0,
      minThreshold: 75,
      belowThreshold: false,
    },
    subjectBreakdown: [],
  });
  const [weeklyTimetable, setWeeklyTimetable] = useState<any[]>([]);

  const isProfileLocked = !!user?.studentProfile?.isProfileLocked;
  const classId = user?.studentProfile?.classId;

  const fetchOverview = useCallback(async () => {
    try {
      const [ovRes, ttRes] = await Promise.all([
        api.get('/api/attendance/student-overview'),
        api.get('/api/timetable/my-student'),
      ]);
      if (ovRes.data) setData(ovRes.data);
      setWeeklyTimetable(ttRes.data?.slots || []);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useRealtimeSync(
    ['attendance:session_started', 'attendance:session_closed', 'attendance:session_extended', 'timetable:updated', 'data:updated'],
    fetchOverview,
    { classId }
  );

  const { student, activeSession, todaysSlots, stats, subjectBreakdown, dayWiseAttendance = [] } = data;

  if (isLoading) {
    return (
      <DatabaseLoader
        message="Please wait, loading your Student Dashboard..."
        subtext="Checking active GPS sessions, timetable, and attendance from Supabase"
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Welcome & Profile Header */}
      <div className="p-6 rounded-3xl bg-white border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Welcome back, {user?.name || 'Student'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {student?.class?.name && (
              <Badge variant="brand" size="sm">{student.class.name}</Badge>
            )}
            {student?.class?.advisorName && (
              <Badge variant="neutral" size="sm">Advisor: {student.class.advisorName}</Badge>
            )}
            <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
              Roll: {user?.studentProfile?.rollNo || '—'}
            </span>
            <span className="font-mono text-xs text-content-secondary">
              Reg: {user?.studentProfile?.registerNo || '—'}
            </span>
          </div>
        </div>

        <Button
          variant={isProfileLocked ? 'secondary' : 'primary'}
          size="sm"
          leftIcon={isProfileLocked ? <Lock className="w-3.5 h-3.5 text-emerald-600" /> : <UserCheck className="w-3.5 h-3.5" />}
          onClick={() => setIsProfileModalOpen(true)}
        >
          {isProfileLocked ? 'View Locked Profile' : 'Complete Profile'}
        </Button>
      </div>

      {/* Incomplete Profile Alert */}
      {!isProfileLocked && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold">Institutional Profile Incomplete</h4>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Please complete your personal and guardian details. Once saved, your profile will be locked for security.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setIsProfileModalOpen(true)}>
            Complete Details
          </Button>
        </div>
      )}

      {/* Low Attendance Warning */}
      {stats.belowThreshold && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong>Low Attendance Warning:</strong> Your overall attendance ({stats.overallPercent}%) is below the required {stats.minThreshold}%.
          </div>
        </div>
      )}

      {/* Live GPS Session Banner (ONLY shown when faculty has an open session for this class) */}
      {activeSession && (
        <div className="p-5 rounded-3xl bg-brand-gradient text-white shadow-glass relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-white/20 backdrop-blur-md text-white shrink-0 animate-bounce">
              <CalendarCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-accent-cyan text-slate-900 text-[10px] font-black uppercase tracking-wider">
                  LIVE NOW
                </span>
                <span className="text-xs text-white/90 font-mono">
                  Ends {new Date(activeSession.expiresAt).toLocaleTimeString()}
                </span>
              </div>
              <h3 className="text-lg font-heading font-extrabold text-white mt-0.5">
                {activeSession.subjectName} ({activeSession.subjectCode})
              </h3>
              <p className="text-xs text-white/80">
                {activeSession.facultyName} opened GPS attendance session
              </p>
            </div>
          </div>

          <Button
            size="md"
            onClick={() => navigate('/student/mark-attendance')}
            className="bg-white text-brand-700 hover:bg-slate-100 font-bold shadow-lg shrink-0"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {activeSession.alreadyMarked ? 'Attendance Marked ✓' : 'Mark Attendance Now'}
          </Button>
        </div>
      )}

      {/* Overall Attendance & Day-Wise Attendance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <ProgressRing
            progress={stats.overallPercent}
            size={110}
            strokeWidth={10}
            color={stats.belowThreshold ? '#EF4444' : '#10B981'}
          />
          <h3 className="text-lg font-heading font-bold text-content mt-3">Overall Attendance</h3>
          <p className="text-xs text-content-secondary">
            {isLoading ? '...' : `${stats.totalAttended} / ${stats.totalSessions} closed sessions`}
          </p>
          {stats.belowThreshold && (
            <Badge variant="danger" size="sm" className="mt-2">
              Below {stats.minThreshold}%
            </Badge>
          )}
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-heading font-bold text-content flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-600" />
              Day-Wise Attendance
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/student/attendance')}>
              Calendar &amp; History
            </Button>
          </div>
          {dayWiseAttendance.length === 0 ? (
            <div className="py-8 text-center text-xs text-content-secondary">
              Day-wise attendance appears once sessions are closed for your class.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {dayWiseAttendance.slice(0, 7).map((day: any) => (
                <div key={day.date} className="p-3 rounded-2xl bg-surface-soft border border-border space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-content">{day.date}</span>
                    <span className="font-semibold text-content-secondary">
                      Attended {day.attended} of {day.total} periods ={' '}
                      <span className={day.percent < stats.minThreshold ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {day.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(day.periods || []).map((p: any, idx: number) => {
                      const pNum = p.periodNumber ?? p.period ?? idx + 1;
                      return (
                        <span
                          key={pNum}
                          title={`P${pNum}: ${p.status}`}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            p.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'ABSENT'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          P{pNum}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Today's Class Timetable */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-heading font-bold text-content flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            Today's Class Timetable
          </h3>
          <Badge variant="neutral">{todaysSlots.length} Period(s)</Badge>
        </div>
        {todaysSlots.length === 0 ? (
          <div className="py-6 text-center text-xs text-content-secondary">
            No periods scheduled for today in your class timetable.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {todaysSlots.map((slot: any) => (
              <div key={slot.id} className="p-3 rounded-2xl bg-surface-soft border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-content">
                    P{slot.periodNumber}: {slot.classSubject?.subject?.name} ({slot.classSubject?.subject?.code})
                  </span>
                  <span className="text-content-secondary block text-[11px]">
                    {slot.classSubject?.faculty?.user?.name} • Room {slot.roomNumber}
                  </span>
                </div>
                <span className="font-mono text-content-muted">{slot.startTime}–{slot.endTime}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Subject-Wise Breakdown */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-heading font-bold text-content flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-600" />
            Subject-Wise Attendance
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/student/history')}>
            Full History
          </Button>
        </div>

        {subjectBreakdown.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No attendance records yet"
            description="Your subject-wise attendance percentages will appear here as soon as sessions are conducted."
          />
        ) : (
          <div className="space-y-3">
            {subjectBreakdown.map((subj: any) => (
              <div key={subj.code} className="p-3 rounded-2xl bg-surface-soft border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-brand-600">{subj.code}</span>
                  <h4 className="text-sm font-bold text-content">{subj.name}</h4>
                  <span className="text-[11px] text-content-secondary">
                    {subj.attended} / {subj.total} classes
                  </span>
                </div>
                <Badge variant={subj.total > 0 && subj.percent < stats.minThreshold ? 'danger' : 'success'} size="md">
                  {subj.percent}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Read-only Class Timetable */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-heading font-bold text-content">Class Weekly Timetable</h3>
          <Badge variant="brand">{weeklyTimetable.length} Slots</Badge>
        </div>
        {weeklyTimetable.length === 0 ? (
          <div className="py-6 text-center text-xs text-content-secondary">
            Your class timetable has not been published yet.
          </div>
        ) : (
          <div className="divide-y divide-border text-xs">
            {weeklyTimetable.map((slot: any) => (
              <div key={slot.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-content">
                    {slot.dayOfWeek} • P{slot.periodNumber} ({slot.startTime}–{slot.endTime})
                  </span>
                  <span className="text-content-secondary block">
                    {slot.classSubject?.subject?.code} — {slot.classSubject?.subject?.name}
                  </span>
                </div>
                <div className="text-right text-content-muted">
                  <div>{slot.classSubject?.faculty?.user?.name}</div>
                  <div className="font-mono">{slot.roomNumber}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title={isProfileLocked ? 'Student Institutional Profile (Locked)' : 'Complete Your Profile'}
      >
        <StudentProfileCompletion onComplete={() => setIsProfileModalOpen(false)} />
      </Modal>
    </div>
  );
};
