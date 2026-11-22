import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Plus,
  Search,
  Upload,
  Download,
  Smartphone,
  ShieldCheck,
  ArrowRightLeft,
  GraduationCap,
} from 'lucide-react';

interface StudentItem {
  id: string;
  name: string;
  registerNo: string;
  rollNo: string;
  class: string;
  email: string;
  parentPhone: string;
  attendancePercent: number;
  deviceStatus: 'BOUND' | 'PENDING' | 'REVOKED';
  deviceId: string;
}

export const StudentManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const [students, setStudents] = useState<StudentItem[]>([
    {
      id: 'stud_1',
      name: 'Arunachalam V',
      registerNo: '710022104001',
      rollNo: '22CS001',
      class: 'CSE – Year 2 – A',
      email: 'student.arun@velan.ai',
      parentPhone: '+91 94432 10001',
      attendancePercent: 94.2,
      deviceStatus: 'BOUND',
      deviceId: 'dev_iphone_15_arun',
    },
    {
      id: 'stud_2',
      name: 'Bhavani S',
      registerNo: '710022104002',
      rollNo: '22CS002',
      class: 'CSE – Year 2 – A',
      email: 'bhavani.s@velan.ai',
      parentPhone: '+91 94432 10002',
      attendancePercent: 91.5,
      deviceStatus: 'BOUND',
      deviceId: 'dev_pixel_8_bhavani',
    },
    {
      id: 'stud_3',
      name: 'Chandran M',
      registerNo: '710022104003',
      rollNo: '22CS003',
      class: 'CSE – Year 2 – A',
      email: 'chandran.m@velan.ai',
      parentPhone: '+91 94432 10003',
      attendancePercent: 88.0,
      deviceStatus: 'BOUND',
      deviceId: 'dev_galaxy_s23_chandran',
    },
    {
      id: 'stud_4',
      name: 'Karthik Raja S',
      registerNo: '710022104014',
      rollNo: '22CS014',
      class: 'CSE – Year 2 – A',
      email: 'karthik.s@velan.ai',
      parentPhone: '+91 94432 10014',
      attendancePercent: 68.2,
      deviceStatus: 'PENDING',
      deviceId: 'dev_oneplus_12_req',
    },
  ]);

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.registerNo.includes(searchTerm) ||
      s.rollNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'ALL' || s.class === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  const columns: Column<StudentItem>[] = [
    {
      key: 'name',
      header: 'Student',
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.name} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{s.name}</h4>
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
          {s.class}
        </span>
      ),
    },
    {
      key: 'attendancePercent',
      header: 'Attendance %',
      render: (s) => (
        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-bold text-xs ${
              s.attendancePercent < 75 ? 'text-accent-rose' : 'text-accent-emerald'
            }`}
          >
            {s.attendancePercent}%
          </span>
          {s.attendancePercent < 75 && (
            <Badge variant="danger" size="sm">
              Shortage
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'deviceStatus',
      header: 'Device Lock',
      render: (s) => (
        <div className="flex items-center gap-1.5 text-xs">
          <Smartphone className="w-3.5 h-3.5 text-content-muted" />
          <Badge
            variant={
              s.deviceStatus === 'BOUND'
                ? 'success'
                : s.deviceStatus === 'PENDING'
                ? 'warning'
                : 'danger'
            }
            size="sm"
          >
            {s.deviceStatus}
          </Badge>
        </div>
      ),
    },
    {
      key: 'parentPhone',
      header: 'Parent Contact',
      render: (s) => <span className="font-mono text-xs text-content-secondary">{s.parentPhone}</span>,
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
            Student profiles, section transfers, biometric/hardware lock, and attendance metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => alert('Excel Import: Use .xlsx template to bulk import 30+ students.')}
          >
            Import Excel
          </Button>
          <Button
            onClick={() => setIsRegisterModalOpen(true)}
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
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-content outline-none"
          >
            <option value="ALL">All Sections</option>
            <option value="CSE – Year 2 – A">CSE – Year 2 – A</option>
            <option value="CSE – Year 2 – B">CSE – Year 2 – B</option>
            <option value="ECE – Year 3 – A">ECE – Year 3 – A</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        data={filtered}
        keyExtractor={(s) => s.id}
        emptyMessage="No students found matching your criteria"
      />

      {/* Add Student Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Student in Class"
        description="Portal login will be provisioned and device lock activated upon first login."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsRegisterModalOpen(false);
          }}
          className="space-y-4"
        >
          <Input label="Student Full Name" required placeholder="e.g. Abinaya Sundar" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Register Number" required placeholder="710022104015" />
            <Input label="Roll Number" required placeholder="22CS015" />
          </div>
          <Input label="Student Email" type="email" required placeholder="abinaya.s@velan.ai" />
          <Input label="Parent Mobile Contact" required placeholder="+91 94432 00000" />
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Class & Section
            </label>
            <select className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-medium">
              <option>CSE – Year 2 – A (Advisor: Dr. Ramesh Kumar)</option>
              <option>CSE – Year 2 – B (Advisor: Ms. Priya S)</option>
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Enroll Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
