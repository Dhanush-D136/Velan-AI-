import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedStudentForView, setSelectedStudentForView] = useState<StudentItem | null>(null);

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

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const params = selectedClassFilter !== 'ALL' ? { classId: selectedClassFilter } : {};
      const res = await api.get('/api/academics/students', { params });
      setStudents(res.data.students || res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to fetch students', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedClassFilter]);

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
        res.data.message || 'Student added successfully with default password 1234',
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
    if (!confirm(`Reset password for ${student.user.name} (${student.registerNo}) to 1234?`)) return;

    try {
      const res = await api.post(`/api/academics/students/${student.id}/reset-password`);
      showToast(res.data.message || 'Password reset to 1234 successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reset password', 'error');
    }
  };

  const handleDeleteStudent = async (student: StudentItem) => {
    if (!confirm(`Delete student ${student.user.name}? This will remove their user account and records.`))
      return;

    try {
      const res = await api.delete(`/api/academics/students/${student.id}`);
      showToast(res.data.message || 'Student deleted successfully', 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete student', 'error');
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

      const res = await api.post('/api/academics/students/import-excel?preview=true', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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

      const res = await api.post('/api/academics/students/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast(res.data.message || 'Students imported successfully!', 'success');
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

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.registerNo.includes(searchTerm) ||
      s.rollNo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const columns: Column<StudentItem>[] = [
    {
      key: 'name',
      header: 'Student',
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.user.name} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{s.user.name}</h4>
            <span className="text-[11px] text-content-secondary font-mono">
              Reg: {s.registerNo} • Roll: {s.rollNo}
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
        </div>
      ),
    },
    {
      key: 'deviceStatus',
      header: 'Device Lock',
      render: (s) => {
        const dev = s.user.devices?.[0];
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Smartphone className="w-3.5 h-3.5 text-content-muted" />
            {dev ? (
              <Badge variant="success" size="sm">
                Bound ({dev.platform || 'Phone'})
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Unbound
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
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setSelectedStudentForView(s)}
            title="View Full Student Profile"
            className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 transition"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleResetPassword(s)}
            title="Reset Password to 1234"
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteStudent(s)}
            title="Delete Student"
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Input
          placeholder="Search student by name, register number or roll..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="w-full sm:w-96 text-xs"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-content-secondary whitespace-nowrap">
            Filter Section:
          </span>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-content outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Sections</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table or Empty State */}
      {students.length === 0 && !isLoading ? (
        <EmptyState
          icon={GraduationCap}
          title="No students registered yet"
          description="Add students manually or bulk import a class roster using an Excel spreadsheet."
          actionLabel="Add First Student"
          onAction={() => {
            if (classes.length === 0) {
              showToast('Please create at least one Class / Section first.', 'error');
              return;
            }
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={(s) => s.id}
          emptyMessage="No students found matching your criteria"
        />
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
              <h4 className="text-xs font-bold text-content uppercase tracking-wider">
                Device Lock Security
              </h4>
              <div className="p-3 rounded-xl bg-slate-50 border border-border text-xs flex items-center justify-between">
                <div>
                  <span className="text-content-secondary block text-[11px]">Bound Hardware Fingerprint</span>
                  <span className="font-mono text-content font-bold">
                    {selectedStudentForView.user.devices?.[0]?.deviceId || 'No hardware device bound'}
                  </span>
                </div>
                <Badge variant={selectedStudentForView.user.devices?.[0] ? 'success' : 'neutral'}>
                  {selectedStudentForView.user.devices?.[0] ? 'Active' : 'Unregistered'}
                </Badge>
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-border">
              <Button size="sm" onClick={() => setSelectedStudentForView(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
