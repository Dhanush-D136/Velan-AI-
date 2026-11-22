import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { StudentProfileCompletion } from './StudentProfileCompletion';
import {
  CalendarCheck2,
  Clock,
  MapPin,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  UserCheck,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const isProfileLocked = !!user?.studentProfile?.isProfileLocked;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Welcome & Profile Status Header */}
      <div className="p-6 rounded-3xl bg-white border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Welcome back, {user?.name || 'Student'} 👋
          </h1>
          <div className="flex items-center gap-2 mt-1">
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

      {/* Incomplete Profile Alert Banner */}
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

      {/* Active Attendance Broadcast Banner (Alert when Faculty opens session) */}
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
              <span className="text-xs text-white/90 font-mono">08:24 remaining</span>
            </div>
            <h3 className="text-lg font-heading font-extrabold text-white mt-0.5">
              Data Structures & Algorithms (CS301)
            </h3>
            <p className="text-xs text-white/80">Dr. Ramesh Kumar opened GPS attendance session</p>
          </div>
        </div>

        <Button
          size="md"
          onClick={() => navigate('/student/mark-attendance')}
          className="bg-white text-brand-700 hover:bg-slate-100 font-bold shadow-lg w-full sm:w-auto"
          rightIcon={<ArrowRight className="w-4 h-4 text-brand-600" />}
        >
          Mark My Attendance
        </Button>
      </div>

      {/* Overview Cards: Attendance Ring & Current Class */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Attendance Summary */}
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <ProgressRing progress={94.2} size={115} strokeWidth={9} color="#6366F1" />
          <h4 className="font-heading font-bold text-sm text-content mt-3">
            Overall Attendance Rate
          </h4>
          <span className="text-xs text-content-secondary mt-0.5">78 of 83 periods attended</span>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-accent-emerald text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Well Above 75%
          </div>
        </Card>

        {/* Current Class Progress */}
        <Card className="md:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                Ongoing Period
              </span>
              <Badge variant="brand">Period 2 (10:00 - 11:00 AM)</Badge>
            </div>
            <h3 className="text-xl font-heading font-bold text-content">
              Data Structures & Algorithms
            </h3>
            <p className="text-xs text-content-secondary mt-1">
              Dr. Ramesh Kumar • Lab Hall 302 • CSE Year 2 Section A
            </p>

            {/* Class Timeline Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-content-muted mb-1.5">
                <span>Class Elapsed: 35 mins</span>
                <span className="font-mono font-bold text-content">25 mins left</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-brand-gradient rounded-full" style={{ width: '58%' }} />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
            <span className="text-content-secondary">Next: Computer Networks @ 11:15 AM</span>
            <span className="font-semibold text-brand-600 cursor-pointer" onClick={() => navigate('/student/timetable')}>
              View Full Timetable →
            </span>
          </div>
        </Card>
      </div>

      {/* Safe-Bunk Calculator Card */}
      <Card className="bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 border-emerald-200/70 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-accent-emerald shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-accent-emerald">
                Velan Safe-Bunk Calculator
              </span>
              <h4 className="text-base font-heading font-bold text-content mt-0.5">
                You can safely miss <span className="text-accent-emerald font-extrabold">4 more classes</span> this month
              </h4>
              <p className="text-xs text-content-secondary mt-1">
                Your current attendance is 94.2%. Missing 4 classes will keep your attendance at 81.5%, comfortably above the college 75% minimum requirement.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="soft"
            onClick={() => navigate('/student/attendance')}
            className="text-xs shrink-0"
          >
            Breakdown
          </Button>
        </div>
      </Card>

      {/* Today's Classes List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-base text-content">Today's Class Schedule</h3>
          <span className="text-xs text-content-secondary font-mono">Monday, Nov 22</span>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-brand-600 uppercase">
                Period 1 • 09:00 - 10:00 AM
              </span>
              <h4 className="text-xs font-bold text-content">Data Structures (CS301)</h4>
              <p className="text-[11px] text-content-secondary">Dr. Ramesh Kumar • Lab 302</p>
            </div>
            <Badge variant="success" size="sm">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Marked (GPS)
            </Badge>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-teal-600 uppercase">
                Period 2 • 10:00 - 11:00 AM (Ongoing)
              </span>
              <h4 className="text-xs font-bold text-content">Data Structures (CS301)</h4>
              <p className="text-[11px] text-content-secondary">Dr. Ramesh Kumar • Lab 302</p>
            </div>
            <Button
              size="sm"
              variant="faculty"
              onClick={() => navigate('/student/mark-attendance')}
              className="text-xs"
            >
              Mark GPS
            </Button>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-soft border border-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-content-muted uppercase">
                Period 3 • 11:15 - 12:15 PM
              </span>
              <h4 className="text-xs font-bold text-content">Computer Networks (CS302)</h4>
              <p className="text-[11px] text-content-secondary">Ms. Priya S • Hall 201</p>
            </div>
            <span className="text-xs text-content-muted font-medium">Upcoming</span>
          </div>
        </div>
      </Card>

      {/* Profile Completion / Dossier Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Student Profile Details"
        description="View or complete your institutional student records."
      >
        <StudentProfileCompletion onComplete={() => setIsProfileModalOpen(false)} />
      </Modal>
    </div>
  );
};
