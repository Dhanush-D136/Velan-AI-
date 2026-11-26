import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  CalendarCheck2,
  Clock,
  Users,
  BookOpen,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    stats: {
      todaysPeriodsCount: 0,
      assignedClassesCount: 0,
      totalAssignedStudents: 0,
      averageAttendance: 0,
    },
    todaysSlots: [],
    classSubjects: [],
    activeSession: null,
    recentSessions: [],
  });
  const [myTimetable, setMyTimetable] = useState<any[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const [overviewRes, ttRes] = await Promise.all([
        api.get('/api/attendance/faculty-overview'),
        api.get('/api/timetable/my-faculty'),
      ]);
      if (overviewRes.data) setData(overviewRes.data);
      setMyTimetable(ttRes.data?.slots || []);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useRealtimeSync(
    ['data:updated', 'timetable:updated', 'attendance:session_started', 'attendance:session_closed'],
    fetchDashboard
  );

  const { stats, todaysSlots, activeSession, recentSessions } = data;

  if (isLoading) {
    return (
      <DatabaseLoader
        message="Please wait, loading your Faculty Hub..."
        subtext="Syncing your timetable and assigned classes from Supabase"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl bg-faculty-gradient text-white shadow-glass relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            Faculty Teaching Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold mt-2">
            Welcome back, {user?.name || 'Faculty Member'}
          </h1>
          <p className="text-xs sm:text-sm text-white/90 mt-1 font-medium">
            {user?.facultyProfile?.designation || 'Teaching Faculty'}
            {user?.facultyProfile?.employeeId ? ` • Employee ID: ${user.facultyProfile.employeeId}` : ''}
          </p>
          <p className="text-xs sm:text-sm text-white font-bold mt-2">
            You have {todaysSlots.length} {todaysSlots.length === 1 ? 'class' : 'classes'} today
          </p>
        </div>

        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate('/faculty/attendance')}
          className="bg-white text-teal-800 hover:bg-slate-100 font-bold shadow-lg"
          leftIcon={<CalendarCheck2 className="w-5 h-5 text-teal-600" />}
        >
          {activeSession ? 'Open Active Session' : 'Launch GPS Attendance'}
        </Button>
      </div>

      {/* Quick Metrics (100% Real DB) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Today's Classes"
          value={isLoading ? '...' : `${stats.todaysPeriodsCount} Period(s)`}
          subtitle={`${myTimetable.length} total weekly slots`}
          icon={<Clock className="w-5 h-5 text-teal-600" />}
          iconBg="bg-teal-50"
        />
        <StatCard
          title="My Assigned Students"
          value={isLoading ? '...' : `${stats.totalAssignedStudents} Student(s)`}
          subtitle={`Across ${stats.assignedClassesCount} class(es)`}
          icon={<Users className="w-5 h-5 text-brand-600" />}
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Average Attendance"
          value={isLoading ? '...' : `${stats.averageAttendance}%`}
          subtitle={`${recentSessions.length} recorded session(s)`}
          icon={<CalendarCheck2 className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Today's Teaching Schedule */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-bold text-content">Today's Teaching Schedule</h3>
          <Badge variant="neutral">{todaysSlots.length} Period(s)</Badge>
        </div>

        {todaysSlots.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No classes scheduled for today"
            description="Once the Admin assigns your subjects and periods in the Timetable Builder, your schedule will appear here automatically."
          />
        ) : (
          <div className="space-y-3">
            {todaysSlots.map((slot: any) => {
              const slotState = slot.state || 'UPCOMING';
              const badgeVariant =
                slotState === 'LIVE'
                  ? 'brand'
                  : slotState === 'COMPLETED'
                    ? 'success'
                    : slotState === 'NOT_TAKEN'
                      ? 'warning'
                      : 'neutral';
              const targetRoute = slotState === 'COMPLETED' ? '/faculty/history' : '/faculty/attendance';
              const actionLabel =
                slotState === 'LIVE'
                  ? 'Open Live Roster'
                  : slotState === 'COMPLETED'
                    ? 'View Saved Record'
                    : 'Take Attendance';

              return (
                <div
                  key={slot.id}
                  onClick={() => navigate(targetRoute)}
                  className="p-4 rounded-2xl bg-surface-soft border border-border hover:border-brand-300 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand" size="sm">Period {slot.periodNumber}</Badge>
                      <Badge variant={badgeVariant} size="sm">{slotState.replace('_', ' ')}</Badge>
                      <span className="text-xs font-mono text-content-secondary">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-content mt-1">
                      {slot.classSubject?.subject?.name} ({slot.classSubject?.subject?.code})
                    </h4>
                    <p className="text-xs text-content-secondary">
                      {slot.class?.name} • Room: {slot.roomNumber} • {slot.studentCount ?? 0} Students
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={slotState === 'COMPLETED' ? 'secondary' : 'primary'}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(targetRoute);
                    }}
                  >
                    {actionLabel}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Read-Only Weekly Timetable */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-bold text-content flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-600" />
            My Weekly Timetable (Read-Only)
          </h3>
          <Badge variant="brand">{myTimetable.length} Total Slots</Badge>
        </div>
        {myTimetable.length === 0 ? (
          <div className="py-6 text-center text-xs text-content-secondary">
            No weekly timetable slots assigned to you yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {myTimetable.map((slot: any) => (
              <div key={slot.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-content">
                    {slot.dayOfWeek} • Period {slot.periodNumber} ({slot.startTime}–{slot.endTime})
                  </span>
                  <span className="text-content-secondary block">
                    {slot.classSubject?.subject?.code} — {slot.classSubject?.subject?.name}
                  </span>
                </div>
                <div className="text-right font-mono text-content-muted">
                  <div>{slot.class?.name}</div>
                  <div>{slot.roomNumber}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
