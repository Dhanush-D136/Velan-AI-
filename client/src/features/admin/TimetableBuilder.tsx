import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  CalendarDays,
  Plus,
  AlertTriangle,
  Sparkles,
  Printer,
  Copy,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';

interface SlotData {
  day: string;
  period: number;
  subject: string;
  subjectCode: string;
  faculty: string;
  room: string;
  isLab?: boolean;
}

export const TimetableBuilder: React.FC = () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periods = [1, 2, 3, 4, 5, 6, 7];

  const periodTimings = [
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:15 - 12:15',
    '12:15 - 01:15',
    '02:00 - 03:00',
    '03:00 - 04:00',
    '04:00 - 04:50',
  ];

  const [selectedClass, setSelectedClass] = useState('CSE – Year 2 – A');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ day: string; period: number } | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Form states for slot editor
  const [slotSubject, setSlotSubject] = useState('Data Structures');
  const [slotFaculty, setSlotFaculty] = useState('Dr. Ramesh Kumar');
  const [slotRoom, setSlotRoom] = useState('Lab 302');
  const [isLabBlock, setIsLabBlock] = useState(false);

  // Initial demo schedule
  const [schedule, setSchedule] = useState<Record<string, SlotData>>({
    'Monday-1': { day: 'Monday', period: 1, subject: 'Data Structures', subjectCode: 'CS301', faculty: 'Dr. Ramesh Kumar', room: 'Lab 302' },
    'Monday-2': { day: 'Monday', period: 2, subject: 'Data Structures', subjectCode: 'CS301', faculty: 'Dr. Ramesh Kumar', room: 'Lab 302' },
    'Monday-3': { day: 'Monday', period: 3, subject: 'Computer Networks', subjectCode: 'CS302', faculty: 'Ms. Priya S', room: 'Hall 201' },
    'Monday-5': { day: 'Monday', period: 5, subject: 'Database Management', subjectCode: 'CS303', faculty: 'Dr. Suresh V', room: 'Hall 201' },

    'Tuesday-1': { day: 'Tuesday', period: 1, subject: 'Discrete Mathematics', subjectCode: 'MA301', faculty: 'Prof. Anitha M', room: 'Hall 201' },
    'Tuesday-2': { day: 'Tuesday', period: 2, subject: 'Database Management', subjectCode: 'CS303', faculty: 'Dr. Suresh V', room: 'Hall 201' },
    'Tuesday-4': { day: 'Tuesday', period: 4, subject: 'Operating Systems', subjectCode: 'CS304', faculty: 'Dr. Ramesh Kumar', room: 'Hall 201' },

    'Wednesday-1': { day: 'Wednesday', period: 1, subject: 'Operating Systems Lab', subjectCode: 'CS308', faculty: 'Dr. Ramesh Kumar', room: 'Lab 101', isLab: true },
    'Wednesday-2': { day: 'Wednesday', period: 2, subject: 'Operating Systems Lab', subjectCode: 'CS308', faculty: 'Dr. Ramesh Kumar', room: 'Lab 101', isLab: true },

    'Thursday-2': { day: 'Thursday', period: 2, subject: 'Computer Networks', subjectCode: 'CS302', faculty: 'Ms. Priya S', room: 'Hall 201' },
    'Thursday-3': { day: 'Thursday', period: 3, subject: 'Data Structures', subjectCode: 'CS301', faculty: 'Dr. Ramesh Kumar', room: 'Hall 201' },

    'Friday-1': { day: 'Friday', period: 1, subject: 'Discrete Mathematics', subjectCode: 'MA301', faculty: 'Prof. Anitha M', room: 'Hall 201' },
    'Friday-4': { day: 'Friday', period: 4, subject: 'Database Management', subjectCode: 'CS303', faculty: 'Dr. Suresh V', room: 'Hall 201' },
  });

  const handleSlotClick = (day: string, period: number) => {
    setActiveSlot({ day, period });
    const existing = schedule[`${day}-${period}`];
    if (existing) {
      setSlotSubject(existing.subject);
      setSlotFaculty(existing.faculty);
      setSlotRoom(existing.room);
      setIsLabBlock(!!existing.isLab);
    } else {
      setSlotSubject('Data Structures');
      setSlotFaculty('Dr. Ramesh Kumar');
      setSlotRoom('Lab 302');
      setIsLabBlock(false);
    }
    setConflictWarning(null);
    setIsEditModalOpen(true);
  };

  const handleFacultyChange = (val: string) => {
    setSlotFaculty(val);
    // Simulate real-time clash check
    if (val === 'Dr. Suresh V' && activeSlot?.day === 'Monday' && activeSlot?.period === 1) {
      setConflictWarning('Conflict Warning: Dr. Suresh V is already assigned to CSE Year 3 Section B at this time.');
    } else {
      setConflictWarning(null);
    }
  };

  const handleSaveSlot = () => {
    if (!activeSlot) return;
    const key = `${activeSlot.day}-${activeSlot.period}`;
    setSchedule((prev) => ({
      ...prev,
      [key]: {
        day: activeSlot.day,
        period: activeSlot.period,
        subject: slotSubject,
        subjectCode: slotSubject.substring(0, 3).toUpperCase() + '30' + activeSlot.period,
        faculty: slotFaculty,
        room: slotRoom,
        isLab: isLabBlock,
      },
    }));
    setIsEditModalOpen(false);
  };

  const handleRemoveSlot = () => {
    if (!activeSlot) return;
    const key = `${activeSlot.day}-${activeSlot.period}`;
    setSchedule((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setIsEditModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
              Interactive Timetable Builder
            </h1>
            <Badge variant="brand">Constraint Solver Active</Badge>
          </div>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Weekly grid scheduler with real-time faculty double-booking and room collision detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="soft"
            size="sm"
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-600" />}
            onClick={() => alert('AI Heuristic: Timetable optimized with zero faculty conflicts.')}
          >
            Auto-Generate Solver
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
          >
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Class Selector Bar */}
      <div className="flex items-center justify-between p-4 bg-surface-soft rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-content-secondary uppercase tracking-wider">
            Active Class:
          </span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl border border-border bg-white text-xs sm:text-sm font-bold text-content outline-none"
          >
            <option value="CSE – Year 2 – A">CSE – Year 2 – Section A</option>
            <option value="CSE – Year 2 – B">CSE – Year 2 – Section B</option>
            <option value="ECE – Year 3 – A">ECE – Year 3 – Section A</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-content-secondary">
          <span className="flex items-center gap-1 font-semibold text-accent-emerald">
            <CheckCircle2 className="w-3.5 h-3.5" /> No Conflicts Detected
          </span>
        </div>
      </div>

      {/* Timetable Weekly Grid */}
      <Card className="p-0 overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-soft border-b border-border text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
                <th className="p-4 text-left w-28">Period / Day</th>
                {days.map((day) => (
                  <th key={day} className="p-4 text-center min-w-[150px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {periods.map((p, idx) => (
                <tr key={p} className="hover:bg-slate-50/50">
                  {/* Period Header */}
                  <td className="p-4 bg-surface-soft/60 font-medium border-r border-border">
                    <span className="block font-bold text-content">Period {p}</span>
                    <span className="block text-[10px] text-content-muted font-mono">
                      {periodTimings[idx]}
                    </span>
                  </td>

                  {/* Day Slots */}
                  {days.map((day) => {
                    const slot = schedule[`${day}-${p}`];
                    return (
                      <td
                        key={`${day}-${p}`}
                        onClick={() => handleSlotClick(day, p)}
                        className="p-2 border-r border-border last:border-r-0 cursor-pointer align-top"
                      >
                        {slot ? (
                          <div
                            className={`p-3 rounded-2xl border transition-all hover:scale-[1.02] shadow-sm ${
                              slot.isLab
                                ? 'bg-teal-50/80 border-teal-200 text-teal-900'
                                : 'bg-brand-50/70 border-brand-200 text-brand-900'
                            }`}
                          >
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-white/80 shadow-xs mb-1 inline-block">
                              {slot.subjectCode}
                            </span>
                            <h4 className="text-xs font-bold leading-tight">{slot.subject}</h4>
                            <p className="text-[11px] text-content-secondary mt-1">{slot.faculty}</p>
                            <div className="flex items-center justify-between text-[10px] text-content-muted mt-2 pt-1 border-t border-black/5">
                              <span>{slot.room}</span>
                              {slot.isLab && <span className="font-bold text-teal-700">Lab Block</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="h-20 rounded-2xl border border-dashed border-border/80 flex flex-col items-center justify-center text-content-muted hover:border-brand-400 hover:bg-brand-50/30 transition-all">
                            <Plus className="w-4 h-4 opacity-50" />
                            <span className="text-[10px] mt-1">Assign Slot</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Slot Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Configure Slot: ${activeSlot?.day} - Period ${activeSlot?.period}`}
        description="Assign registered faculty, subject, and room with live conflict detection."
      >
        <div className="space-y-4">
          {conflictWarning && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-accent-rose text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{conflictWarning}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Subject
            </label>
            <select
              value={slotSubject}
              onChange={(e) => setSlotSubject(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-medium"
            >
              <option value="Data Structures">Data Structures (CS301) - 4 Credits</option>
              <option value="Computer Networks">Computer Networks (CS302) - 3 Credits</option>
              <option value="Database Management">Database Management (CS303) - 3 Credits</option>
              <option value="Operating Systems">Operating Systems (CS304) - 4 Credits</option>
              <option value="Operating Systems Lab">Operating Systems Lab (CS308) - 2 Credits</option>
              <option value="Discrete Mathematics">Discrete Mathematics (MA301) - 4 Credits</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Registered Faculty Member
            </label>
            <select
              value={slotFaculty}
              onChange={(e) => handleFacultyChange(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-medium"
            >
              <option value="Dr. Ramesh Kumar">Dr. Ramesh Kumar (Professor, CSE)</option>
              <option value="Ms. Priya S">Ms. Priya S (Associate Professor, CSE)</option>
              <option value="Dr. Suresh V">Dr. Suresh V (Assistant Professor, CSE)</option>
              <option value="Prof. Anitha M">Prof. Anitha M (Mathematics)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Room / Hall Number"
              value={slotRoom}
              onChange={(e) => setSlotRoom(e.target.value)}
            />
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-content">
                <input
                  type="checkbox"
                  checked={isLabBlock}
                  onChange={(e) => setIsLabBlock(e.target.checked)}
                  className="rounded text-brand-500"
                />
                <span>Multi-Period Lab Block</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-border">
            <Button variant="ghost" size="sm" onClick={handleRemoveSlot} className="text-accent-rose hover:bg-rose-50">
              Clear Slot
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSlot} disabled={!!conflictWarning}>
                Save Timetable Slot
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
