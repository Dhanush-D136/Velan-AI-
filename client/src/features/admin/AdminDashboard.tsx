import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  Users,
  GraduationCap,
  CalendarCheck2,
  AlertTriangle,
  MapPin,
  Download,
  Clock,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [institutionName, setInstitutionName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    stats: {
      totalStudents: 0,
      totalFaculty: 0,
      totalClasses: 0,
      totalDepartments: 0,
      sessionsToday: 0,
      overallAttendanceToday: 0,
      activeSessionsCount: 0,
      minThreshold: 75,
    },
    liveSessions: [],
    todaysClasses: [],
    departmentAttendance: [],
    lowAttendanceStudents: [],
    recentSessions: [],
  });

  const fetchOverview = useCallback(async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/admin/dashboard-stats'),
      ]);
      setInstitutionName(settingsRes.data.settings?.INSTITUTION_NAME || '');
      if (statsRes.data) {
        setData(statsRes.data);
      }
    } catch (e) {
      // handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useRealtimeSync(
    ['data:updated', 'attendance:session_started', 'attendance:session_closed', 'attendance:marked'],
    fetchOverview
  );

  const { stats, liveSessions, todaysClasses, departmentAttendance, lowAttendanceStudents, recentSessions } = data;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-8 rounded-3xl bg-brand-gradient text-white shadow-glass relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              Velan AI Command Center
            </span>
            <span className="flex items-center gap-1 text-xs text-accent-cyan font-semibold">
              <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" /> Live System Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-heading font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Administrator'}
          </h1>
          <p className="text-sm text-white/90 mt-1 max-w-xl font-medium">
            {institutionName ? `${institutionName} • ` : ''}Real-time GPS geofence analytics, timetable slot verification, and campus attendance monitor.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/admin/live-attendance')}
            className="bg-white/95 text-brand-700 hover:bg-white shadow-md font-bold"
            leftIcon={<CalendarCheck2 className="w-4 h-4 text-brand-600" />}
          >
            Live GPS Monitor
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => navigate('/admin/reports')}
            className="text-white hover:bg-white/20 border border-white/30"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Reports
          </Button>
        </div>
      </div>

      {/* Global Stat Cards Grid (100% Database Computed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Enrolled Students"
          value={isLoading ? '...' : String(stats.totalStudents)}
          subtitle={`Across ${stats.totalClasses} active class(es)`}
          icon={<GraduationCap className="w-5 h-5 text-brand-600" />}
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Active Faculty"
          value={isLoading ? '...' : String(stats.totalFaculty)}
          subtitle={`Across ${stats.totalDepartments} department(s)`}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Today's Attendance"
          value={isLoading ? '...' : `${stats.overallAttendanceToday}%`}
          subtitle={`${stats.sessionsToday} session(s) held today`}
          icon={<CalendarCheck2 className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Active GPS Sessions"
          value={isLoading ? '...' : `${stats.activeSessionsCount} Live`}
          subtitle="Real-time geofence radar"
          icon={<MapPin className="w-5 h-5 text-cyan-600" />}
          iconBg="bg-cyan-50"
        />
      </div>

      {/* Center Section: Department Attendance & Live Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-heading font-bold text-content">
                Department Attendance Benchmark
              </h3>
              <p className="text-xs text-content-secondary mt-0.5">
                Computed from all recorded attendance sessions
              </p>
            </div>
            <Badge variant="brand">Target: {stats.minThreshold}% Min</Badge>
          </div>

          {departmentAttendance.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No departments created yet"
              description="Create departments, classes, and run attendance sessions to see live department benchmarks."
              actionLabel="Setup Classes & Subjects"
              onAction={() => navigate('/admin/academics')}
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="dept" stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#EEF2FF', opacity: 0.5 }}
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    }}
                    formatter={(val: any) => [`${val}%`, 'Attendance']}
                  />
                  <Bar dataKey="attendance" fill="#6366F1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Live Active Attendance Sessions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-bold text-content flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-emerald animate-ping" />
              Live Geofences
            </h3>
            <span
              className="text-xs font-bold text-brand-600 cursor-pointer"
              onClick={() => navigate('/admin/live-attendance')}
            >
              View all
            </span>
          </div>

          {liveSessions.length === 0 ? (
            <div className="py-10 text-center text-xs text-content-secondary">
              No active GPS attendance sessions right now.
            </div>
          ) : (
            <div className="space-y-3">
              {liveSessions.map((sess: any) => (
                <div
                  key={sess.id}
                  onClick={() => navigate('/admin/live-attendance')}
                  className="p-3.5 rounded-2xl bg-surface-soft border border-border flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors"
                >
                  <div>
                    <span className="text-xs font-bold text-content block">{sess.className}</span>
                    <span className="text-[11px] text-content-secondary">
                      {sess.subjectName} • {sess.facultyName}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                        Radius: {sess.radiusMeters}m
                      </span>
                      <span className="text-[10px] text-content-muted">
                        {sess.presentCount} / {sess.totalEnrolled} Present
                      </span>
                    </div>
                  </div>
                  <ProgressRing progress={sess.percentage} size={48} strokeWidth={5} color="#10B981" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Today's Timetable Classes & Low Attendance Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-content">
                  Today's Scheduled Classes
                </h3>
                <p className="text-xs text-content-secondary">Live status of timetable slots</p>
              </div>
            </div>
            <Badge variant="neutral">{todaysClasses.length} Slots</Badge>
          </div>

          {todaysClasses.length === 0 ? (
            <div className="py-8 text-center text-xs text-content-secondary">
              No timetable slots scheduled for today. Configure slots in the Timetable Builder.
            </div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {todaysClasses.map((slot: any) => (
                <div key={slot.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-content block">
                      P{slot.periodNumber}: {slot.subjectName} ({slot.subjectCode})
                    </span>
                    <span className="text-[11px] text-content-muted">
                      {slot.className} • {slot.facultyName} • {slot.startTime}–{slot.endTime}
                    </span>
                  </div>
                  <Badge
                    variant={
                      slot.state === 'LIVE'
                        ? 'success'
                        : slot.state === 'COMPLETED'
                        ? 'brand'
                        : slot.state === 'NOT_TAKEN'
                        ? 'danger'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {slot.state.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 text-accent-rose">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-content">
                  Low Attendance Alerts (&lt; {stats.minThreshold}%)
                </h3>
                <p className="text-xs text-content-secondary">Students requiring advisory notice</p>
              </div>
            </div>
            <Badge variant="danger">{lowAttendanceStudents.length} Students</Badge>
          </div>

          {lowAttendanceStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-content-secondary flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>No students currently below {stats.minThreshold}% attendance.</span>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {lowAttendanceStudents.map((st: any) => (
                <div key={st.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-content">
                      {st.name} ({st.registerNo})
                    </span>
                    <span className="text-[11px] text-content-muted block">{st.className}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-accent-rose">{st.percent}%</span>
                    <span className="text-[10px] text-content-muted block">
                      {st.attended} / {st.total} periods
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Completed Sessions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-heading font-bold text-content">Recent Completed Sessions</h3>
          <Badge variant="neutral">{recentSessions.length} Recent</Badge>
        </div>
        {recentSessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-content-secondary">
            No completed attendance sessions yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentSessions.map((sess: any) => (
              <div key={sess.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-content">
                    {sess.className} — {sess.subjectName} ({sess.subjectCode})
                  </span>
                  <span className="text-content-muted block text-[11px]">
                    Faculty: {sess.facultyName} • {new Date(sess.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-emerald-600 font-bold">{sess.presentCount} P</span>
                  <span className="text-rose-600 font-bold">{sess.absentCount} A</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
