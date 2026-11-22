import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  MapPin,
  Clock,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

export const LiveAttendanceMonitor: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState('CSE – Year 2 – A');

  // Realistic mock live students
  const students = [
    { id: '1', name: 'Arunachalam V', rollNo: '22CS001', status: 'PRESENT', method: 'GPS', distance: '48m', time: '10:02 AM' },
    { id: '2', name: 'Bhavani S', rollNo: '22CS002', status: 'PRESENT', method: 'GPS', distance: '112m', time: '10:03 AM' },
    { id: '3', name: 'Chandran M', rollNo: '22CS003', status: 'PRESENT', method: 'GPS', distance: '65m', time: '10:03 AM' },
    { id: '4', name: 'Divya P', rollNo: '22CS004', status: 'PRESENT', method: 'GPS', distance: '82m', time: '10:04 AM' },
    { id: '5', name: 'Eashwar K', rollNo: '22CS005', status: 'PRESENT', method: 'MANUAL', distance: 'Override', time: '10:05 AM' },
    { id: '6', name: 'Gowtham N', rollNo: '22CS006', status: 'PRESENT', method: 'GPS', distance: '140m', time: '10:05 AM' },
    { id: '7', name: 'Hariharan T', rollNo: '22CS007', status: 'PRESENT', method: 'GPS', distance: '94m', time: '10:06 AM' },
    { id: '8', name: 'Janani R', rollNo: '22CS008', status: 'ABSENT', method: 'NONE', distance: 'Out of radius', time: '-' },
    { id: '9', name: 'Karthik Raja S', rollNo: '22CS009', status: 'ABSENT', method: 'NONE', distance: '-', time: '-' },
    { id: '10', name: 'Lavanya M', rollNo: '22CS010', status: 'PRESENT', method: 'GPS', distance: '78m', time: '10:07 AM' },
  ];

  const presentCount = students.filter((s) => s.status === 'PRESENT').length;
  const totalCount = students.length;
  const percentage = Math.round((presentCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
              Live Attendance Monitor
            </h1>
            <Badge variant="success" size="sm">
              <span className="w-2 h-2 rounded-full bg-accent-emerald animate-ping mr-1" />
              Live Socket.IO Stream
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Real-time GPS geofence radar, active radius, and instant student verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-border bg-white text-xs sm:text-sm font-semibold text-content outline-none shadow-sm focus:border-brand-500"
          >
            <option value="CSE – Year 2 – A">CSE – Year 2 – A (Data Structures)</option>
            <option value="ECE – Year 3 – B">ECE – Year 3 – B (Microcontrollers)</option>
            <option value="MECH – Year 1 – A">MECH – Year 1 – A (Engineering Graphics)</option>
          </select>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Sync
          </Button>
        </div>
      </div>

      {/* Live Session Status Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <Card className="lg:col-span-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                  GEOFENCE ANCHOR ACTIVE
                </span>
                <span className="text-xs text-slate-300 font-mono">ID: sess_9421_live</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">
                Data Structures & Algorithms (CS301)
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Faculty Anchor: <span className="text-white font-medium">Dr. Ramesh Kumar</span> • Anchor
                Coords: <span className="font-mono text-accent-cyan">13.0827° N, 80.2707° E</span>
              </p>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
              <div className="flex items-center gap-2 text-accent-cyan">
                <Clock className="w-5 h-5 animate-pulse" />
                <span className="text-xl font-mono font-bold">06:42 left</span>
              </div>
              <span className="text-[11px] text-slate-300">Radius: 500 meters</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Total Enrolled</span>
              <p className="text-xl font-bold font-heading">{totalCount}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-emerald-400">Verified Present</span>
              <p className="text-xl font-bold font-heading text-emerald-400">{presentCount}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-rose-400">Not Yet Marked</span>
              <p className="text-xl font-bold font-heading text-rose-400">{totalCount - presentCount}</p>
            </div>
          </div>
        </Card>

        {/* Live Attendance Progress Ring */}
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <ProgressRing progress={percentage} size={120} strokeWidth={10} color="#10B981" />
          <h4 className="font-heading font-bold text-sm text-content mt-3">Live Response Rate</h4>
          <p className="text-xs text-content-secondary mt-0.5">{presentCount} of {totalCount} verified</p>
        </Card>
      </div>

      {/* Visual GPS Radar / Map Simulation Card */}
      <Card className="overflow-hidden p-0 border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-soft">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            <div>
              <h3 className="text-sm font-heading font-bold text-content">
                Geofence Perimeter & Student Locations (OpenStreetMap)
              </h3>
              <p className="text-xs text-content-secondary">
                Anchor centered at Faculty Position with 500m geofence radius
              </p>
            </div>
          </div>
          <Badge variant="brand">High Accuracy GPS</Badge>
        </div>

        {/* Map Representation with Anchor & Coordinates */}
        <div className="relative h-64 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Subtle Grid Map pattern */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Radar Circles */}
          <div className="absolute w-80 h-80 rounded-full border border-brand-500/30 animate-ping opacity-30 pointer-events-none" />
          <div className="absolute w-56 h-56 rounded-full border-2 border-dashed border-accent-cyan/60 pointer-events-none" />
          <div className="absolute w-36 h-36 rounded-full bg-brand-500/10 pointer-events-none" />

          {/* Faculty Anchor Marker */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-3 rounded-full bg-brand-gradient text-white shadow-xl shadow-brand-500/50 ring-4 ring-white/20">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <span className="mt-2 text-xs font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-full border border-white/20">
              Anchor: Dr. Ramesh (Lab 302)
            </span>
          </div>

          {/* Student Pins in Geofence */}
          <div className="absolute top-16 left-28 z-10 flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            Arunachalam (48m)
          </div>

          <div className="absolute bottom-16 right-36 z-10 flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            Bhavani (112m)
          </div>

          <div className="absolute top-20 right-24 z-10 flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-rose" />
            Janani (720m - Outside)
          </div>
        </div>
      </Card>

      {/* Student Verification Roster Grid */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-heading font-bold text-content">
            Class Roster Verification Stream
          </h3>
          <span className="text-xs text-content-secondary">
            Auto-refreshes on student submit
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {students.map((student) => (
            <div
              key={student.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                student.status === 'PRESENT'
                  ? 'bg-emerald-50/60 border-emerald-200/80'
                  : 'bg-rose-50/60 border-rose-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Avatar name={student.name} size="sm" />
                <Badge
                  variant={student.status === 'PRESENT' ? 'success' : 'danger'}
                  size="sm"
                >
                  {student.status}
                </Badge>
              </div>

              <h4 className="text-xs font-bold text-content truncate">{student.name}</h4>
              <p className="text-[11px] text-content-secondary font-mono">{student.rollNo}</p>

              <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-content-muted">
                <span>{student.method}</span>
                <span className="font-semibold text-content">{student.distance}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
