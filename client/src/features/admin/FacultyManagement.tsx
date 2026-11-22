import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus, Search, Mail, Phone, BookOpen, KeyRound, ShieldAlert } from 'lucide-react';

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  department: string;
  designation: string;
  assignedSubjects: string[];
  status: 'ACTIVE' | 'INACTIVE';
}

export const FacultyManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const [facultyList, setFacultyList] = useState<FacultyMember[]>([
    {
      id: 'fac_1',
      name: 'Dr. Ramesh Kumar',
      email: 'dr.ramesh@velan.ai',
      phone: '+91 98401 23456',
      employeeId: 'FAC001',
      department: 'Computer Science and Engineering',
      designation: 'Professor & HOD',
      assignedSubjects: ['Data Structures (CS301)', 'Operating Systems (CS304)'],
      status: 'ACTIVE',
    },
    {
      id: 'fac_2',
      name: 'Ms. Priya S',
      email: 'priya.s@velan.ai',
      phone: '+91 98401 23457',
      employeeId: 'FAC002',
      department: 'Computer Science and Engineering',
      designation: 'Associate Professor',
      assignedSubjects: ['Computer Networks (CS302)'],
      status: 'ACTIVE',
    },
    {
      id: 'fac_3',
      name: 'Dr. Suresh V',
      email: 'suresh.v@velan.ai',
      phone: '+91 98401 23458',
      employeeId: 'FAC003',
      department: 'Computer Science and Engineering',
      designation: 'Assistant Professor',
      assignedSubjects: ['Database Management (CS303)'],
      status: 'ACTIVE',
    },
    {
      id: 'fac_4',
      name: 'Dr. Meenakshi Sundaram',
      email: 'meenakshi.s@velan.ai',
      phone: '+91 98401 23459',
      employeeId: 'FAC004',
      department: 'Electronics & Communication',
      designation: 'Professor',
      assignedSubjects: ['Microcontrollers (EC301)'],
      status: 'ACTIVE',
    },
  ]);

  const filteredFaculty = facultyList.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          <span className="font-medium text-xs text-content block">{f.department}</span>
          <span className="text-[11px] text-content-secondary">{f.designation}</span>
        </div>
      ),
    },
    {
      key: 'assignedSubjects',
      header: 'Assigned Teaching Subjects',
      render: (f) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {f.assignedSubjects.map((sub, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200"
            >
              {sub}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (f) => (
        <div className="text-xs text-content-secondary space-y-0.5">
          <span className="block font-mono">{f.email}</span>
          <span className="block font-mono text-[11px]">{f.phone}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (f) => (
        <Badge variant={f.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
          {f.status}
        </Badge>
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
          onClick={() => setIsRegisterModalOpen(true)}
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

      {/* Table */}
      <Table
        columns={columns}
        data={filteredFaculty}
        keyExtractor={(f) => f.id}
        emptyMessage="No faculty members match your search criteria"
      />

      {/* Register Faculty Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Faculty Member"
        description="Portal credentials and one-time password will be generated automatically."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsRegisterModalOpen(false);
          }}
          className="space-y-4"
        >
          <Input label="Full Name" required placeholder="e.g. Dr. Rajesh Kannan" />
          <Input label="Official Email" type="email" required placeholder="rajesh.k@velan.ai" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Employee ID" required placeholder="FAC005" />
            <Input label="Mobile Number" placeholder="+91 98401 00000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Department
            </label>
            <select className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none">
              <option>Computer Science and Engineering</option>
              <option>Electronics & Communication</option>
              <option>Mechanical Engineering</option>
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Confirm & Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
