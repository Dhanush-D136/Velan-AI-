import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { Users, Download, Upload, Wand2, RotateCcw, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

async function downloadProtectedExcel(path: string, filename: string) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const AdminMentorAssignmentPage: React.FC = () => {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [board, setBoard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterMentor, setFilterMentor] = useState('ALL');
  const [firstNInput, setFirstNInput] = useState(20);
  const [rollFrom, setRollFrom] = useState('');
  const [rollTo, setRollTo] = useState('');

  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
  const [autoPreview, setAutoPreview] = useState<any[] | null>(null);
  const [lastBulkUndo, setLastBulkUndo] = useState<{ previousMap: Record<string, string | null> } | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<{ valid: any[]; invalid: any[] } | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/mentors/overview');
      const list = res.data?.classes || [];
      setOverview(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].classId);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  const fetchBoard = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      const res = await api.get(`/api/admin/mentors/class/${selectedClassId}`);
      setBoard(res.data);
      setSelectedMentorIds((res.data?.mentors || []).map((m: any) => m.facultyId));
      setSelectedStudentIds([]);
    } catch {
      showToast('Failed to load mentor board', 'error');
    }
  }, [selectedClassId, showToast]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useRealtimeSync(['data:updated'], () => {
    fetchOverview();
    fetchBoard();
  });

  if (isLoading) {
    return <DatabaseLoader message="Loading Mentor Assignment Portal..." subtext="Fetching classes, advisors, and mentee groups" />;
  }

  const students = (board?.students || []).filter((s: any) => {
    if (filterMentor === 'UNASSIGNED' && s.mentorId) return false;
    if (filterMentor !== 'ALL' && filterMentor !== 'UNASSIGNED' && s.mentorId !== filterMentor) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.registerNo.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleStudentCheck = (studentId: string, idx: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end = Math.max(lastClickedIdx, idx);
      const rangeIds = students.slice(start, end + 1).map((s: any) => s.studentId);
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      setSelectedStudentIds((prev) =>
        prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
      );
    }
    setLastClickedIdx(idx);
  };

  const handleBulkAssign = async (mentorId: string, idsToAssign = selectedStudentIds) => {
    if (idsToAssign.length === 0) return showToast('Select at least one student first', 'error');
    const prevMap: Record<string, string | null> = {};
    for (const s of board?.students || []) {
      if (idsToAssign.includes(s.studentId)) prevMap[s.studentId] = s.mentorId || null;
    }
    setLastBulkUndo({ previousMap: prevMap });
    try {
      await api.post(`/api/admin/mentors/class/${selectedClassId}/bulk-assign`, {
        studentIds: idsToAssign,
        mentorId,
      });
      showToast(`Assigned ${idsToAssign.length} student(s)!`, 'success');
      fetchBoard();
      fetchOverview();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to assign mentees', 'error');
    }
  };

  const handleSaveMentors = async (idsToSave = selectedMentorIds) => {
    try {
      await api.put(`/api/admin/mentors/class/${selectedClassId}/mentors`, {
        facultyIds: idsToSave,
      });
      showToast('Class mentors updated!', 'success');
      fetchBoard();
      fetchOverview();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update mentors', 'error');
    }
  };

  const handleAutoDistributePreview = async () => {
    try {
      const res = await api.post(`/api/admin/mentors/class/${selectedClassId}/auto-distribute`, {
        commit: false,
        mentorIds: selectedMentorIds,
      });
      setAutoPreview(res.data?.preview || []);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Preview failed', 'error');
    }
  };

  const handleAutoDistributeCommit = async () => {
    try {
      await api.post(`/api/admin/mentors/class/${selectedClassId}/auto-distribute`, {
        commit: true,
        mentorIds: selectedMentorIds,
      });
      setAutoPreview(null);
      showToast('Students distributed evenly!', 'success');
      fetchBoard();
      fetchOverview();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Distribution failed', 'error');
    }
  };

  const handleUndo = async () => {
    if (!lastBulkUndo) return;
    const grouped = new Map<string, string[]>();
    for (const [sid, mid] of Object.entries(lastBulkUndo.previousMap)) {
      if (mid) {
        const arr = grouped.get(mid) || [];
        arr.push(sid);
        grouped.set(mid, arr);
      }
    }
    for (const [mid, sids] of grouped.entries()) {
      await api.post(`/api/admin/mentors/class/${selectedClassId}/bulk-assign`, {
        studentIds: sids,
        mentorId: mid,
        reason: 'Undo last bulk action',
      });
    }
    setLastBulkUndo(null);
    showToast('Reverted last bulk assignment', 'success');
    fetchBoard();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Mentor Assignment &amp; Groups
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Divide each class across the Class Advisor and mentors with bulk selection, auto-distribution, and live sync.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border text-xs font-bold bg-white"
          >
            {overview.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className} ({c.assignedCount}/{c.totalStudents})
              </option>
            ))}
          </select>
          {selectedClassId && (
            <>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => downloadProtectedExcel(`/api/admin/mentors/class/${selectedClassId}/export`, 'Mentor_Mapping.xlsx')}
              >
                Export Mapping
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<Upload className="w-4 h-4" />} onClick={() => setImportModalOpen(true)}>
                Import Mapping
              </Button>
            </>
          )}
        </div>
      </div>

      {/* All-Classes Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {overview.map((c) => (
          <button
            key={c.classId}
            onClick={() => setSelectedClassId(c.classId)}
            className={`p-3 rounded-2xl border text-left transition ${
              c.classId === selectedClassId ? 'bg-brand-50 border-brand-400' : 'bg-white border-border hover:bg-surface-soft'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-xs text-content truncate">{c.className}</span>
              <Badge variant={c.isComplete ? 'success' : 'warning'} size="sm">
                {c.isComplete ? 'Complete' : `${c.unassignedCount} left`}
              </Badge>
            </div>
            <div className="text-[11px] text-content-secondary mt-1">
              {c.mentorsCount} Mentors • {c.assignedCount}/{c.totalStudents} assigned
            </div>
          </button>
        ))}
      </div>

      {board && (
        <>
          {/* Step 1: Choose Class Mentors */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-heading font-bold text-sm text-content">
                  Step 1: Mentors for {board.classInfo.name}
                </h3>
                <p className="text-xs text-content-secondary">
                  Class Advisor: <strong>{board.classInfo.advisorName || 'Unassigned'}</strong> • Target group size: ~{board.rules.targetGroupSize}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={handleAutoDistributePreview} leftIcon={<Wand2 className="w-3.5 h-3.5" />}>
                  Auto-distribute evenly
                </Button>
                <Button size="sm" onClick={() => handleSaveMentors()}>
                  Save Mentors ({selectedMentorIds.length})
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(board.facultyDirectory || []).map((f: any) => {
                const isAdvisor = f.facultyId === board.classInfo.advisorId;
                const isSelected = selectedMentorIds.includes(f.facultyId);
                return (
                  <button
                    key={f.facultyId}
                    type="button"
                    disabled={isAdvisor}
                    onClick={() => {
                      const next = isSelected
                        ? selectedMentorIds.filter((id) => id !== f.facultyId)
                        : [...selectedMentorIds, f.facultyId];
                      setSelectedMentorIds(next);
                      void handleSaveMentors(next);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-surface-soft text-content border-border hover:border-brand-300'
                    }`}
                  >
                    {f.name} ({f.employeeId}) {isAdvisor ? '• Advisor' : `• ${f.totalMenteesAcrossClasses} mentees`}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Auto-Distribute Preview Banner */}
          {autoPreview && (
            <Card className="bg-amber-50 border-amber-300 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase text-amber-900">Auto-Distribution Preview (Roll-Number Order)</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setAutoPreview(null)}>Cancel</Button>
                  <Button size="sm" onClick={handleAutoDistributeCommit}>Confirm &amp; Apply</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {autoPreview.map((g: any) => {
                  const m = board.mentors.find((x: any) => x.facultyId === g.mentorId) || board.facultyDirectory.find((x: any) => x.facultyId === g.mentorId);
                  return (
                    <div key={g.mentorId} className="p-2.5 rounded-xl bg-white border border-amber-200">
                      <strong>{m?.name || g.mentorId}</strong>: {g.studentIds.length} student(s)
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Step 2: Mentor Group Cards + Bulk Student List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Student Bulk Selector (7 cols) */}
            <Card className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-content">
                  {board.stats.totalStudents} students • {board.stats.assignedCount} assigned •{' '}
                  <span className={board.stats.unassignedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {board.stats.unassignedCount} unassigned
                  </span>
                </div>
                <Badge variant="brand" size="sm">{selectedStudentIds.length} selected</Badge>
              </div>

              {/* Bulk Selection Toolbar */}
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search roll, reg, name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border"
                  />
                </div>
                <select
                  value={filterMentor}
                  onChange={(e) => setFilterMentor(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-border bg-white"
                >
                  <option value="ALL">All Students</option>
                  <option value="UNASSIGNED">Unassigned Only</option>
                  {(board.mentors || []).map((m: any) => (
                    <option key={m.facultyId} value={m.facultyId}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <Button size="sm" variant="secondary" onClick={() => setSelectedStudentIds(students.map((s: any) => s.studentId))}>
                  Select all
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setSelectedStudentIds(students.filter((s: any) => !s.mentorId).map((s: any) => s.studentId))}>
                  Select unassigned
                </Button>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={firstNInput}
                    onChange={(e) => setFirstNInput(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-border"
                  />
                  <Button size="sm" variant="secondary" onClick={() => setSelectedStudentIds(students.slice(0, firstNInput).map((s: any) => s.studentId))}>
                    Select first {firstNInput}
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <input placeholder="Roll from" value={rollFrom} onChange={(e) => setRollFrom(e.target.value)} className="w-20 px-2 py-1 rounded-lg border border-border" />
                  <input placeholder="Roll to" value={rollTo} onChange={(e) => setRollTo(e.target.value)} className="w-20 px-2 py-1 rounded-lg border border-border" />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setSelectedStudentIds(
                        students
                          .filter((s: any) => (!rollFrom || s.rollNo >= rollFrom) && (!rollTo || s.rollNo <= rollTo))
                          .map((s: any) => s.studentId)
                      )
                    }
                  >
                    Roll range
                  </Button>
                </div>
                {lastBulkUndo && (
                  <Button size="sm" variant="ghost" onClick={handleUndo} leftIcon={<RotateCcw className="w-3 h-3" />}>
                    Undo
                  </Button>
                )}
              </div>

              {/* Assign Action Bar */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                {(board.mentors || []).map((m: any) => (
                  <Button
                    key={m.facultyId}
                    size="sm"
                    onClick={() => handleBulkAssign(m.facultyId)}
                  >
                    Assign to {m.name} ({m.classMenteeCount}/{board.rules.targetGroupSize})
                  </Button>
                ))}
              </div>

              {/* Student Rows */}
              <div className="max-h-96 overflow-y-auto divide-y divide-border text-xs">
                {students.map((s: any, idx: number) => {
                  return (
                    <div
                      key={s.studentId}
                      draggable
                      onDragStart={(e) => {
                        const dragIds = selectedStudentIds.includes(s.studentId) ? selectedStudentIds : [s.studentId];
                        e.dataTransfer.setData('text/plain', JSON.stringify(dragIds));
                      }}
                      className="py-2 px-2 flex items-center justify-between gap-2 hover:bg-slate-50"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.studentId)}
                          onChange={(e) => toggleStudentCheck(s.studentId, idx, (e.nativeEvent as any).shiftKey)}
                        />
                        <div className="truncate">
                          <span className="font-bold text-content">{s.name}</span>
                          <span className="text-content-muted font-mono ml-2">{s.rollNo} • {s.registerNo}</span>
                        </div>
                      </label>
                      <select
                        value={s.mentorId || ''}
                        onChange={(e) => {
                          if (e.target.value) void handleBulkAssign(e.target.value, [s.studentId]);
                        }}
                        className="px-2 py-1 rounded-lg border border-border text-[11px] font-semibold bg-white shrink-0"
                      >
                        <option value="">Unassigned</option>
                        {(board.mentors || []).map((m: any) => (
                          <option key={m.facultyId} value={m.facultyId}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Mentor Panels (5 cols, supports Drop!) */}
            <div className="lg:col-span-5 space-y-4">
              {(board.mentors || []).map((m: any) => {
                const overMax = m.classMenteeCount > board.rules.maxGroupSize;
                const underMin = m.classMenteeCount > 0 && m.classMenteeCount < board.rules.minGroupSize;
                const pct = Math.min(100, Math.round((m.classMenteeCount / Math.max(1, board.rules.targetGroupSize)) * 100));

                return (
                  <Card
                    key={m.facultyId}
                    onDragOver={(e: React.DragEvent) => e.preventDefault()}
                    onDrop={(e: React.DragEvent) => {
                      e.preventDefault();
                      try {
                        const ids = JSON.parse(e.dataTransfer.getData('text/plain'));
                        if (Array.isArray(ids)) void handleBulkAssign(m.facultyId, ids);
                      } catch {
                        // ignore
                      }
                    }}
                    className="space-y-2 border-2 border-dashed border-border hover:border-brand-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-content">{m.name}</span>
                          <Badge variant={m.role === 'advisor' ? 'brand' : 'neutral'} size="sm">
                            {m.role === 'advisor' ? 'Advisor' : 'Mentor'}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-content-muted">
                          {m.classMenteeCount} in this class ({m.totalMenteesAcrossClasses} total)
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-content">
                        {m.classMenteeCount} / {board.rules.targetGroupSize}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                    </div>

                    {(overMax || underMin) && (
                      <div className="text-[11px] text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          {overMax
                            ? `Exceeds recommended max (${board.rules.maxGroupSize})`
                            : `Below recommended min (${board.rules.minGroupSize})`}
                        </span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Import Mapping Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Mentor Mapping"
        description="Paste rows as: RegisterNumber, MentorFacultyID (one per line)"
        size="md"
      >
        <div className="space-y-3 text-xs">
          <textarea
            rows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="113024243001, FAC001&#10;113024243002, FAC002"
            className="w-full p-3 rounded-xl border border-border font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const rows = importText
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l) => {
                    const [registerNo, mentorEmployeeId] = l.split(',').map((x) => x.trim());
                    return { registerNo, mentorEmployeeId };
                  });
                const res = await api.post(`/api/admin/mentors/class/${selectedClassId}/import`, { rows, commit: false });
                setImportPreview(res.data);
              }}
            >
              Preview
            </Button>
            {importPreview && importPreview.valid.length > 0 && (
              <Button
                size="sm"
                onClick={async () => {
                  const rows = importPreview.valid.map((v) => ({ registerNo: v.registerNo, mentorEmployeeId: importText.split('\n').find((l) => l.includes(v.registerNo))?.split(',')[1]?.trim() }));
                  await api.post(`/api/admin/mentors/class/${selectedClassId}/import`, { rows, commit: true });
                  showToast('Mentor mapping imported!', 'success');
                  setImportModalOpen(false);
                  fetchBoard();
                }}
              >
                Commit ({importPreview.valid.length} valid)
              </Button>
            )}
          </div>
          {importPreview && (
            <div className="p-2.5 rounded-xl bg-surface-soft border border-border">
              Valid: <strong>{importPreview.valid.length}</strong> • Invalid: <strong className="text-rose-600">{importPreview.invalid.length}</strong>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
