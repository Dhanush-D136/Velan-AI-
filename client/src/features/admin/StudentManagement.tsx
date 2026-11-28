import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Column } from '@/components/ui/Table';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { PasswordStatusBadge } from '@/components/ui/TempPasswordModal';
import {
  BulkDeleteModal,
  BulkMoveClassModal,
  RegisterRangeSelectModal,
} from './StudentBulkModals';
import { PersonEditDrawer } from './PersonEditDrawer';
import {
  Plus,
  Search,
  Upload,
  Download,
  Smartphone,
  ShieldCheck,
  KeyRound,
  Trash2,
  GraduationCap,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Lock,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  HeartHandshake,
  ArrowUpDown,
  RotateCcw,
  FolderInput,
  Hash,
  X,
  Pencil,
} from 'lucide-react';

interface StudentItem {
  id: string;
  userId: string;
  registerNo: string;
  rollNo: string;
  classId: string;
  isProfileLocked: boolean;
  canEditProfile: boolean;
  personalEmail?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  photoUrl?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    mustChangePassword?: boolean;
    passwordSetBy?: string | null;
    tempPasswordExpiresAt?: string | null;
    devices?: {
      id: string;
      deviceId: string;
      platform: string;
      isVerified: boolean;
    }[];
  };
  class: {
    id: string;
    name: string;
    academicYear?: {
      yearNumber: number;
      department?: {
        name: string;
        code: string;
      };
    };
  };
  _count?: {
    attendanceRecords: number;
  };
}

interface ClassOption {
  id: string;
  name: string;
  departmentCode?: string;
}

export const StudentManagement: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [passwordStatusFilter, setPasswordStatusFilter] = useState<'ALL' | 'DEFAULT' | 'SET'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortMode, setSortMode] = useState<'reg_asc' | 'reg_desc' | 'name_asc' | 'class' | 'newest'>('reg_asc');
  const [directoryTab, setDirectoryTab] = useState<'ACTIVE' | 'RECYCLE_BIN'>('ACTIVE');
  const [page, setPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Selection state (persists across filters, pagination, and live updates)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lastClickedIdxRef = useRef<number | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [classDeleteTarget, setClassDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [undoState, setUndoState] = useState<{ ids: string[]; count: number } | null>(null);
  const undoTimerRef = useRef<any>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedStudentForView, setSelectedStudentForView] = useState<StudentItem | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<StudentItem | null>(null);
  const [crOnlyFilter, setCrOnlyFilter] = useState(false);

  const handleToggleCR = async (s: StudentItem) => {
    try {
      const res = await api.post(`/api/academics/students/${s.id}/toggle-cr`);
      showToast(res.data?.message || 'Class Representative updated', 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update Class Representative', 'error');
    }
  };

  // Manual Add Form State
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRollNo, setAddRollNo] = useState('');
  const [addRegisterNo, setAddRegisterNo] = useState('');
  const [addClassId, setAddClassId] = useState('');

  // Bulk Import State
  const [importClassId, setImportClassId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommittingImport, setIsCommittingImport] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    validRows: { rollNo: string; registerNo: string; name: string }[];
    errors: { row: number; rollNo: string; registerNo: string; name?: string; error: string }[];
  } | null>(null);

  const fetchClasses = async () => {
    try {
      const res = await api.get('/api/academics/classes');
      const list = res.data.classes || res.data.data || [];
      setClasses(
        list.map((c: any) => ({
          id: c.id,
          name: `${c.name} (${c.academicYear?.department?.code || 'Dept'} Y${c.academicYear?.year || 1})`,
          departmentCode: c.academicYear?.department?.code,
        }))
      );
      if (list.length > 0 && !addClassId) {
        setAddClassId(list[0].id);
        setImportClassId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load classes', err);
    }
  };

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        sort: sortMode,
        page,
        limit: 50,
        deleted: directoryTab === 'RECYCLE_BIN' ? 'true' : 'false',
      };
      if (selectedClassFilter !== 'ALL') params.classId = selectedClassFilter;
      if (passwordStatusFilter !== 'ALL') params.passwordStatus = passwordStatusFilter;
      if (crOnlyFilter) params.crOnly = 'true';
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await api.get('/api/academics/students', { params });
      setStudents(res.data.students || res.data.data || []);
      setTotalStudents(res.data.total ?? (res.data.students?.length || 0));
      setTotalPages(res.data.totalPages ?? 1);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to fetch students', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassFilter, passwordStatusFilter, crOnlyFilter, debouncedSearch, sortMode, page, directoryTab]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds.size]);

  useRealtimeSync(['data:updated'], () => {
    fetchClasses();
    fetchStudents();
  });

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addRollNo.trim() || !addRegisterNo.trim() || !addClassId) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    setIsSavingStudent(true);
    try {
      const res = await api.post('/api/academics/students', {
        name: addName.trim(),
        rollNo: addRollNo.trim(),
        registerNo: addRegisterNo.trim(),
        classId: addClassId,
      });
      showToast(
        res.data.message || 'Student added with default password (1234).',
        'success'
      );
      setAddName('');
      setAddRollNo('');
      setAddRegisterNo('');
      setIsAddModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create student', 'error');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleResetPassword = async (student: StudentItem) => {
    if (!confirm(`Reset password for ${student.user.name} (${student.registerNo}) to the default (1234)?`)) return;

    try {
      const res = await api.post(`/api/academics/students/${student.id}/reset-password`);
      showToast(res.data.message || 'Password reset to the default (1234). The student must set a new one at next login.', 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reset password', 'error');
    }
  };

  const handleDeleteStudent = async (student: StudentItem) => {
    if (!confirm(`Move ${student.user.name} (${student.registerNo}) to Recently Deleted (30-day Recycle Bin)?`)) return;

    try {
      const res = await api.delete(`/api/academics/students/${student.id}`);
      showToast(res.data.message || 'Student moved to Recently Deleted', 'success');
      triggerUndoToast([student.id], 1);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete student', 'error');
    }
  };

  const triggerUndoToast = (ids: string[], count: number) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ ids, count });
    undoTimerRef.current = setTimeout(() => setUndoState(null), 15_000);
  };

  const handleUndoDelete = async () => {
    if (!undoState) return;
    const ids = undoState.ids;
    setUndoState(null);
    try {
      await api.post('/api/academics/students/bulk-restore', { studentIds: ids });
      showToast(`Restored ${ids.length} student(s).`, 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to undo delete', 'error');
    }
  };

  const toggleRowSelection = (id: string, index: number, shiftKey = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedIdxRef.current !== null) {
        const start = Math.min(lastClickedIdxRef.current, index);
        const end = Math.max(lastClickedIdxRef.current, index);
        const shouldSelect = !prev.has(id);
        for (let i = start; i <= end; i++) {
          const sid = students[i]?.id;
          if (!sid) continue;
          if (shouldSelect) next.add(sid);
          else next.delete(sid);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      lastClickedIdxRef.current = index;
      return next;
    });
  };

  const allPageSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        students.forEach((s) => next.delete(s.id));
      } else {
        students.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const handleSelectAllMatching = async () => {
    try {
      const params: Record<string, any> = {
        idsOnly: 'true',
        deleted: directoryTab === 'RECYCLE_BIN' ? 'true' : 'false',
      };
      if (selectedClassFilter !== 'ALL') params.classId = selectedClassFilter;
      if (passwordStatusFilter !== 'ALL') params.passwordStatus = passwordStatusFilter;
      if (crOnlyFilter) params.crOnly = 'true';
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await api.get('/api/academics/students', { params });
      const ids: string[] = res.data?.ids || [];
      setSelectedIds(new Set(ids));
      showToast(`Selected all ${ids.length} matching student(s).`, 'info');
    } catch {
      showToast('Failed to select all matching students', 'error');
    }
  };

  const downloadExcelForIds = async (ids: string[]) => {
    const res = await api.post('/api/academics/students/bulk-export', { studentIds: ids }, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Velan_Students_Selected.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleConfirmBulkDelete = async (downloadBackupFirst: boolean) => {
    setIsBulkSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      if (downloadBackupFirst && directoryTab === 'ACTIVE' && !classDeleteTarget && ids.length > 0) {
        await downloadExcelForIds(ids);
      }
      const payload = classDeleteTarget
        ? { classId: classDeleteTarget.id }
        : { studentIds: ids, permanent: directoryTab === 'RECYCLE_BIN' };
      const res = await api.post('/api/academics/students/bulk-delete', payload);
      const count = res.data?.deletedCount ?? res.data?.purgedCount ?? ids.length;
      showToast(res.data?.message || `${count} student(s) processed.`, 'success');
      if (directoryTab === 'ACTIVE' && Array.isArray(res.data?.deletedIds)) {
        triggerUndoToast(res.data.deletedIds, count);
      }
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
      setClassDeleteTarget(null);
      fetchStudents();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Bulk delete failed', 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleBulkResetPasswords = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Reset password to the default (1234) for ${ids.length} selected student(s)?`)) return;
    try {
      const res = await api.post('/api/academics/students/bulk-reset-passwords', { studentIds: ids });
      showToast(res.data?.message || `Password reset to the default (1234) for ${ids.length} student(s).`, 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Bulk password reset failed', 'error');
    }
  };

  const handleConfirmBulkMove = async (targetClassId: string) => {
    setIsBulkSubmitting(true);
    try {
      const res = await api.post('/api/academics/students/bulk-move-class', {
        studentIds: Array.from(selectedIds),
        targetClassId,
      });
      showToast(res.data?.message || 'Students moved successfully.', 'success');
      setSelectedIds(new Set());
      setIsBulkMoveOpen(false);
      fetchStudents();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to move students', 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleRestoreSelected = async (idsToRestore: string[]) => {
    try {
      const res = await api.post('/api/academics/students/bulk-restore', { studentIds: idsToRestore });
      showToast(res.data?.message || 'Students restored.', 'success');
      setSelectedIds(new Set());
      fetchStudents();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to restore students', 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/api/academics/students/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Students_Import_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Excel template downloaded successfully', 'success');
    } catch (err: any) {
      showToast('Failed to download template', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setPreviewData(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!selectedFile || !importClassId) {
      showToast('Please select a file and target class', 'error');
      return;
    }

    setIsPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('classId', importClassId);

      const res = await api.post('/api/academics/students/import-excel?preview=true', formData);
      setPreviewData(res.data);
      if (res.data.validCount === 0) {
        showToast('No valid rows found in the uploaded spreadsheet', 'warning');
      } else {
        showToast(`Preview loaded: ${res.data.validCount} valid, ${res.data.errorCount} skipped`, 'info');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to preview file', 'error');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!selectedFile || !importClassId) return;

    setIsCommittingImport(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('classId', importClassId);

      const res = await api.post('/api/academics/students/import-excel', formData);
      showToast(res.data.message || 'Students imported with default password (1234)!', 'success');
      setIsImportModalOpen(false);
      setSelectedFile(null);
      setPreviewData(null);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to import students', 'error');
    } finally {
      setIsCommittingImport(false);
    }
  };

  // Server already returns filtered & sorted students; keep array order intact
  const filtered = students;

  const columns: Column<StudentItem>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all students on this page"
          checked={allPageSelected}
          onChange={toggleSelectPage}
          className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
        />
      ),
      width: '44px',
      render: (s) => {
        const idx = filtered.findIndex((item) => item.id === s.id);
        return (
          <input
            type="checkbox"
            aria-label={`Select ${s.registerNo} ${s.user.name}`}
            checked={selectedIds.has(s.id)}
            onChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              toggleRowSelection(s.id, idx, e.shiftKey);
            }}
            className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
          />
        );
      },
    },
    {
      key: 'name',
      header: (
        <button
          type="button"
          onClick={() => setSortMode((m) => (m === 'reg_asc' ? 'reg_desc' : 'reg_asc'))}
          className="inline-flex items-center gap-1 hover:text-brand-600 font-semibold uppercase"
        >
          <span>Register # / Student</span>
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      ),
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.user.name} size="md" />
          <div>
            <div className="font-mono font-bold text-content text-xs">{s.registerNo}</div>
            <h4 className="font-semibold text-content text-sm">{s.user.name}</h4>
            <span className="text-[11px] text-content-muted font-mono">
              Roll / VH: {s.rollNo}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class / Section',
      render: (s) => (
        <span className="font-semibold text-xs text-content bg-surface-soft px-3 py-1 rounded-full border border-border">
          {s.class?.name || 'Assigned Class'}
        </span>
      ),
    },
    {
      key: 'profileStatus',
      header: 'Profile Status',
      render: (s) => (
        <div>
          {s.isProfileLocked ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Lock className="w-3 h-3 text-emerald-600" /> Completed & Locked
            </span>
          ) : s.canEditProfile ? (
            <Badge variant="warning" size="sm">
              Unlocked for Edit
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              Pending First Login
            </Badge>
          )}
          {(s as any).classRepresentatives?.length > 0 && (
            <Badge variant="student" size="sm" className="ml-1">
              CR
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'deviceStatus',
      header: 'Device Lock (Max 2)',
      render: (s) => {
        const devs = s.user.devices || [];
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Smartphone className="w-3.5 h-3.5 text-content-muted" />
            {devs.length > 0 ? (
              <Badge variant="success" size="sm">
                {devs.length}/2 ({devs.map((d: any) => d.deviceType || d.platform || 'Device').join(', ')})
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                0/2 Unbound
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (s) => (
        <div className="text-xs text-content-secondary space-y-0.5">
          <span className="block font-mono">{s.personalEmail || s.user.email}</span>
          <span className="block font-mono text-[11px]">{s.phone || s.guardianPhone || '—'}</span>
        </div>
      ),
    },
    {
      key: 'passwordStatus',
      header: 'Password Status',
      render: (s) => <PasswordStatusBadge user={s.user} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {directoryTab === 'RECYCLE_BIN' ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => handleRestoreSelected([s.id])}
              >
                Restore
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => {
                  setSelectedIds(new Set([s.id]));
                  setIsBulkDeleteOpen(true);
                }}
              >
                Delete Forever
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedStudentForView(s)}
                title="View Full Student Profile"
                className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 transition"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleCR(s)}
                title={(s as any).classRepresentatives?.length > 0 ? 'Remove CR' : 'Make CR'}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                  (s as any).classRepresentatives?.length > 0
                    ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                    : 'bg-slate-100 text-content-secondary hover:bg-slate-200'
                }`}
              >
                {(s as any).classRepresentatives?.length > 0 ? 'Remove CR' : 'Make CR'}
              </button>
              <button
                onClick={() => setStudentToEdit(s)}
                title="Edit Student Details"
                className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleResetPassword(s)}
                title="Reset Password (One-Time Temp)"
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteStudent(s)}
                title="Move to Recently Deleted"
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Student Management & Device Registry
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Student profiles, section transfers, hardware device lock, and profile completion records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => {
              if (classes.length === 0) {
                showToast('Please create at least one Class / Section first.', 'error');
                return;
              }
              setIsImportModalOpen(true);
            }}
          >
            Import Excel
          </Button>
          <Button
            onClick={() => {
              if (classes.length === 0) {
                showToast('Please create at least one Class / Section first.', 'error');
                return;
              }
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* Tabs: Active Directory vs Recently Deleted (30-Day Recycle Bin) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDirectoryTab('ACTIVE');
              setSelectedIds(new Set());
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              directoryTab === 'ACTIVE'
                ? 'bg-brand-gradient text-white shadow-sm'
                : 'bg-surface-soft text-content-secondary hover:text-content'
            }`}
          >
            Active Students {directoryTab === 'ACTIVE' ? `(${totalStudents})` : ''}
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectoryTab('RECYCLE_BIN');
              setSelectedIds(new Set());
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              directoryTab === 'RECYCLE_BIN'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-surface-soft text-content-secondary hover:text-content'
            }`}
          >
            Recently Deleted (30d) {directoryTab === 'RECYCLE_BIN' ? `(${totalStudents})` : ''}
          </button>
        </div>

        {directoryTab === 'ACTIVE' && selectedClassFilter !== 'ALL' && totalStudents > 0 && (
          <Button
            type="button"
            size="sm"
            variant="danger"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => {
              const clsObj = classes.find((c) => c.id === selectedClassFilter);
              if (clsObj) {
                setClassDeleteTarget({ id: clsObj.id, name: clsObj.name });
                setIsBulkDeleteOpen(true);
              }
            }}
          >
            Delete ALL in Class
          </Button>
        )}
      </div>

      {/* Filter, Sort, Range & Search Bar */}
      <Card className="p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <Input
          placeholder="Search student by name, register number or roll..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="w-full lg:w-80 text-xs"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter Section"
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-content outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Sections</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Password Status"
            value={passwordStatusFilter}
            onChange={(e) => {
              setPasswordStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-content outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">Password: All</option>
            <option value="DEFAULT">Default (must change)</option>
            <option value="SET">Set by user</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setCrOnlyFilter((prev) => !prev);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
              crOnlyFilter
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-content border-border hover:bg-surface-soft'
            }`}
          >
            Class Representatives
          </button>

          <select
            aria-label="Sort Students"
            value={sortMode}
            onChange={(e) => {
              setSortMode(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-content outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="reg_asc">Sort: Register # (Default)</option>
            <option value="reg_desc">Sort: Register # (Desc)</option>
            <option value="name_asc">Sort: Name A to Z</option>
            <option value="class">Sort: Class</option>
            <option value="newest">Sort: Newest first</option>
          </select>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Hash className="w-3.5 h-3.5" />}
            onClick={() => setIsRangeModalOpen(true)}
          >
            Range
          </Button>
        </div>
      </Card>

      {/* Email-style "Select all matching filters" banner */}
      {allPageSelected && totalStudents > students.length && selectedIds.size < totalStudents && (
        <div className="px-4 py-2.5 rounded-2xl bg-brand-50 border border-brand-200 text-xs text-brand-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>{students.length}</strong> students on this page selected.
          </span>
          <button
            type="button"
            onClick={handleSelectAllMatching}
            className="font-bold text-brand-700 hover:underline"
          >
            Select all {totalStudents} matching your filters
          </button>
        </div>
      )}

      {/* Table (Desktop) + Cards (Mobile) or Empty State */}
      {students.length === 0 && !isLoading ? (
        <EmptyState
          icon={GraduationCap}
          title={directoryTab === 'RECYCLE_BIN' ? 'Recycle Bin is empty' : 'No students registered yet'}
          description={
            directoryTab === 'RECYCLE_BIN'
              ? 'Deleted students appear here for 30 days before permanent removal.'
              : 'Add students manually or bulk import a class roster using an Excel spreadsheet.'
          }
          actionLabel={directoryTab === 'ACTIVE' ? 'Add First Student' : undefined}
          onAction={
            directoryTab === 'ACTIVE'
              ? () => {
                  if (classes.length === 0) {
                    showToast('Please create at least one Class / Section first.', 'error');
                    return;
                  }
                  setIsAddModalOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table
              columns={columns}
              data={filtered}
              keyExtractor={(s) => s.id}
              isLoading={isLoading}
              loadingLabel="Loading students"
              emptyMessage="No students found matching your criteria"
            />
          </div>

          {/* Mobile Card List (aligned, 44px checkboxes) */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((s, idx) => {
              const isSel = selectedIds.has(s.id);
              return (
                <Card key={s.id} className={`p-3.5 space-y-2.5 ${isSel ? 'ring-2 ring-brand-500 bg-brand-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <label className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 -mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => {}}
                          onClick={(e) => toggleRowSelection(s.id, idx, e.shiftKey)}
                          className="w-5 h-5 rounded accent-brand-600"
                        />
                      </label>
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-xs text-content">{s.registerNo}</div>
                        <div className="font-semibold text-sm text-content truncate">{s.user.name}</div>
                        <div className="text-[11px] text-content-muted font-mono">
                          Roll: {s.rollNo} • {s.class?.name || 'Class'}
                        </div>
                      </div>
                    </div>
                    <PasswordStatusBadge user={s.user} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-content-secondary">
                Page {page} of {totalPages} ({totalStudents} total)
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Student in Class"
        description="Portal credentials and default password (1234) will be set. Device lock activates on first login."
      >
        <form onSubmit={handleManualAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Class / Section *
            </label>
            <select
              value={addClassId}
              onChange={(e) => setAddClassId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-brand-500"
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Student Full Name"
            required
            placeholder="e.g. Arunachalam V"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Roll Number"
              required
              placeholder="e.g. 24CS001"
              value={addRollNo}
              onChange={(e) => setAddRollNo(e.target.value)}
            />
            <Input
              label="Register Number"
              required
              placeholder="e.g. 710024104001"
              value={addRegisterNo}
              onChange={(e) => setAddRegisterNo(e.target.value)}
            />
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              Initial password will be set to <strong className="font-mono">1234</strong>. The student will be forced to change it and complete profile details on their first login.
            </span>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSavingStudent}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingStudent} disabled={isSavingStudent}>
              Create Student Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Excel Bulk Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setPreviewData(null);
          setSelectedFile(null);
        }}
        title="Import Students from Excel"
        description="Upload an Excel spreadsheet (.xlsx) to bulk register students into a class."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Select Target Class / Section *
            </label>
            <select
              value={importClassId}
              onChange={(e) => setImportClassId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Download Template Box */}
          <div className="p-4 rounded-2xl bg-surface-soft border border-border flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-content">Download Official Excel Template</h4>
              <p className="text-[11px] text-content-secondary mt-0.5">
                Headers: <span className="font-mono font-semibold">ROLL NUMBER, REGISTER NUMBER, STUDENT NAME</span>
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadTemplate}
            >
              Template
            </Button>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Select .xlsx File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-xs text-content-secondary file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            />
          </div>

          {selectedFile && !previewData && (
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePreviewImport}
                isLoading={isPreviewLoading}
                className="w-full"
              >
                Validate & Preview Rows
              </Button>
            </div>
          )}

          {/* Preview Results */}
          {previewData && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {previewData.validCount} Valid to Import
                </span>
                {previewData.errorCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {previewData.errorCount} Rows with Errors
                  </span>
                )}
              </div>

              {/* Error Breakdown */}
              {previewData.errorCount > 0 && (
                <div className="max-h-32 overflow-y-auto p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs text-rose-900 space-y-1">
                  <span className="font-bold block">Skipped Rows:</span>
                  {previewData.errors.map((err, idx) => (
                    <div key={idx} className="text-[11px]">
                      Row {err.row}: {err.rollNo || '—'} ({err.registerNo || '—'}) - {err.error}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Rows Table */}
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-soft text-content-secondary border-b border-border sticky top-0">
                    <tr>
                      <th className="p-2">Roll No</th>
                      <th className="p-2">Register No</th>
                      <th className="p-2">Student Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewData.validRows.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 font-mono">{row.rollNo}</td>
                        <td className="p-2 font-mono">{row.registerNo}</td>
                        <td className="p-2 font-medium">{row.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isCommittingImport && previewData && (
            <InlineLoader
              compact
              showBlocks={false}
              label={`Importing ${previewData.validCount} students`}
            />
          )}

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsImportModalOpen(false);
                setPreviewData(null);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCommitImport}
              disabled={!previewData || previewData.validCount === 0 || isCommittingImport}
              isLoading={isCommittingImport}
            >
              Confirm & Create ({previewData ? previewData.validCount : 0} Students)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Student Profile Detail Modal */}
      {selectedStudentForView && (
        <Modal
          isOpen={!!selectedStudentForView}
          onClose={() => setSelectedStudentForView(null)}
          title="Student Profile Dossier"
          description={`Full details and institutional registry for ${selectedStudentForView.user.name}`}
        >
          <div className="space-y-5">
            {/* Header / Avatar */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-soft border border-border">
              <Avatar name={selectedStudentForView.user.name} size="lg" />
              <div>
                <h3 className="font-heading font-extrabold text-lg text-content">
                  {selectedStudentForView.user.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                    Roll: {selectedStudentForView.rollNo}
                  </span>
                  <span className="font-mono text-xs text-content-secondary">
                    Reg: {selectedStudentForView.registerNo}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Lock Status Banner */}
            <div className="p-3.5 rounded-xl border flex items-center justify-between text-xs bg-indigo-50/70 border-indigo-200 text-indigo-950">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>
                  {selectedStudentForView.isProfileLocked
                    ? 'Student profile is locked by student submission.'
                    : 'Profile details not yet finalized by student.'}
                </span>
              </div>
              <Badge variant={selectedStudentForView.isProfileLocked ? 'success' : 'neutral'}>
                {selectedStudentForView.isProfileLocked ? 'Locked' : 'Draft'}
              </Badge>
            </div>

            {/* Personal Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-content uppercase tracking-wider">
                Personal Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <span className="text-content-secondary block text-[11px]">Personal Email</span>
                  <span className="font-mono font-medium text-content">
                    {selectedStudentForView.personalEmail || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <span className="text-content-secondary block text-[11px]">Phone Number</span>
                  <span className="font-mono font-medium text-content">
                    {selectedStudentForView.phone || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <span className="text-content-secondary block text-[11px]">Date of Birth</span>
                  <span className="font-medium text-content">
                    {selectedStudentForView.dob || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <span className="text-content-secondary block text-[11px]">Gender & Blood</span>
                  <span className="font-medium text-content">
                    {selectedStudentForView.gender || '—'} • {selectedStudentForView.bloodGroup || '—'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-border text-xs">
                <span className="text-content-secondary block text-[11px]">Residential Address</span>
                <span className="font-medium text-content">
                  {selectedStudentForView.address || '—'}
                </span>
              </div>
            </div>

            {/* Parent Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-content uppercase tracking-wider">
                Parent / Guardian
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <span className="text-content-secondary block text-[11px]">Guardian Name</span>
                  <span className="font-medium text-content">
                    {selectedStudentForView.guardianName || '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-border">
                  <span className="text-content-secondary block text-[11px]">Guardian Phone</span>
                  <span className="font-mono font-medium text-content">
                    {selectedStudentForView.guardianPhone || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware Binding */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-content uppercase tracking-wider">
                  Device Lock Security ({(selectedStudentForView.user.devices || []).length} / 2 Devices)
                </h4>
                {(selectedStudentForView.user.devices || []).length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Revoke ALL registered devices for ${selectedStudentForView.user.name}?`)) return;
                      try {
                        await api.delete(`/api/academics/students/${selectedStudentForView.id}/devices/all`);
                        showToast('All devices revoked', 'success');
                        setSelectedStudentForView((prev: any) =>
                          prev ? { ...prev, user: { ...prev.user, devices: [] } } : null
                        );
                        fetchStudents();
                      } catch (err: any) {
                        showToast(err?.response?.data?.error || 'Failed to revoke devices', 'error');
                      }
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    Revoke All
                  </button>
                )}
              </div>

              {(selectedStudentForView.user.devices || []).length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-border text-xs text-content-muted">
                  No hardware devices bound yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {(selectedStudentForView.user.devices || []).map((dev: any) => (
                    <div key={dev.id} className="p-3 rounded-xl bg-slate-50 border border-border text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="brand" size="sm">{dev.deviceType || 'DEVICE'}</Badge>
                          <span className="font-semibold text-content">{dev.platform || 'Unknown Platform'}</span>
                        </div>
                        <span className="font-mono text-[11px] text-content-muted block truncate mt-1">
                          ID: {dev.deviceId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.delete(`/api/academics/students/${selectedStudentForView.id}/devices/${dev.id}`);
                            showToast('Device revoked', 'success');
                            setSelectedStudentForView((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    user: {
                                      ...prev.user,
                                      devices: (prev.user.devices || []).filter((d: any) => d.id !== dev.id),
                                    },
                                  }
                                : null
                            );
                            fetchStudents();
                          } catch (err: any) {
                            showToast(err?.response?.data?.error || 'Failed to revoke device', 'error');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 shrink-0"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end border-t border-border">
              <Button size="sm" onClick={() => setSelectedStudentForView(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95vw] max-w-4xl bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full bg-brand-600">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              title="Clear selection (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {directoryTab === 'RECYCLE_BIN' ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px]"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => handleRestoreSelected(Array.from(selectedIds))}
                >
                  Restore
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className="min-h-[44px]"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setClassDeleteTarget(null);
                    setIsBulkDeleteOpen(true);
                  }}
                >
                  Delete Forever
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px]"
                  leftIcon={<KeyRound className="w-3.5 h-3.5" />}
                  onClick={handleBulkResetPasswords}
                >
                  Reset Passwords
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px]"
                  leftIcon={<FolderInput className="w-3.5 h-3.5" />}
                  onClick={() => setIsBulkMoveOpen(true)}
                >
                  Move to Class
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px]"
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => downloadExcelForIds(Array.from(selectedIds))}
                >
                  Export Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className="min-h-[44px]"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setClassDeleteTarget(null);
                    setIsBulkDeleteOpen(true);
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 15-second Undo Delete Toast */}
      {undoState && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold">
          <span>{undoState.count} student(s) deleted.</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-900 font-bold hover:bg-amber-300"
          >
            Undo
          </button>
        </div>
      )}

      <BulkDeleteModal
        isOpen={isBulkDeleteOpen}
        onClose={() => {
          setIsBulkDeleteOpen(false);
          setClassDeleteTarget(null);
        }}
        selectedCount={classDeleteTarget ? totalStudents : selectedIds.size}
        previewStudents={
          classDeleteTarget
            ? students
            : students.filter((s) => selectedIds.has(s.id))
        }
        classDeleteName={classDeleteTarget?.name}
        isPermanent={directoryTab === 'RECYCLE_BIN'}
        isSubmitting={isBulkSubmitting}
        onConfirm={handleConfirmBulkDelete}
      />

      <BulkMoveClassModal
        isOpen={isBulkMoveOpen}
        onClose={() => setIsBulkMoveOpen(false)}
        selectedCount={selectedIds.size}
        classes={classes}
        isSubmitting={isBulkSubmitting}
        onConfirm={handleConfirmBulkMove}
      />

      <RegisterRangeSelectModal
        isOpen={isRangeModalOpen}
        onClose={() => setIsRangeModalOpen(false)}
        students={students}
        onApply={(ids) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
          });
        }}
      />

      <PersonEditDrawer
        isOpen={!!studentToEdit}
        mode="student"
        person={studentToEdit}
        classes={classes}
        onClose={() => setStudentToEdit(null)}
        onSaved={(msg) => {
          showToast(msg, 'success');
          fetchStudents();
        }}
      />
    </div>
  );
};
