import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  CalendarDays,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const StudentAttendanceHistoryPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('November 2026');

  const subjectPercentages = [
    { code: 'CS301', name: 'Data Structures & Algorithms', attended: 26, total: 27, percent: 96.3, color: '#6366F1' },
    { code: 'CS302', name: 'Computer Networks', attended: 22, total: 24, percent: 91.6, color: '#06B6D4' },
    { code: 'CS303', name: 'Database Management Systems', attended: 21, total: 22, percent: 95.4, color: '#10B981' },
    { code: 'CS304', name: 'Operating Systems', attended: 23, total: 25, percent: 92.0, color: '#8B5CF6' },
    { code: 'MA301', name: 'Discrete Mathematics', attended: 18, total: 20, percent: 90.0, color: '#F59E0B' },
  ];

  // Calendar Heatmap Days (30 days of November)
  const heatmapDays = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    // Weekends (Sundays)
    if (day % 7 === 1) return { day, status: 'WEEKEND', periodsAttended: 0, total: 0 };
    // Leave / Absent on Day 12
    if (day === 12) return { day, status: 'ABSENT', periodsAttended: 0, total: 5 };
    // Partial Day on Day 18
    if (day === 18) return { day, status: 'PARTIAL', periodsAttended: 4, total: 6 };
    // All other working days full present
    return { day, status: 'PRESENT', periodsAttended: 6, total: 6 };
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Attendance Heatmap & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Student: <span className="font-bold text-content">Arunachalam V</span> (Reg: 710022104001 • CSE 2nd Year A)
          </p>
        </div>

        <Badge variant="success" size="md">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Overall: 94.2% (Shortage Risk: None)
        </Badge>
      </div>

      {/* Safe-Bunk Calculator Card */}
      <Card className="bg-gradient-to-r from-emerald-500/10 via-brand-500/5 to-cyan-500/10 border-brand-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-brand-gradient text-white shadow-md shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-base text-content">
              Smart Safe-Bunk Calculator
            </h3>
            <p className="text-xs text-content-secondary mt-1 leading-relaxed">
              Based on your attendance in 83 completed periods and minimum collegiate threshold of <strong className="text-content">75%</strong>:
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white border border-border">
                <span className="text-[10px] uppercase font-bold text-content-secondary">
                  Safe to Miss
                </span>
                <p className="text-xl font-bold font-heading text-accent-emerald">4 Classes</p>
                <span className="text-[10px] text-content-muted">Resulting: 81.5%</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-border">
                <span className="text-[10px] uppercase font-bold text-content-secondary">
                  Max Miss to 75%
                </span>
                <p className="text-xl font-bold font-heading text-accent-amber">7 Classes</p>
                <span className="text-[10px] text-content-muted">Resulting: 75.2%</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-border">
                <span className="text-[10px] uppercase font-bold text-content-secondary">
                  Medical / OD Condonation
                </span>
                <p className="text-xl font-bold font-heading text-brand-600">Eligible</p>
                <span className="text-[10px] text-content-muted">Up to 65% with certificate</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Subject-Wise Percentage Rings */}
      <Card>
        <h3 className="font-heading font-bold text-base text-content mb-4">
          Subject-Wise Attendance Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          {subjectPercentages.map((sub) => (
            <div key={sub.code} className="p-3 rounded-2xl bg-surface-soft border border-border flex flex-col items-center">
              <ProgressRing progress={sub.percent} size={84} strokeWidth={7} color={sub.color} />
              <span className="text-xs font-bold text-content mt-2 block font-mono">{sub.code}</span>
              <span className="text-[10px] text-content-secondary truncate max-w-[120px]">{sub.name}</span>
              <span className="text-[10px] text-content-muted mt-1">{sub.attended}/{sub.total} periods</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Calendar Heatmap (Monthly View) */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-600" />
            <h3 className="font-heading font-bold text-base text-content">
              Attendance Heatmap — {selectedMonth}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-content-secondary flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Present
            </span>
            <span className="text-xs text-content-secondary flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Partial
            </span>
            <span className="text-xs text-content-secondary flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Absent
            </span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-content-secondary py-1">
              {d}
            </div>
          ))}

          {heatmapDays.map((d) => (
            <div
              key={d.day}
              className={`h-16 rounded-2xl p-2 border flex flex-col justify-between transition-all hover:scale-105 cursor-pointer ${
                d.status === 'WEEKEND'
                  ? 'bg-slate-50 border-border/50 text-content-muted opacity-60'
                  : d.status === 'ABSENT'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : d.status === 'PARTIAL'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <span className="text-xs font-bold">{d.day}</span>
              {d.status !== 'WEEKEND' && (
                <span className="text-[10px] font-mono font-semibold">
                  {d.periodsAttended}/{d.total}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
