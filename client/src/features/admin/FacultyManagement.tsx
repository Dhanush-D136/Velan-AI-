import React, { useState, useEffect } from 'react';
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
import { Plus, Search, KeyRound, Trash2, Users, AlertCircle } from 'lucide-react';

interface FacultyMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  employeeId: string;
  departmentId: string;
  designation: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  assignedSubjects?: {
    id: string;
    subject: {
      name: string;
      code: string;
    };
    class: {
      name: string;
    };
  }[];
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export const FacultyManagement: React.FC = () => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [facRes, deptRes] = await Promise.all([
        api.get('/api/academics/faculty'),
        api.get('/api/academics/departments'),
      ]);
      const facList = facRes.data.faculty || facRes.data.data || [];
      const deptList = deptRes.data.departments || deptRes.data.data || [];
      setFacultyList(facList);
      setDepartments(deptList);
      if (deptList.length > 0 && !departmentId) {
        setDepartmentId(deptList[0].id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch faculty list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeSync(['data:updated'], fetchData);

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeId.trim() || !departmentId) {
      showToast('Name, Employee ID and Department are required.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post('/api/academics/faculty', {
        name: name.trim(),
        employeeId: employeeId.trim(),
        departmentId,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        designation: designation.trim() || 'Faculty',
      });
      showToast(
        res.data.message || 'Faculty registered successfully with default password 1234',
        'success'
      );
      setName('');
      setEmployeeId('');
      setEmail('');
      setPhone('');
      setIsRegisterModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.message || 'Failed to register faculty member', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (fac: FacultyMember) => {
    if (!confirm(`Reset password for ${fac.name} (${fac.employeeId}) to 1234?`)) return;

    try {
      const res = await api.post(`/api/academics/faculty/${fac.id}/reset-password`);
      showToast(res.data.message || 'Password reset to 1234 successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to reset password', 'error');
    }
  };

  const handleDeleteFaculty = async (fac: FacultyMember) => {
    if (!confirm(`Are you sure you want to delete faculty member ${fac.name}? This will remove their user account.`))
      return;

    try {
      const res = await api.delete(`/api/academics/faculty/${fac.id}`);
      showToast(res.data.message || 'Faculty deleted successfully', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.message || 'Failed to delete faculty', 'error');
    }
  };

  const filteredFaculty = facultyList.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.email && f.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      f.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<FacultyMember>[] = [
    {
      key: 'name',
      header: 'Faculty Member',
      render: (f) => (
        <div className="flex items-center gap-3">
          <Avatar name={f.name} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{f.name}</h4>
            <span className="text-[11px] text-content-secondary font-mono">{f.employeeId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department & Role',
      render: (f) => (
        <div>
          <span className="font-medium text-xs text-content block">
            {f.department ? `${f.department.name} (${f.department.code})` : '—'}
          </span>
          <span className="text-[11px] text-content-secondary">{f.designation}</span>
        </div>
      ),
    },
    {
      key: 'assignedSubjects',
      header: 'Assigned Teaching Subjects',
      render: (f) => {
        const subs = f.assignedSubjects || [];
        if (subs.length === 0) {
          return <span className="text-xs text-content-muted italic">No subjects assigned</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {subs.map((s) => (
              <span
                key={s.id}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200"
              >
                {s.subject.name} ({s.class.name})
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (f) => (
        <div className="text-xs text-content-secondary space-y-0.5">
          <span className="block font-mono">{f.email || '—'}</span>
          <span className="block font-mono text-[11px]">{f.phone || '—'}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (f) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleResetPassword(f)}
            title="Reset Password to 1234"
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteFaculty(f)}
            title="Delete Faculty"
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
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
            Faculty Directory & Workload
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Registered teaching faculty, subject assignments, and portal access credentials.
          </p>
        </div>

        <Button
          onClick={() => {
            if (departments.length === 0) {
              showToast('Please create at least one Department first in Classes & Subjects.', 'error');
              return;
            }
            setIsRegisterModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          size="md"
        >
          Register New Faculty
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search by name, employee ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="w-full sm:w-96 text-xs"
          />
        </div>
      </Card>

      {/* Table or Empty State */}
      {facultyList.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="No faculty members registered"
          description="Register your teaching staff to assign subjects, manage timetables, and activate GPS attendance."
          actionLabel="Register First Faculty"
          onAction={() => {
            if (departments.length === 0) {
              showToast('Please create at least one Department first in Classes & Subjects.', 'error');
              return;
            }
            setIsRegisterModalOpen(true);
          }}
        />
      ) : (
        <Table
          columns={columns}
          data={filteredFaculty}
          keyExtractor={(f) => f.id}
          emptyMessage="No faculty members match your search criteria"
        />
      )}

      {/* Register Faculty Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Faculty Member"
        description="Portal credentials and default password (1234) will be configured automatically."
      >
        <form onSubmit={handleCreateFaculty} className="space-y-4">
          <Input
            label="Full Name"
            required
            placeholder="e.g. Dr. Ramesh Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Employee ID"
              required
              placeholder="e.g. FAC001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
            <Input
              label="Designation"
              required
              placeholder="e.g. Professor / Asst Professor"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Department *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-brand-500"
              required
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Official Email (Optional)"
              type="email"
              placeholder="ramesh@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Mobile Number (Optional)"
              placeholder="+91 98401 23456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              The faculty member can log in immediately using Employee ID and default password{' '}
              <strong className="font-mono">1234</strong>. They will be forced to change it upon first login.
            </span>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsRegisterModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving} disabled={isSaving}>
              Confirm & Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
