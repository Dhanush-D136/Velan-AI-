import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertTriangle, Download, FolderInput, Hash } from 'lucide-react';

export interface BulkStudentPreviewItem {
  id: string;
  registerNo: string;
  rollNo: string;
  user: { name: string };
  class?: { id?: string; name?: string };
}

export const BulkDeleteModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  previewStudents: BulkStudentPreviewItem[];
  classDeleteName?: string | null;
  isPermanent?: boolean;
  isSubmitting: boolean;
  onConfirm: (downloadBackupFirst: boolean) => Promise<void>;
}> = ({
  isOpen,
  onClose,
  selectedCount,
  previewStudents,
  classDeleteName,
  isPermanent = false,
  isSubmitting,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [downloadBackup, setDownloadBackup] = useState(true);

  const requiredPhrase = classDeleteName
    ? classDeleteName
    : selectedCount > 10
      ? `DELETE ${selectedCount}`
      : '';

  const canConfirm = !requiredPhrase || confirmText.trim() === requiredPhrase;

  const breakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of previewStudents) {
      const cname = s.class?.name || 'Class';
      map[cname] = (map[cname] || 0) + 1;
    }
    return Object.entries(map);
  }, [previewStudents]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPermanent ? `Permanently Delete ${selectedCount} Student(s)?` : `Delete ${selectedCount} Student(s)?`}
      description={
        isPermanent
          ? 'This permanently removes all data and cannot be undone.'
          : 'Students will move to the 30-day Recently Deleted Recycle Bin and disappear from all rosters, reports, and logins.'
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {selectedCount} student(s) will lose access and be removed from active rosters.
            </span>
          </div>
          {breakdown.length > 0 && (
            <div className="text-[11px] text-rose-800">
              Breakdown: {breakdown.map(([c, n]) => `${c}: ${n}`).join(' • ')}
            </div>
          )}
          <div className="text-[11px] text-rose-700">
            Affected data: attendance records, device registrations, saved academic results, requests, chat messages, notifications, and portal login.
          </div>
        </div>

        {previewStudents.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-soft p-2.5 space-y-1">
            <div className="text-[10px] font-bold uppercase text-content-muted">
              First {Math.min(10, previewStudents.length)} selected
            </div>
            {previewStudents.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
                <span className="font-mono font-bold text-content">{s.registerNo}</span>
                <span className="text-content-secondary truncate ml-2">{s.user.name}</span>
              </div>
            ))}
            {selectedCount > 10 && (
              <div className="text-[11px] text-content-muted pt-1">
                ...and {selectedCount - 10} more student(s)
              </div>
            )}
          </div>
        )}

        {!isPermanent && (
          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border bg-white">
            <input
              type="checkbox"
              checked={downloadBackup}
              onChange={(e) => setDownloadBackup(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <Download className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="font-semibold text-content">
              Download an Excel backup of these students first
            </span>
          </label>
        )}

        {requiredPhrase && (
          <Input
            label={`Type "${requiredPhrase}" to confirm`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredPhrase}
            autoFocus
          />
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={!canConfirm || isSubmitting}
            isLoading={isSubmitting}
            onClick={() => onConfirm(downloadBackup)}
          >
            {isPermanent ? 'Delete Permanently' : `Delete ${selectedCount} Student(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const BulkMoveClassModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  classes: { id: string; name: string }[];
  isSubmitting: boolean;
  onConfirm: (targetClassId: string) => Promise<void>;
}> = ({ isOpen, onClose, selectedCount, classes, isSubmitting, onConfirm }) => {
  const [targetClassId, setTargetClassId] = useState(classes[0]?.id || '');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Move ${selectedCount} Student(s) to Class`}
      description="Students will be transferred in one atomic transaction. Roll number conflicts are checked automatically."
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-content-secondary uppercase mb-1">
            Target Class / Section
          </label>
          <select
            value={targetClassId || classes[0]?.id || ''}
            onChange={(e) => setTargetClassId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm font-medium"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<FolderInput className="w-3.5 h-3.5" />}
            onClick={() => onConfirm(targetClassId || classes[0]?.id || '')}
          >
            Move {selectedCount} Student(s)
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const RegisterRangeSelectModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  students: BulkStudentPreviewItem[];
  onApply: (matchedIds: string[]) => void;
}> = ({ isOpen, onClose, students, onApply }) => {
  const [fromReg, setFromReg] = useState('');
  const [toReg, setToReg] = useState('');

  const matchedIds = useMemo(() => {
    const f = fromReg.trim();
    const t = toReg.trim();
    if (!f || !t) return [];
    return students
      .filter((s) => {
        const r = s.registerNo.trim();
        if (f.length <= 4 && t.length <= 4 && /^\d+$/.test(f) && /^\d+$/.test(t) && /^\d+$/.test(r)) {
          const suffix = Number(r.slice(-Math.max(f.length, t.length)));
          return suffix >= Number(f) && suffix <= Number(t);
        }
        return r >= f && r <= t;
      })
      .map((s) => s.id);
  }, [fromReg, toReg, students]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select by Register Number Range"
      description="Enter full register numbers (e.g. 113024243001 to 113024243020) or just the last digits (e.g. 001 to 020)."
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <Input label="From" value={fromReg} onChange={(e) => setFromReg(e.target.value)} placeholder="e.g. 001" />
          <Input label="To" value={toReg} onChange={(e) => setToReg(e.target.value)} placeholder="e.g. 020" />
        </div>
        <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 font-semibold flex items-center gap-2">
          <Hash className="w-4 h-4" />
          <span>{matchedIds.length} loaded student(s) match this range</span>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={matchedIds.length === 0}
            onClick={() => {
              onApply(matchedIds);
              onClose();
            }}
          >
            Select {matchedIds.length} Student(s)
          </Button>
        </div>
      </div>
    </Modal>
  );
};
