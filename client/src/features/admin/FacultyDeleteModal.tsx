import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { api } from '@/lib/api';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface FacultyOption {
  id: string;
  employeeId: string;
  name?: string;
  user?: { name: string };
}

interface FacultyDeleteModalProps {
  isOpen: boolean;
  faculty: FacultyOption | null;
  onClose: () => void;
  onDeleted: (msg: string) => void;
}

export const FacultyDeleteModal: React.FC<FacultyDeleteModalProps> = ({
  isOpen,
  faculty,
  onClose,
  onDeleted,
}) => {
  const [deps, setDeps] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !faculty) return;
    setError('');
    setLoading(true);
    api
      .get(`/api/academics/faculty/${faculty.id}/dependencies`)
      .then((res) => setDeps(res.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Could not load faculty details.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, faculty?.id]);

  const handleConfirmDelete = async () => {
    if (!faculty || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.delete(`/api/academics/faculty/${faculty.id}`);
      onDeleted(res.data?.message || 'Faculty deleted permanently.');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete this faculty member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const facName = faculty?.user?.name || faculty?.name || faculty?.employeeId || 'Faculty';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={`Delete ${facName}?`}
      description="This permanently deletes the faculty account from the database. This cannot be undone."
      size="md"
    >
      {loading ? (
        <InlineLoader compact showBlocks={false} label="Checking faculty assignments" />
      ) : (
        <div className="space-y-4">
          {error && (
            <div
              className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {deps && (
            <ul className="p-4 rounded-2xl border border-border bg-surface-soft text-xs text-content space-y-2 list-disc list-inside">
              {deps.timetableSlots?.length > 0 && (
                <li>
                  <span className="font-semibold">
                    {deps.timetableSlots.length} timetable slot(s) will become empty:
                  </span>{' '}
                  <span className="text-content-secondary">
                    {deps.timetableSlots
                      .map((s: any) => `${s.className} (${s.dayOfWeek} P${s.periodNumber})`)
                      .join(', ')}
                  </span>
                </li>
              )}

              {deps.advisedClasses?.length > 0 && (
                <li>
                  Removed as advisor of{' '}
                  <span className="font-semibold">
                    {deps.advisedClasses.map((c: any) => c.name).join(', ')}
                  </span>{' '}
                  (left unassigned)
                </li>
              )}

              {deps.mentoredClasses?.length > 0 && (
                <li>
                  Removed as mentor of{' '}
                  <span className="font-semibold">
                    {deps.mentoredClasses.map((m: any) => m.className).join(', ')}
                  </span>{' '}
                  (left unassigned)
                </li>
              )}

              {deps.classSubjects?.length > 0 && (
                <li>
                  Subject assignments: the teacher is cleared, the subjects stay in the class
                </li>
              )}

              {(deps.assignmentsCount > 0 || deps.materialsCount > 0) && (
                <li>
                  {deps.assignmentsCount || 0} assignment(s) and {deps.materialsCount || 0} material(s) posted by this faculty will be deleted
                </li>
              )}

              <li>
                Attendance history stays, shown as &ldquo;{facName} (former faculty)&rdquo;
              </li>
            </ul>
          )}

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
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete permanently
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
