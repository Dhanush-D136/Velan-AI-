import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
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

  const { student, stats, subjectBreakdown, history } = data;

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
