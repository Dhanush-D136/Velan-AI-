import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  Plus,
  BookOpen,
  Layers,
  Building2,
  UserCheck,
  CheckCircle2,
  Trash2,
  Edit3,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const AcademicsManagement: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'CLASSES' | 'ASSIGNMENTS' | 'SUBJECTS' | 'DEPARTMENTS'>('CLASSES');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [editSection, setEditSection] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editAdvisorId, setEditAdvisorId] = useState('');
  const [classMentor1Id, setClassMentor1Id] = useState('');
  const [classMentor2Id, setClassMentor2Id] = useState('');
  const [editMentor1Id, setEditMentor1Id] = useState('');
  const [editMentor2Id, setEditMentor2Id] = useState('');

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Form states
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptHod, setDeptHod] = useState('');

  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [yearNum, setYearNum] = useState(1);
  const [yearBatch, setYearBatch] = useState('2024–2028');

  const [selectedYearId, setSelectedYearId] = useState('');
  const [classSection, setClassSection] = useState('A');
  const [classRoom, setClassRoom] = useState('');
  const [classAdvisorId, setClassAdvisorId] = useState('');

  const [subjCode, setSubjCode] = useState('');
  const [subjName, setSubjName] = useState('');
  const [subjCredits, setSubjCredits] = useState(3);
  const [subjType, setSubjType] = useState('THEORY');

  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignFacultyId, setAssignFacultyId] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Load all academic data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [hierRes, subjRes, facRes, assignRes] = await Promise.all([
        api.get('/academics/hierarchy'),
        api.get('/academics/subjects'),
        api.get('/academics/faculty'),
        api.get('/academics/assignments'),
      ]);

      setDepartments(hierRes.data.departments || []);
      setSubjects(subjRes.data.subjects || []);
      setFacultyList(facRes.data.faculty || []);
      setAssignments(assignRes.data.assignments || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch academic data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute all available academic years across departments
  const allAcademicYears: any[] = [];
  const allClasses: any[] = [];
  departments.forEach((d) => {
    d.academicYears?.forEach((ay: any) => {
      allAcademicYears.push({ ...ay, deptCode: d.code, deptName: d.name });
      ay.classes?.forEach((c: any) => {
        allClasses.push({ ...c, deptCode: d.code, year: ay.year });
      });
    });
  });

  // 1. Create Department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/academics/departments', {
        code: deptCode.trim().toUpperCase(),
        name: deptName.trim(),
        hodName: deptHod.trim() || undefined,
      });
      toast.success(`Department ${deptCode} created successfully!`);
      setIsDeptModalOpen(false);
      setDeptCode('');
      setDeptName('');
      setDeptHod('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Create Academic Year
  const handleCreateAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId) return toast.error('Please choose a department');
    setIsSaving(true);
    try {
      await api.post('/academics/years', {
        departmentId: selectedDeptId,
        year: Number(yearNum),
        batch: yearBatch.trim(),
      });
      toast.success(`Academic Year ${yearNum} (${yearBatch}) added!`);
      setIsYearModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Create Class Section
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId) return toast.error('Please choose an academic year');
    const chosen = [classAdvisorId, classMentor1Id, classMentor2Id].filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      return toast.error('Advisor, Mentor 1, and Mentor 2 must be three different faculty members.');
    }
    setIsSaving(true);
    try {
      await api.post('/academics/classes', {
        academicYearId: selectedYearId,
        section: classSection.trim().toUpperCase(),
        roomNumber: classRoom.trim() || undefined,
        advisorId: classAdvisorId || undefined,
        mentor1Id: classMentor1Id || undefined,
        mentor2Id: classMentor2Id || undefined,
      });
      toast.success(`Class Section ${classSection} created!`);
      setIsClassModalOpen(false);
      setClassSection('A');
      setClassRoom('');
      setClassMentor1Id('');
      setClassMentor2Id('');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 3b. Update Class Section (section, room, advisor, mentor 1 & 2)
  const openEditClassModal = (cls: any) => {
    setEditingClass(cls);
    setEditSection(cls.section || 'A');
    setEditRoom(cls.roomNumber || '');
    setEditAdvisorId(cls.advisorId || '');
    const mentors = (cls.mentors || []).filter((m: any) => m.role === 'mentor');
    setEditMentor1Id(mentors[0]?.facultyId || '');
    setEditMentor2Id(mentors[1]?.facultyId || '');
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    const chosen = [editAdvisorId, editMentor1Id, editMentor2Id].filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      return toast.error('Advisor, Mentor 1, and Mentor 2 must be three different faculty members.');
    }
    setIsSaving(true);
    try {
      await api.put(`/academics/classes/${editingClass.id}`, {
        section: editSection.trim().toUpperCase(),
        roomNumber: editRoom.trim() || null,
        advisorId: editAdvisorId || null,
        mentor1Id: editMentor1Id || null,
        mentor2Id: editMentor2Id || null,
      });
      toast.success('Class details, advisor & mentors updated!');
      setEditingClass(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update class');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId) return toast.error('Please choose a department');
    setIsSaving(true);
    try {
      await api.post('/academics/subjects', {
        departmentId: selectedDeptId,
        year: Number(yearNum),
        code: subjCode.trim().toUpperCase(),
        name: subjName.trim(),
        type: subjType,
        credits: Number(subjCredits),
      });
      toast.success(`Subject ${subjCode} added successfully!`);
      setIsSubjectModalOpen(false);
      setSubjCode('');
      setSubjName('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Assign Teacher to Subject
  const handleAssignClassSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSubjectId || !assignFacultyId) {
      return toast.error('Please select class, subject, and faculty');
    }
    setIsSaving(true);
    try {
      await api.post('/academics/assignments', {
        classId: assignClassId,
        subjectId: assignSubjectId,
        facultyId: assignFacultyId,
      });
      toast.success('Teacher assigned to subject successfully!');
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete helpers
  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await api.delete(`/academics/departments/${id}`);
      toast.success('Department deleted successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class section?')) return;
    try {
      await api.delete(`/academics/classes/${id}`);
      toast.success('Class deleted successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await api.delete(`/academics/subjects/${id}`);
      toast.success('Subject deleted successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!confirm('Remove this teacher assignment?')) return;
    try {
      await api.delete(`/academics/assignments/${id}`);
      toast.success('Assignment removed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Academic Hierarchy & Curriculum
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Build your structure: Department → Academic Year → Class Section → Subject → Teacher Assignment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {activeTab === 'DEPARTMENTS' && (
            <Button size="sm" onClick={() => setIsDeptModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Add Department
            </Button>
          )}

          {activeTab === 'CLASSES' && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (departments.length === 0) return toast.error('Create a department first');
                  setSelectedDeptId(departments[0].id);
                  setIsYearModalOpen(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Year
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (allAcademicYears.length === 0) return toast.error('Create an academic year first');
                  setSelectedYearId(allAcademicYears[0].id);
                  setIsClassModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Class Section
              </Button>
            </div>
          )}

          {activeTab === 'SUBJECTS' && (
            <Button
              size="sm"
              onClick={() => {
                if (departments.length === 0) return toast.error('Create a department first');
                setSelectedDeptId(departments[0].id);
                setIsSubjectModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Subject
            </Button>
          )}

          {activeTab === 'ASSIGNMENTS' && (
            <Button
              size="sm"
              onClick={() => {
                if (allClasses.length === 0) return toast.error('Create a class section first');
                if (subjects.length === 0) return toast.error('Create a subject first');
                if (facultyList.length === 0) return toast.error('Register a faculty member first');
                setAssignClassId(allClasses[0].id);
                setAssignSubjectId(subjects[0].id);
                setAssignFacultyId(facultyList[0].id);
                setIsAssignModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Assign Teacher
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
        tabs={[
          { id: 'CLASSES', label: 'Class Sections', icon: <Layers className="w-4 h-4" /> },
          { id: 'ASSIGNMENTS', label: 'Subject-Teacher Matrix', icon: <UserCheck className="w-4 h-4" /> },
          { id: 'SUBJECTS', label: 'Subjects Catalog', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'DEPARTMENTS', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
        ]}
      />

      {/* TAB 1: CLASSES */}
      {activeTab === 'CLASSES' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-soft flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-content">Active Class Sections</h3>
            <span className="text-xs text-content-secondary font-mono">{allClasses.length} Total</span>
          </div>

          {allClasses.length === 0 ? (
            <EmptyState
              title="No Class Sections Yet"
              description="Create an academic year and section inside a department to enroll students and take attendance."
              actionLabel="Add Class Section"
              onAction={() => {
                if (allAcademicYears.length === 0) {
                  if (departments.length === 0) {
                    setIsDeptModalOpen(true);
                  } else {
                    setSelectedDeptId(departments[0].id);
                    setIsYearModalOpen(true);
                  }
                } else {
                  setSelectedYearId(allAcademicYears[0].id);
                  setIsClassModalOpen(true);
                }
              }}
            />
          ) : (
            <div className="divide-y divide-border">
              {allClasses.map((cls) => (
                <div key={cls.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-bold text-content text-base">{cls.name}</h4>
                    <p className="text-xs text-content-secondary mt-0.5">
                      Room: <span className="font-mono text-content font-semibold">{cls.roomNumber || 'Not assigned'}</span> • Advisor: <span className="font-semibold text-brand-600">{cls.advisor?.user?.name || 'Unassigned'}</span>
                      {' '}• Mentors:{' '}
                      <span className="font-semibold text-content">
                        {(cls.mentors || []).filter((m: any) => m.role === 'mentor').map((m: any) => m.faculty?.user?.name).filter(Boolean).join(', ') || 'None'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="bg-surface-soft px-3 py-1.5 rounded-full border border-border text-xs font-semibold">
                      {cls._count?.students || 0} Students
                    </span>
                    <button
                      onClick={() => openEditClassModal(cls)}
                      className="p-2 text-brand-600 hover:bg-brand-50 rounded-xl transition-colors"
                      title="Edit Class & Assign Advisor"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClass(cls.id)}
                      className="p-2 text-content-muted hover:text-accent-rose hover:bg-rose-50 rounded-xl transition-colors"
                      title="Delete Class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: ASSIGNMENTS */}
      {activeTab === 'ASSIGNMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-soft flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-sm text-content">Class-Subject-Teacher Assignments</h3>
              <p className="text-xs text-content-secondary">
                Rule: Exactly 1 faculty assigned per (Class, Subject). Powers My Classes & My Subjects live.
              </p>
            </div>
            <Badge variant="brand">{assignments.length} Assigned</Badge>
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              title="No Teacher Assignments Configured"
              description="Assign registered faculty to curriculum subjects for specific classes to schedule timetables."
              actionLabel="Assign Teacher to Subject"
              onAction={() => {
                if (allClasses.length === 0) return toast.error('Create a class first');
                if (subjects.length === 0) return toast.error('Create a subject first');
                if (facultyList.length === 0) return toast.error('Register a faculty member first');
                setAssignClassId(allClasses[0].id);
                setAssignSubjectId(subjects[0].id);
                setAssignFacultyId(facultyList[0].id);
                setIsAssignModalOpen(true);
              }}
            />
          ) : (
            <div className="divide-y divide-border">
              {assignments.map((a) => (
                <div key={a.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-brand-600 uppercase tracking-wide">
                      {a.class?.name}
                    </span>
                    <h4 className="font-bold text-content text-sm mt-0.5">
                      {a.subject?.name} <span className="font-mono text-content-muted">({a.subject?.code})</span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-bold text-content block">{a.faculty?.user?.name}</span>
                      <span className="text-[11px] text-content-secondary font-mono">{a.faculty?.employeeId}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveAssignment(a.id)}
                      className="p-2 text-content-muted hover:text-accent-rose hover:bg-rose-50 rounded-xl transition-colors"
                      title="Remove Assignment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: SUBJECTS */}
      {activeTab === 'SUBJECTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-soft flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-content">Curriculum Subjects Catalog</h3>
            <span className="text-xs text-content-secondary font-mono">{subjects.length} Subjects</span>
          </div>

          {subjects.length === 0 ? (
            <EmptyState
              title="No Subjects Added"
              description="Add course subjects with course codes, credits, and theory/lab classification."
              actionLabel="Add Subject"
              onAction={() => {
                if (departments.length === 0) return toast.error('Create a department first');
                setSelectedDeptId(departments[0].id);
                setIsSubjectModalOpen(true);
              }}
            />
          ) : (
            <div className="divide-y divide-border">
              {subjects.map((s) => (
                <div key={s.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-xl bg-brand-50 text-brand-700 font-mono text-xs font-bold border border-brand-200">
                      {s.code}
                    </span>
                    <div>
                      <h4 className="font-bold text-content text-sm">{s.name}</h4>
                      <span className="text-xs text-content-secondary">
                        Dept: {s.department?.code} • Year {s.year} • {s.credits} Credits
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={s.type === 'LAB' ? 'admin' : 'neutral'} size="sm">
                      {s.type}
                    </Badge>
                    <button
                      onClick={() => handleDeleteSubject(s.id)}
                      className="p-2 text-content-muted hover:text-accent-rose hover:bg-rose-50 rounded-xl transition-colors"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: DEPARTMENTS */}
      {activeTab === 'DEPARTMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-soft flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-content">Academic Departments</h3>
            <span className="text-xs text-content-secondary font-mono">{departments.length} Departments</span>
          </div>

          {departments.length === 0 ? (
            <EmptyState
              title="No Departments Created"
              description="Create your first academic department (e.g. Computer Science, Mechanical) to begin."
              actionLabel="Add Your First Department"
              onAction={() => setIsDeptModalOpen(true)}
            />
          ) : (
            <div className="divide-y divide-border">
              {departments.map((d) => (
                <div key={d.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-bold text-content text-base flex items-center gap-2">
                      <span className="font-mono text-brand-600 font-bold px-2 py-0.5 rounded-lg bg-brand-50 border border-brand-200">
                        {d.code}
                      </span>
                      <span>{d.name}</span>
                    </h4>
                    <p className="text-xs text-content-secondary mt-1">
                      HOD: <span className="font-semibold text-content">{d.hodName || 'Not specified'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs text-content-secondary font-semibold">
                      {d.academicYears?.length || 0} Batches
                    </span>
                    <button
                      onClick={() => handleDeleteDepartment(d.id)}
                      className="p-2 text-content-muted hover:text-accent-rose hover:bg-rose-50 rounded-xl transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* MODAL 1: CREATE DEPARTMENT */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add Department"
        description="Enter department code and full designation."
      >
        <form onSubmit={handleCreateDepartment} className="space-y-4">
          <Input
            label="Department Code"
            required
            placeholder="e.g. CSE or ECE"
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
          />
          <Input
            label="Department Name"
            required
            placeholder="e.g. Computer Science and Engineering"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <Input
            label="Head of Department (HOD Name)"
            placeholder="e.g. Dr. Ramesh Kumar"
            value={deptHod}
            onChange={(e) => setDeptHod(e.target.value)}
          />

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CREATE ACADEMIC YEAR */}
      <Modal
        isOpen={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        title="Add Academic Year & Batch"
        description="Specify year of study and batch interval inside the department."
      >
        <form onSubmit={handleCreateAcademicYear} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Department
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Year of Study
              </label>
              <select
                value={yearNum}
                onChange={(e) => setYearNum(Number(e.target.value))}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value={1}>Year 1</option>
                <option value={2}>Year 2</option>
                <option value={3}>Year 3</option>
                <option value={4}>Year 4</option>
              </select>
            </div>
            <Input
              label="Batch Duration"
              required
              placeholder="e.g. 2024–2028"
              value={yearBatch}
              onChange={(e) => setYearBatch(e.target.value)}
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsYearModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              Add Year
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CREATE CLASS SECTION */}
      <Modal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        title="Add Class Section"
        description="Creates section (A, B, C) and binds room number and optional class advisor."
      >
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              {allAcademicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.deptCode} — Year {ay.year} ({ay.batch})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Section Letter"
              required
              placeholder="e.g. A"
              value={classSection}
              onChange={(e) => setClassSection(e.target.value)}
            />
            <Input
              label="Room / Lab Number"
              placeholder="e.g. Hall 301"
              value={classRoom}
              onChange={(e) => setClassRoom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Class Advisor (Optional)
            </label>
            <select
              value={classAdvisorId}
              onChange={(e) => setClassAdvisorId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              <option value="">No Advisor Assigned</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user?.name} ({f.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Mentor 1 (Optional)
              </label>
              <select
                value={classMentor1Id}
                onChange={(e) => setClassMentor1Id(e.target.value)}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value="">No Mentor 1</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.user?.name} ({f.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Mentor 2 (Optional)
              </label>
              <select
                value={classMentor2Id}
                onChange={(e) => setClassMentor2Id(e.target.value)}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value="">No Mentor 2</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.user?.name} ({f.employeeId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsClassModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              Create Section
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3b: EDIT CLASS SECTION */}
      <Modal
        isOpen={!!editingClass}
        onClose={() => setEditingClass(null)}
        title="Edit Class & Advisor"
        description={editingClass ? `Updating ${editingClass.name}` : ''}
      >
        <form onSubmit={handleUpdateClass} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Section Letter"
              required
              value={editSection}
              onChange={(e) => setEditSection(e.target.value)}
            />
            <Input
              label="Room / Lab Number"
              placeholder="e.g. Hall 301"
              value={editRoom}
              onChange={(e) => setEditRoom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Class Advisor (Optional)
            </label>
            <select
              value={editAdvisorId}
              onChange={(e) => setEditAdvisorId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              <option value="">No Advisor Assigned (Clear)</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user?.name} ({f.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Mentor 1 (Optional)
              </label>
              <select
                value={editMentor1Id}
                onChange={(e) => setEditMentor1Id(e.target.value)}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value="">No Mentor 1 (Clear)</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.user?.name} ({f.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Mentor 2 (Optional)
              </label>
              <select
                value={editMentor2Id}
                onChange={(e) => setEditMentor2Id(e.target.value)}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value="">No Mentor 2 (Clear)</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.user?.name} ({f.employeeId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingClass(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              Save Class Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: CREATE SUBJECT */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Add Curriculum Subject"
        description="Define course title, code, credits, and type."
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Department
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Subject Code"
              required
              placeholder="e.g. CS301"
              value={subjCode}
              onChange={(e) => setSubjCode(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Year of Study
              </label>
              <select
                value={yearNum}
                onChange={(e) => setYearNum(Number(e.target.value))}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value={1}>Year 1</option>
                <option value={2}>Year 2</option>
                <option value={3}>Year 3</option>
                <option value={4}>Year 4</option>
              </select>
            </div>
          </div>

          <Input
            label="Subject Title"
            required
            placeholder="e.g. Data Structures and Algorithms"
            value={subjName}
            onChange={(e) => setSubjName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Credits
              </label>
              <select
                value={subjCredits}
                onChange={(e) => setSubjCredits(Number(e.target.value))}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value={1}>1 Credit</option>
                <option value={2}>2 Credits</option>
                <option value={3}>3 Credits</option>
                <option value={4}>4 Credits</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Subject Type
              </label>
              <select
                value={subjType}
                onChange={(e) => setSubjType(e.target.value)}
                className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
              >
                <option value="THEORY">Theory</option>
                <option value="LAB">Laboratory Block</option>
                <option value="ELECTIVE">Elective</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsSubjectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: ASSIGN TEACHER TO CLASS SUBJECT */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Faculty to Class Subject"
        description="Connects teacher to subject for attendance taking and timetable scheduling."
      >
        <form onSubmit={handleAssignClassSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Class Section
            </label>
            <select
              value={assignClassId}
              onChange={(e) => setAssignClassId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              {allClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Curriculum Subject
            </label>
            <select
              value={assignSubjectId}
              onChange={(e) => setAssignSubjectId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Registered Faculty Member
            </label>
            <select
              value={assignFacultyId}
              onChange={(e) => setAssignFacultyId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm outline-none font-semibold"
            >
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user?.name} ({f.employeeId} • {f.department?.code})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
