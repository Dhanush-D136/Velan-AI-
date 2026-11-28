import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { api } from '@/lib/api';
import { AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';

interface FacultyOption {
  id: string;
  employeeId: string;
  name?: string;
  user?: { name: string };
}

interface FacultyDeleteModalProps {
  isOpen: boolean;
  faculty: FacultyOption | null;
  allFaculty: FacultyOption[];
  onClose: () => void;
  onDeleted: (msg: string) => void;
}

export const FacultyDeleteModal: React.FC<FacultyDeleteModalProps> = ({
  isOpen,
  faculty,
  allFaculty,
  onClose,
  onDeleted,
}) => {
  const [deps, setDeps] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [timetableAction, setTimetableAction] = useState<'replace' | 'clear'>('clear');
  const [timetableRepId, setTimetableRepId] = useState('');
  const [advisorAction, setAdvisorAction] = useState<'replace' | 'unassign'>('unassign');
  const [advisorReps, setAdvisorReps] = useState<Record<string, string>>({});
  const [mentorAction, setMentorAction] = useState<'replace' | 'unassign'>('unassign');
  const [mentorReps, setMentorReps] = useState<Record<string, string>>({});
  const [assignmentsAction, setAssignmentsAction] = useState<'transfer' | 'delete'>('transfer');
  const [assignmentsRepId, setAssignmentsRepId] = useState('');
  const [confirmId, setConfirmId] = useState('');

  const otherFaculty = allFaculty.filter((f) => f.id !== faculty?.id);

  useEffect(() => {
    if (!isOpen || !faculty) return;
    setError('');
    setConfirmId('');
    setLoading(true);
    api
      .get(`/api/academics/faculty/${faculty.id}/dependencies`)
      .then((res) => {
        setDeps(res.data);
        const defaultRep = otherFaculty[0]?.id || '';
        setTimetableRepId(defaultRep);
        setAssignmentsRepId(defaultRep);
        setTimetableAction(res.data.timetableSlots?.length > 0 && defaultRep ? 'replace' : 'clear');
        setAdvisorAction(res.data.advisedClasses?.length > 0 && defaultRep ? 'replace' : 'unassign');
        setMentorAction(res.data.mentoredClasses?.length > 0 && defaultRep ? 'replace' : 'unassign');
        const advMap: Record<string, string> = {};
        (res.data.advisedClasses || []).forEach((c: any) => {
          advMap[c.id] = defaultRep;
        });
        setAdvisorReps(advMap);
        const menMap: Record<string, string> = {};
        (res.data.mentoredClasses || []).forEach((m: any) => {
          menMap[m.classId] = defaultRep;
        });
        setMentorReps(menMap);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load faculty dependencies.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, faculty?.id]);

  const handleConfirmDelete = async () => {
    if (!faculty || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/api/academics/faculty/${faculty.id}/delete-with-handover`, {
        confirmEmployeeId: confirmId.trim(),
        timetableAction,
        timetableReplacementFacultyId: timetableAction === 'replace' ? timetableRepId : undefined,
        advisorAction,
        advisorReplacements: advisorAction === 'replace' ? advisorReps : undefined,
        mentorAction,
        mentorReplacements: mentorAction === 'replace' ? mentorReps : undefined,
        assignmentsAction,
        assignmentsTransferFacultyId: assignmentsAction === 'transfer' ? assignmentsRepId : undefined,
      });
      onDeleted(res.data?.message || 'Faculty deleted permanently.');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete faculty. Please review the options.');
    } finally {
      setSubmitting(false);
    }
  };

  const facName = faculty?.user?.name || faculty?.name || faculty?.employeeId || 'Faculty';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={`Delete ${facName}`}
      description={`Permanent deletion & handover for ${faculty?.employeeId || ''}`}
      size="lg"
    >
      {loading ? (
        <InlineLoader compact showBlocks={false} label="Checking faculty assignments and history" />
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {deps && (
            <>
              {/* Timetable Slots */}
              <div className="p-3.5 rounded-2xl border border-border bg-surface-soft space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-content">
                    Timetable Slots ({deps.timetableSlots?.length || 0})
                  </span>
                </div>
                {deps.timetableSlots?.length > 0 ? (
                  <>
                    <div className="text-[11px] text-content-secondary max-h-20 overflow-y-auto space-y-0.5">
                      {deps.timetableSlots.map((s: any) => (
                        <div key={s.id}>
                          {s.className} · {s.dayOfWeek} P{s.periodNumber} ({s.subjectCode})
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <select
                        value={timetableAction}
                        onChange={(e) => setTimetableAction(e.target.value as any)}
                        className="text-xs px-3 py-2 rounded-xl border border-border bg-white"
                      >
                        <option value="replace">Replace with another faculty</option>
                        <option value="clear">Clear these slots</option>
                      </select>
                      {timetableAction === 'replace' && (
                        <select
                          value={timetableRepId}
                          onChange={(e) => setTimetableRepId(e.target.value)}
                          className="text-xs px-3 py-2 rounded-xl border border-border bg-white flex-1"
                        >
                          {otherFaculty.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.user?.name || f.name} ({f.employeeId})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-content-muted">No timetable slots assigned.</p>
                )}
              </div>

              {/* Advisor & Mentor Classes */}
              <div className="p-3.5 rounded-2xl border border-border bg-surface-soft space-y-2">
                <span className="text-xs font-bold text-content block">
                  Advisor ({deps.advisedClasses?.length || 0}) &amp; Mentor ({deps.mentoredClasses?.length || 0}) Roles
                </span>
                {deps.advisedClasses?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-content-secondary">Advisor action:</span>
                      <select
                        value={advisorAction}
                        onChange={(e) => setAdvisorAction(e.target.value as any)}
                        className="text-xs px-2.5 py-1.5 rounded-xl border border-border bg-white"
                      >
                        <option value="replace">Replace per class</option>
                        <option value="unassign">Leave unassigned</option>
                      </select>
                    </div>
                    {deps.advisedClasses.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>{c.name} (Advisor)</span>
                        {advisorAction === 'replace' && (
                          <select
                            value={advisorReps[c.id] || ''}
                            onChange={(e) => setAdvisorReps((p) => ({ ...p, [c.id]: e.target.value }))}
                            className="text-xs px-2.5 py-1.5 rounded-xl border border-border bg-white"
                          >
                            {otherFaculty.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.user?.name || f.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {deps.mentoredClasses?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-content-secondary">Mentor action:</span>
                      <select
                        value={mentorAction}
                        onChange={(e) => setMentorAction(e.target.value as any)}
                        className="text-xs px-2.5 py-1.5 rounded-xl border border-border bg-white"
                      >
                        <option value="replace">Replace per class</option>
                        <option value="unassign">Leave unassigned</option>
                      </select>
                    </div>
                    {deps.mentoredClasses.map((m: any) => (
                      <div key={m.classId} className="flex items-center justify-between gap-2 text-xs">
                        <span>{m.className} ({m.role})</span>
                        {mentorAction === 'replace' && (
                          <select
                            value={mentorReps[m.classId] || ''}
                            onChange={(e) => setMentorReps((p) => ({ ...p, [m.classId]: e.target.value }))}
                            className="text-xs px-2.5 py-1.5 rounded-xl border border-border bg-white"
                          >
                            {otherFaculty.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.user?.name || f.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {deps.advisedClasses?.length === 0 && deps.mentoredClasses?.length === 0 && (
                  <p className="text-[11px] text-content-muted">Not assigned as advisor or mentor.</p>
                )}
              </div>

              {/* Assignments & Materials */}
              <div className="p-3.5 rounded-2xl border border-border bg-surface-soft space-y-2">
                <span className="text-xs font-bold text-content block">
                  Subjects ({deps.classSubjects?.length || 0}), Assignments ({deps.assignmentsCount || 0}) &amp; Materials ({deps.materialsCount || 0})
                </span>
                {deps.classSubjects?.length > 0 ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={assignmentsAction}
                      onChange={(e) => setAssignmentsAction(e.target.value as any)}
                      className="text-xs px-3 py-2 rounded-xl border border-border bg-white"
                    >
                      <option value="transfer">Transfer to another faculty</option>
                      <option value="delete">Delete them</option>
                    </select>
                    {assignmentsAction === 'transfer' && (
                      <select
                        value={assignmentsRepId}
                        onChange={(e) => setAssignmentsRepId(e.target.value)}
                        className="text-xs px-3 py-2 rounded-xl border border-border bg-white flex-1"
                      >
                        {otherFaculty.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.user?.name || f.name} ({f.employeeId})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-content-muted">No teaching subjects or materials.</p>
                )}
              </div>

              {/* Preserved History & Hard-deleted Account Data */}
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  History Preserved Automatically
                </div>
                <p className="text-[11px]">
                  {deps.totalSessionsCount || 0} attendance sessions and {deps.counts?.chatMessages || 0} chat messages will remain intact as &ldquo;{facName} (former faculty)&rdquo;.
                </p>
                <p className="text-[11px] text-emerald-800">
                  Will be hard-deleted: login account, profile, {deps.counts?.sessions || 0} sessions, {deps.counts?.devices || 0} devices, {deps.counts?.notifications || 0} notifications, {deps.counts?.pushSubscriptions || 0} push subscriptions.
                </p>
              </div>

              <Input
                label={`Type "${faculty?.employeeId}" to confirm permanent deletion`}
                value={confirmId}
                onChange={(e) => setConfirmId(e.target.value)}
                placeholder={faculty?.employeeId}
                disabled={submitting}
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmDelete}
                  isLoading={submitting}
                  loadingLabel="Deleting..."
                  disabled={confirmId.trim().toUpperCase() !== (faculty?.employeeId || '').toUpperCase()}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Delete permanently
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
