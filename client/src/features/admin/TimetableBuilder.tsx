import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { DayOfWeek } from '@velan/shared';
import {
  CalendarDays,
  Plus,
  AlertTriangle,
  Printer,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TimetableSlotItem {
  id: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomNumber: string;
  isLabBlock: boolean;
  facultyId: string;
  classSubject: {
    subjectId: string;
    subject: { id: string; code: string; name: string };
    faculty: { id: string; user: { name: string } };
  };
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: DayOfWeek.MONDAY, label: 'Monday' },
  { key: DayOfWeek.TUESDAY, label: 'Tuesday' },
  { key: DayOfWeek.WEDNESDAY, label: 'Wednesday' },
  { key: DayOfWeek.THURSDAY, label: 'Thursday' },
  { key: DayOfWeek.FRIDAY, label: 'Friday' },
  { key: DayOfWeek.SATURDAY, label: 'Saturday' },
];

export const TimetableBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [slots, setSlots] = useState<TimetableSlotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Editor modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ day: DayOfWeek; periodNumber: number } | null>(null);
  const [existingSlotId, setExistingSlotId] = useState<string | null>(null);
  const [slotSubjectId, setSlotSubjectId] = useState('');
  const [slotFacultyId, setSlotFacultyId] = useState('');
  const [slotRoom, setSlotRoom] = useState('');
  const [isLabBlock, setIsLabBlock] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMeta = useCallback(async () => {
    try {
      const [clsRes, subjRes, facRes, bellRes] = await Promise.all([
        api.get('/api/academics/classes'),
        api.get('/api/academics/subjects'),
        api.get('/api/academics/faculty'),
        api.get('/api/settings/bell-schedule'),
      ]);
      const clsList = clsRes.data.classes || clsRes.data.data || [];
      setClasses(clsList);
      setSubjects(subjRes.data.subjects || subjRes.data.data || []);
      setFacultyList((facRes.data.faculty || facRes.data.data || []).filter((f: any) => f.user?.status === 'ACTIVE'));
      setPeriods(bellRes.data.periods || []);
      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(clsList[0].id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load timetable configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  const fetchClassTimetable = useCallback(async () => {
    if (!selectedClassId) {
      setSlots([]);
      return;
    }
    try {
      const res = await api.get(`/api/timetable/class/${selectedClassId}`);
      setSlots(res.data.slots || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to fetch class timetable', 'error');
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchClassTimetable();
  }, [fetchClassTimetable]);

  useRealtimeSync(['data:updated', 'timetable:updated'], () => {
    fetchMeta();
    fetchClassTimetable();
  });

  const handleSlotClick = (day: DayOfWeek, periodNumber: number) => {
    setActiveCell({ day, periodNumber });
    const existing = slots.find((s) => s.dayOfWeek === day && s.periodNumber === periodNumber);
    if (existing) {
      setExistingSlotId(existing.id);
      setSlotSubjectId(existing.classSubject.subjectId);
      setSlotFacultyId(existing.facultyId);
      setSlotRoom(existing.roomNumber);
      setIsLabBlock(existing.isLabBlock);
    } else {
      setExistingSlotId(null);
      setSlotSubjectId(subjects[0]?.id || '');
      setSlotFacultyId(facultyList[0]?.id || '');
      const selectedCls = classes.find((c) => c.id === selectedClassId);
      setSlotRoom(selectedCls?.roomNumber || 'Room 101');
      setIsLabBlock(false);
    }
    setConflictWarning(null);
    setIsEditModalOpen(true);
  };

  const runConflictCheck = async (facultyId: string, roomNumber: string) => {
    if (!activeCell || !facultyId || !roomNumber) return;
    try {
      const res = await api.post('/api/timetable/conflicts', {
        facultyId,
        roomNumber,
        dayOfWeek: activeCell.day,
        periodNumber: activeCell.periodNumber,
        currentClassId: selectedClassId,
      });
      if (res.data.hasConflict && res.data.conflicts?.length > 0) {
        setConflictWarning(res.data.conflicts.join(' | '));
      } else {
        setConflictWarning(null);
      }
    } catch {
      // silent check
    }
  };

  const handleSaveSlot = async () => {
    if (!activeCell || !selectedClassId || !slotSubjectId || !slotFacultyId || !slotRoom.trim()) {
      showToast('Subject, Faculty, and Room are required.', 'error');
      return;
    }

    const periodInfo = periods.find((p) => p.periodNumber === activeCell.periodNumber);
    const startTime = periodInfo?.startTime || '09:00';
    const endTime = periodInfo?.endTime || '09:50';

    setIsSaving(true);
    try {
      await api.post('/api/timetable/slot', {
        classId: selectedClassId,
        subjectId: slotSubjectId,
        facultyId: slotFacultyId,
        dayOfWeek: activeCell.day,
        periodNumber: activeCell.periodNumber,
        startTime,
        endTime,
        roomNumber: slotRoom.trim(),
        isLabBlock,
      });
      showToast('Timetable slot saved successfully', 'success');
      setIsEditModalOpen(false);
      fetchClassTimetable();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to save timetable slot';
      setConflictWarning(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearSlot = async () => {
    if (!existingSlotId) return;
    setIsSaving(true);
    try {
      await api.delete(`/api/timetable/slot/${existingSlotId}`);
      showToast('Timetable slot cleared', 'success');
      setIsEditModalOpen(false);
      fetchClassTimetable();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to clear slot', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoading && classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          Timetable Builder
        </h1>
        <EmptyState
          icon={CalendarDays}
          title="No classes created yet"
          description="Create a Department, Academic Year, and Class first before building your class timetable."
          actionLabel="Go to Classes & Subjects"
          onAction={() => navigate('/admin/academics')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Timetable Builder
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Real-time server-enforced conflict detection for faculty and classrooms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-border bg-white text-xs sm:text-sm font-semibold text-content outline-none shadow-sm focus:border-brand-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        </div>
      </div>

      {/* Timetable Matrix Grid */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-soft border-b border-border">
                <th className="p-4 text-xs font-bold text-content-secondary uppercase w-32 border-r border-border">
                  Day / Period
                </th>
                {periods.map((p) => (
                  <th
                    key={p.periodNumber}
                    className="p-3 text-center border-r border-border last:border-r-0"
                  >
                    <span className="text-xs font-bold text-content block">{p.name}</span>
                    <span className="text-[10px] text-content-muted font-mono">
                      {p.startTime} - {p.endTime}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DAYS.map((day) => (
                <tr key={day.key} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-sm text-content bg-surface-soft/50 border-r border-border">
                    {day.label}
                  </td>
                  {periods.map((p) => {
                    const slot = slots.find(
                      (s) => s.dayOfWeek === day.key && s.periodNumber === p.periodNumber
                    );
                    return (
                      <td
                        key={`${day.key}-${p.periodNumber}`}
                        onClick={() => handleSlotClick(day.key, p.periodNumber)}
                        className="p-2 border-r border-border last:border-r-0 cursor-pointer align-top hover:bg-brand-50/40 transition-all min-w-[130px] h-24"
                      >
                        {slot ? (
                          <div
                            className={`p-2.5 rounded-2xl border h-full flex flex-col justify-between transition-all ${
                              slot.isLabBlock
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                                : 'bg-white border-border hover:border-brand-400 shadow-sm'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-mono font-bold text-brand-600">
                                  {slot.classSubject.subject.code}
                                </span>
                                {slot.isLabBlock && (
                                  <Badge variant="brand" size="sm">LAB</Badge>
                                )}
                              </div>
                              <h4 className="text-xs font-bold leading-tight mt-1 line-clamp-1">
                                {slot.classSubject.subject.name}
                              </h4>
                            </div>

                            <div className="mt-2 text-[10px] text-content-secondary flex items-center justify-between gap-1 border-t border-slate-100 pt-1">
                              <span className="truncate font-medium">
                                {slot.classSubject.faculty.user.name}
                              </span>
                              <span className="font-mono text-content-muted shrink-0">
                                {slot.roomNumber}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-300 hover:border-brand-300 hover:text-brand-400 transition-colors">
                            <Plus className="w-4 h-4" />
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
        title={`Edit Slot: ${activeCell?.day} — Period ${activeCell?.periodNumber}`}
        description="Assign subject, registered faculty, and room. Faculty double-booking is blocked automatically."
      >
        <div className="space-y-4">
          {conflictWarning && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-5 h-5 text-accent-rose shrink-0 mt-0.5" />
              <span>{conflictWarning}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Subject
            </label>
            <select
              value={slotSubjectId}
              onChange={(e) => setSlotSubjectId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none focus:border-brand-500"
            >
              {subjects.length === 0 && <option value="">No subjects created yet</option>}
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.code} — {subj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Assigned Faculty
            </label>
            <select
              value={slotFacultyId}
              onChange={(e) => {
                setSlotFacultyId(e.target.value);
                runConflictCheck(e.target.value, slotRoom);
              }}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none focus:border-brand-500"
            >
              {facultyList.length === 0 && <option value="">No active faculty registered yet</option>}
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user?.name} ({f.employeeId})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Room / Lab Number"
            value={slotRoom}
            onChange={(e) => {
              setSlotRoom(e.target.value);
              runConflictCheck(slotFacultyId, e.target.value);
            }}
            placeholder="e.g. Hall 201 or Lab 302"
          />

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-soft border border-border">
            <input
              type="checkbox"
              id="labBlockCheck"
              checked={isLabBlock}
              onChange={(e) => setIsLabBlock(e.target.checked)}
              className="w-4 h-4 accent-brand-600 rounded"
            />
            <label htmlFor="labBlockCheck" className="text-xs font-semibold text-content cursor-pointer">
              Mark as Practical / Lab Session
            </label>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-border">
            {existingSlotId ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={handleClearSlot}
                disabled={isSaving}
              >
                Clear Slot
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSlot} isLoading={isSaving} disabled={isSaving}>
                Save Slot
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
