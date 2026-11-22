import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { Plus, BookOpen, Layers, Building2, UserCheck, CheckCircle2 } from 'lucide-react';

export const AcademicsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DEPARTMENTS' | 'CLASSES' | 'SUBJECTS' | 'ASSIGNMENTS'>('CLASSES');

  // Realistic mock data
  const departments = [
    { id: '1', code: 'CSE', name: 'Computer Science and Engineering', hod: 'Dr. Ramesh Kumar', totalStudents: 480 },
    { id: '2', code: 'ECE', name: 'Electronics and Communication Engineering', hod: 'Dr. Meenakshi S', totalStudents: 420 },
    { id: '3', code: 'MECH', name: 'Mechanical Engineering', hod: 'Dr. Chandrasekhar P', totalStudents: 360 },
  ];

  const classes = [
    { id: '1', name: 'CSE – Year 2 – A', dept: 'CSE', batch: '2023–2027', advisor: 'Dr. Ramesh Kumar', strength: 30, subjectsCount: 6 },
    { id: '2', name: 'CSE – Year 2 – B', dept: 'CSE', batch: '2023–2027', advisor: 'Ms. Priya S', strength: 30, subjectsCount: 6 },
    { id: '3', name: 'ECE – Year 3 – A', dept: 'ECE', batch: '2022–2026', advisor: 'Dr. Meenakshi S', strength: 28, subjectsCount: 5 },
    { id: '4', name: 'MECH – Year 1 – A', dept: 'MECH', batch: '2024–2028', advisor: 'Dr. Chandrasekhar P', strength: 32, subjectsCount: 5 },
  ];

  const subjects = [
    { id: '1', code: 'CS301', name: 'Data Structures and Algorithms', dept: 'CSE', year: 2, credits: 4, type: 'THEORY' },
    { id: '2', code: 'CS302', name: 'Computer Networks', dept: 'CSE', year: 2, credits: 3, type: 'THEORY' },
    { id: '3', code: 'CS303', name: 'Database Management Systems', dept: 'CSE', year: 2, credits: 3, type: 'THEORY' },
    { id: '4', code: 'CS304', name: 'Operating Systems', dept: 'CSE', year: 2, credits: 4, type: 'THEORY' },
    { id: '5', code: 'CS308', name: 'Operating Systems Laboratory', dept: 'CSE', year: 2, credits: 2, type: 'LAB' },
    { id: '6', code: 'MA301', name: 'Discrete Mathematics', dept: 'CSE', year: 2, credits: 4, type: 'THEORY' },
  ];

  const classSubjectAssignments = [
    { id: '1', class: 'CSE – Year 2 – A', subject: 'Data Structures (CS301)', faculty: 'Dr. Ramesh Kumar', sessionsTaken: 26 },
    { id: '2', class: 'CSE – Year 2 – A', subject: 'Computer Networks (CS302)', faculty: 'Ms. Priya S', sessionsTaken: 24 },
    { id: '3', class: 'CSE – Year 2 – A', subject: 'Database Management (CS303)', faculty: 'Dr. Suresh V', sessionsTaken: 22 },
    { id: '4', class: 'CSE – Year 2 – B', subject: 'Data Structures (CS301)', faculty: 'Dr. Ramesh Kumar', sessionsTaken: 25 },
    { id: '5', class: 'CSE – Year 2 – B', subject: 'Database Management (CS303)', faculty: 'Ms. Priya S', sessionsTaken: 23 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Academic Architecture & Curriculum
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Hierarchy: Department → Year/Batch → Class Section → Subject → Faculty Assignment.
          </p>
        </div>

        <Button size="md" leftIcon={<Plus className="w-4 h-4" />}>
          New {activeTab === 'CLASSES' ? 'Class' : activeTab === 'SUBJECTS' ? 'Subject' : 'Assignment'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
        tabs={[
          { id: 'CLASSES', label: 'Class Sections', icon: <Layers className="w-4 h-4" /> },
          { id: 'ASSIGNMENTS', label: 'Class-Subject-Teacher Matrix', icon: <UserCheck className="w-4 h-4" /> },
          { id: 'SUBJECTS', label: 'Curriculum Subjects', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'DEPARTMENTS', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
        ]}
      />

      {/* Tab 1: Class Sections */}
      {activeTab === 'CLASSES' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-soft flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-content">Active Class Sections</h3>
            <Badge variant="brand">Single Source of Truth</Badge>
          </div>
          <div className="divide-y divide-border">
            {classes.map((cls) => (
              <div key={cls.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <h4 className="font-bold text-content text-base">{cls.name}</h4>
                  <p className="text-xs text-content-secondary mt-0.5">
                    Batch: <span className="font-mono text-content">{cls.batch}</span> • Class Advisor: <span className="font-semibold text-brand-600">{cls.advisor}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="bg-surface-soft px-3 py-1.5 rounded-full border border-border">
                    {cls.strength} Students Enrolled
                  </span>
                  <span className="bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full border border-brand-200">
                    {cls.subjectsCount} Subjects Assigned
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 2: Class-Subject-Teacher Assignment Matrix */}
      {activeTab === 'ASSIGNMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-soft flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-sm text-content">
                Class-Subject-Teacher Assignments
              </h3>
              <p className="text-xs text-content-secondary">
                Rule: Exactly 1 faculty assigned per (Class, Subject) pair. Powers My Classes & My Subjects live.
              </p>
            </div>
            <Badge variant="success">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              100% Unique Assigned
            </Badge>
          </div>

          <div className="divide-y divide-border">
            {classSubjectAssignments.map((a) => (
              <div key={a.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wide">
                    {a.class}
                  </span>
                  <h4 className="font-bold text-content text-sm mt-0.5">{a.subject}</h4>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs font-bold text-content block">{a.faculty}</span>
                    <span className="text-[11px] text-content-secondary">
                      {a.sessionsTaken} GPS Sessions Completed
                    </span>
                  </div>
                  <Button variant="soft" size="sm">
                    Reassign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: Curriculum Subjects */}
      {activeTab === 'SUBJECTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-border">
            {subjects.map((s) => (
              <div key={s.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-xl bg-brand-50 text-brand-700 font-mono text-xs font-bold border border-brand-200">
                    {s.code}
                  </span>
                  <div>
                    <h4 className="font-bold text-content text-sm">{s.name}</h4>
                    <span className="text-xs text-content-secondary">
                      Dept: {s.dept} • Year {s.year} • {s.credits} Credits
                    </span>
                  </div>
                </div>
                <Badge variant={s.type === 'LAB' ? 'admin' : 'neutral'} size="sm">
                  {s.type}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 4: Departments */}
      {activeTab === 'DEPARTMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-border">
            {departments.map((d) => (
              <div key={d.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <h4 className="font-bold text-content text-sm flex items-center gap-2">
                    <span className="font-mono text-brand-600 font-bold">{d.code}</span>
                    <span>{d.name}</span>
                  </h4>
                  <p className="text-xs text-content-secondary mt-0.5">
                    Head of Department: <span className="font-semibold text-content">{d.hod}</span>
                  </p>
                </div>
                <span className="text-xs font-bold text-content-secondary">
                  {d.totalStudents} Active Students
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
