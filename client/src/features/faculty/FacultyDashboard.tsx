import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  CalendarCheck2,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FacultyDashboard: React.FC = () => {
  const navigate = useNavigate();

  const todayTimeline = [
    {
      period: 1,
      time: '09:00 - 10:00 AM',
      subject: 'Data Structures & Algorithms (CS301)',
      class: 'CSE – Year 2 – A',
      room: 'Lab 302',
      isCurrent: true,
      attendanceTaken: false,
    },
    {
      period: 2,
      time: '10:00 - 11:00 AM',
      subject: 'Data Structures & Algorithms (CS301)',
      class: 'CSE – Year 2 – A',
      room: 'Lab 302',
      isCurrent: false,
      attendanceTaken: false,
    },
    {
      period: 4,
      time: '12:15 - 01:15 PM',
      subject: 'Operating Systems (CS304)',
      class: 'CSE – Year 2 – B',
      room: 'Hall 201',
      isCurrent: false,
      attendanceTaken: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl bg-faculty-gradient text-white shadow-glass relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            Faculty Teaching Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold mt-2">
            Welcome, Dr. Ramesh Kumar
          </h1>
          <p className="text-xs sm:text-sm text-white/80 mt-1">
            Department of Computer Science and Engineering • Professor & HOD
          </p>
        </div>

        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate('/faculty/attendance')}
          className="bg-white text-teal-800 hover:bg-slate-100 font-bold shadow-lg"
          leftIcon={<CalendarCheck2 className="w-5 h-5 text-teal-600" />}
        >
          Launch GPS Attendance
        </Button>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Today's Classes"
          value="3 Periods"
          subtitle="2 Theory • 1 Lab Block"
          icon={<Clock className="w-5 h-5 text-teal-600" />}
          iconBg="bg-teal-50"
        />
        <StatCard
          title="My Assigned Students"
          value="60 Students"
          subtitle="CSE 2nd Year (Sections A & B)"
          icon={<Users className="w-5 h-5 text-brand-600" />}
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Average Attendance"
          value="93.8%"
          subtitle="Past 30 days verified"
          change={{ value: '+1.5%', isPositive: true }}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Today's Teaching Timeline */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-heading font-bold text-content">Today's Class Schedule</h3>
            <p className="text-xs text-content-secondary mt-0.5">
              Attendance button is active during the class window (+/- 10 min grace period)
            </p>
          </div>
          <Badge variant="faculty">Semester 4 Active</Badge>
        </div>

        <div className="space-y-4">
          {todayTimeline.map((item) => (
            <div
              key={item.period}
              className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                item.isCurrent
                  ? 'bg-teal-50/80 border-teal-300 ring-2 ring-teal-500/20 shadow-sm'
                  : 'bg-surface-soft border-border'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-2xl shrink-0 font-mono text-center w-16 ${
                    item.isCurrent ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-200 text-content'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold block">Period</span>
                  <span className="text-xl font-bold leading-none">{item.period}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-content">{item.subject}</span>
                    {item.isCurrent && (
                      <Badge variant="success" size="sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-ping mr-1" />
                        In Progress
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-content-secondary mt-1">
                    {item.class} • Room {item.room}
                  </p>
                  <span className="text-[11px] font-mono text-content-muted mt-1 block">
                    {item.time}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {item.isCurrent ? (
                  <Button
                    variant="faculty"
                    size="md"
                    onClick={() => navigate('/faculty/attendance')}
                    leftIcon={<MapPin className="w-4 h-4" />}
                    className="w-full md:w-auto font-bold shadow-glass"
                  >
                    Take GPS Attendance
                  </Button>
                ) : (
                  <span className="text-xs text-content-muted font-medium">Scheduled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
