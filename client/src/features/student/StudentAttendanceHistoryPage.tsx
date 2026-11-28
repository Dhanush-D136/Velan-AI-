import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  CheckCircle2,
  AlertTriangle,
  History,
  CalendarDays,
} from 'lucide-react';

export const StudentAttendanceHistoryPage: React.FC = () => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    student: null,
    stats: { totalAttended: 0, totalSessions: 0, overallPercent: 0, minThreshold: 75, belowThreshold: false },
    subjectBreakdown: [],
    history: [],
  });

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/attendance/student-overview');
      if (res.data) setData(res.data);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useRealtimeSync(
    ['attendance:marked', 'attendance:session_closed', 'data:updated'],
    fetchHistory,
    { classId: user?.studentProfile?.classId }
  );

  const { student, stats, subjectBreakdown, history, dayWiseAttendance = [] } = data;
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const dayMap = new Map<string, any>();
  for (const d of dayWiseAttendance) {
    dayMap.set(d.date, d);
  }
  const [yearStr, monthStr] = selectedMonth.split('-');
  const daysInMonth = yearStr && monthStr ? new Date(Number(yearStr), Number(monthStr), 0).getDate() : 30;
  const firstDayOfWeek = yearStr && monthStr ? new Date(Number(yearStr), Number(monthStr) - 1, 1).getDay() : 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <InlineLoader context="attendance_history" label="Loading your attendance" subtext="Fetching subject-wise percentages." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Attendance History &amp; Subject Breakdown
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Student: <span className="font-bold text-content">{user?.name}</span>{' '}
            {student ? `(Reg: ${student.registerNo} • ${student.class?.name || ''})` : ''}
          </p>
        </div>

        <Badge variant={stats.belowThreshold ? 'danger' : 'success'} size="md">
          {stats.belowThreshold ? (
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          )}
          Overall: {stats.overallPercent}% ({stats.totalAttended}/{stats.totalSessions})
        </Badge>
      </div>

      {/* Monthly Calendar Heat View & Day-Wise Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-600" />
              Monthly Calendar Heat View
            </h3>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-border text-xs font-semibold bg-surface-soft"
            />
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-content-muted mb-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`;
              const info = dayMap.get(dateKey);
              let bg = 'bg-slate-50 text-content-secondary border-border';
              if (info) {
                if (info.percent >= stats.minThreshold) bg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                else if (info.percent >= 50) bg = 'bg-amber-100 text-amber-900 border-amber-300';
                else bg = 'bg-rose-100 text-rose-900 border-rose-300';
              }
              return (
                <div
                  key={dateKey}
                  title={info ? `${dateKey}: ${info.attended}/${info.total} (${info.percent}%)` : `${dateKey}: No closed sessions`}
                  className={`p-1.5 rounded-xl border text-center ${bg}`}
                >
                  <div className="text-xs font-bold">{dayNum}</div>
                  <div className="text-[9px] font-mono">{info ? `${info.percent}%` : '—'}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-content">Day-Wise Breakdown</h3>
            <Badge variant="neutral">{dayWiseAttendance.length} Days</Badge>
          </div>
          {dayWiseAttendance.length === 0 ? (
            <div className="py-8 text-center text-xs text-content-secondary">
              No closed attendance sessions recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {dayWiseAttendance.map((day: any) => (
                <div key={day.date} className="p-3 rounded-2xl bg-surface-soft border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-content">{day.date}</span>
                    <span className="font-semibold text-content-secondary">
                      Attended {day.attended} of {day.total} periods ={' '}
                      <strong className={day.percent < stats.minThreshold ? 'text-rose-600' : 'text-emerald-600'}>
                        {day.percent}%
                      </strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(day.periods || []).map((p: any, idx: number) => {
                      const pNum = p.periodNumber ?? p.period ?? idx + 1;
                      return (
                        <span
                          key={pNum}
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

      {/* Subject Breakdown */}
      <Card>
        <h3 className="font-heading font-bold text-base text-content mb-4">Subject-Wise Attendance</h3>
        {!isLoading && subjectBreakdown.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No attendance data yet"
            description="Subject-wise statistics will appear once sessions are recorded for your class."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subjectBreakdown.map((subj: any) => (
              <div key={subj.code} className="p-4 rounded-2xl bg-surface-soft border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-brand-600">{subj.code}</span>
                  <h4 className="text-sm font-bold text-content">{subj.name}</h4>
                  <span className="text-xs text-content-secondary">
                    {subj.attended} / {subj.total} periods
                  </span>
                </div>
                <Badge variant={subj.total > 0 && subj.percent < stats.minThreshold ? 'danger' : 'success'}>
                  {subj.percent}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Session-by-Session History */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
            <History className="w-4 h-4 text-brand-600" />
            Session History
          </h3>
          <Badge variant="neutral">{history.length} Record(s)</Badge>
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-xs text-content-secondary">
            No attendance marks recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((item: any) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-content">
                    {item.subjectName} ({item.subjectCode})
                  </span>
                  <span className="text-content-secondary block text-[11px]">
                    {item.facultyName} • {new Date(item.markedAt).toLocaleString()} • Method: {item.method}
                    {item.distanceMeters != null ? ` (${Math.round(item.distanceMeters)}m)` : ''}
                  </span>
                </div>
                <Badge variant={item.status === 'PRESENT' ? 'success' : 'danger'} size="sm">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
