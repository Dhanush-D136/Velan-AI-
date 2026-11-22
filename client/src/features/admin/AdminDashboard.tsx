import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import {
  Users,
  GraduationCap,
  Building2,
  CalendarCheck2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  MapPin,
  Sparkles,
  Download,
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings');
        setInstitutionName(res.data.settings?.INSTITUTION_NAME || '');
      } catch (e) {
        // quiet fallback
      }
    };
    fetchSettings();
  }, []);

  const deptAttendanceData = [
    { dept: 'CSE', attendance: 92 },
    { dept: 'ECE', attendance: 88 },
    { dept: 'MECH', attendance: 84 },
    { dept: 'CIVIL', attendance: 79 },
    { dept: 'IT', attendance: 91 },
  ];

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
            Welcome back, {user?.name || 'Administrator'} 👋
          </h1>
          <p className="text-sm text-white/90 mt-1 max-w-xl font-medium">
            {institutionName ? `${institutionName} • ` : ''}Real-time GPS geofence analytics, timetable slot verification, and campus AI intelligence.
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
            Export All
          </Button>
        </div>
      </div>

      {/* Global Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Enrolled Students"
          value="1,420"
          subtitle="Across 4 academic years"
          change={{ value: '+4.2%', isPositive: true }}
          icon={<GraduationCap className="w-5 h-5 text-brand-600" />}
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Active Faculty"
          value="84"
          subtitle="98% classes staffed"
          change={{ value: 'Full workload', isPositive: true }}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Today's Attendance"
          value="91.4%"
          subtitle="3,120 of 3,412 periods marked"
          change={{ value: '+2.1% vs yesterday', isPositive: true }}
          icon={<CalendarCheck2 className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Active GPS Sessions"
          value="6 Sessions"
          subtitle="Within 50m-500m geofence"
          change={{ value: 'Zero spoof flags', isPositive: true }}
          icon={<MapPin className="w-5 h-5 text-cyan-600" />}
          iconBg="bg-cyan-50"
        />
      </div>

      {/* Center Section: Live Sessions & Department Attendance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Comparison Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-heading font-bold text-content">
                Department Attendance Benchmark
              </h3>
              <p className="text-xs text-content-secondary mt-0.5">
                Calculated across all periods today
              </p>
            </div>
            <Badge variant="brand">Target: 75% Min</Badge>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        </Card>

        {/* Live Active Attendance Sessions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-bold text-content flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-emerald animate-ping" />
              Live Geofences
            </h3>
            <span className="text-xs font-bold text-brand-600 cursor-pointer" onClick={() => navigate('/admin/live-attendance')}>
              View all
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-surface-soft border border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-content block">CSE – Year 2 – A</span>
                <span className="text-[11px] text-content-secondary">
                  Data Structures • Dr. Ramesh
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    Radius: 500m
                  </span>
                  <span className="text-[10px] text-content-muted">28 / 30 Marked</span>
                </div>
              </div>
              <ProgressRing progress={93} size={48} strokeWidth={5} color="#10B981" />
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-soft border border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-content block">ECE – Year 3 – B</span>
                <span className="text-[11px] text-content-secondary">
                  Microcontrollers • Ms. Priya
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                    Radius: 250m
                  </span>
                  <span className="text-[10px] text-content-muted">25 / 28 Marked</span>
                </div>
              </div>
              <ProgressRing progress={89} size={48} strokeWidth={5} color="#0D9488" />
            </div>
          </div>
        </Card>
      </div>

      {/* Critical Shortage Alerts & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-Risk Students (< 75%) */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 text-accent-rose">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-content">
                  Attendance Shortage Alerts (&lt; 75%)
                </h3>
                <p className="text-xs text-content-secondary">Requires advisory notification</p>
              </div>
            </div>
            <Badge variant="danger">4 Students</Badge>
          </div>

          <div className="divide-y divide-border">
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-content">Karthik Raja S (22CS014)</span>
                <span className="text-[11px] text-content-muted block">CSE – Year 2 – A</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-accent-rose">68.2%</span>
                <span className="text-[10px] text-content-muted block">Short by 5 classes</span>
              </div>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-content">Sneha R (22EC029)</span>
                <span className="text-[11px] text-content-muted block">ECE – Year 2 – B</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-accent-rose">71.0%</span>
                <span className="text-[10px] text-content-muted block">Short by 3 classes</span>
              </div>
            </div>
          </div>
        </Card>

        {/* AI Insights Card */}
        <Card className="bg-gradient-to-br from-indigo-50/50 via-white to-pink-50/30 border-brand-200/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-gradient text-white shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-content">
                  Velan AI Pattern Detector
                </h3>
                <p className="text-xs text-content-secondary">Weekly campus behavioral analysis</p>
              </div>
            </div>
            <Badge variant="brand">Automated</Badge>
          </div>

          <p className="text-xs text-content leading-relaxed">
            "Friday afternoons exhibit a 12% drop in Lab attendance for Mechanical 3rd Year.
            Recommend shifting workshop blocks to Wednesday mornings to optimize hands-on participation."
          </p>

          <div className="mt-4 pt-4 border-t border-brand-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-brand-700">
              Generated across 12,400 GPS data points
            </span>
            <Button
              size="sm"
              variant="soft"
              onClick={() => navigate('/ai-insights')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Full Report
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
