import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { Download, FileText, Edit3, Trash2, Plus, Calendar, Award, Sliders } from 'lucide-react';

async function downloadProtectedFile(path: string, filename: string) {
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

const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'RA', 'WH', 'WD', 'AB'];

export const AdminAcademicsPortal: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'RECORDS' | 'GRADING' | 'CALENDAR'>('RECORDS');
  const [isLoading, setIsLoading] = useState(true);

  const [students, setStudents] = useState<any[]>([]);
  const [deptAverages, setDeptAverages] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState('ALL');

  const [scales, setScales] = useState<any[]>([]);
  const [multiplier, setMultiplier] = useState(10);
  const [lookups, setLookups] = useState<any[]>([]);
  const [newLookup, setNewLookup] = useState({ subjectCode: '', subjectName: '', credits: 3 });

  const [semesterDates, setSemesterDates] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [semForm, setSemForm] = useState({ label: 'Even Semester 2026', startDate: '', endDate: '' });
  const [holForm, setHolForm] = useState({ date: '', name: '' });
  const [reqThresh, setReqThresh] = useState(75);
  const [condThresh, setCondThresh] = useState(65);

  // Admin Edit Student Academic Modal
  const [editStudent, setEditStudent] = useState<any>(null);
  const [editSemNum, setEditSemNum] = useState(1);
  const [editSubjects, setEditSubjects] = useState<Array<{ subjectCode: string; subjectName: string; credits: number; grade: string }>>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [acadRes, clsRes, scaleRes, lookRes, semRes, holRes, setRes] = await Promise.all([
        api.get(`/api/academics-records/admin?classId=${classFilter}`),
        api.get('/api/academics/classes'),
        api.get('/api/academics-records/grading-scales'),
        api.get('/api/academics-records/credit-lookup'),
        api.get('/api/skip/semester-dates'),
        api.get('/api/skip/holidays'),
        api.get('/api/settings'),
      ]);
      setStudents(acadRes.data?.students || []);
      setDeptAverages(acadRes.data?.departmentAverages || []);
      setClasses(clsRes.data?.classes || []);
      setScales(scaleRes.data?.scales || []);
      setMultiplier(scaleRes.data?.cgpaMultiplier || 10);
      setLookups(lookRes.data?.lookups || []);
      setSemesterDates(semRes.data?.semesterDates || []);
      setHolidays(holRes.data?.holidays || []);
      setReqThresh(Number(setRes.data?.settings?.MIN_ATTENDANCE_PERCENT || 75));
      setCondThresh(Number(setRes.data?.settings?.CONDONATION_PERCENT || 65));
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useRealtimeSync(['data:updated'], fetchAll);

  const openEditModal = async (studentId: string) => {
    try {
      const res = await api.get(`/api/academics-records/student/${studentId}`);
      setEditStudent(res.data);
      const firstSem = res.data.semesters?.[0];
      if (firstSem) {
        setEditSemNum(firstSem.semesterNumber);
        setEditSubjects(
          firstSem.subjects.map((s: any) => ({
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            credits: s.credits,
            grade: s.grade,
          }))
        );
      } else {
        setEditSemNum(1);
        setEditSubjects([{ subjectCode: 'CS101', subjectName: 'Subject 1', credits: 3, grade: 'A+' }]);
      }
    } catch {
      showToast('Failed to load student academic record', 'error');
    }
  };

  const handleAdminSaveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    try {
      await api.post(`/api/academics-records/student/${editStudent.student.id}/semester`, {
        semesterNumber: editSemNum,
        regulation: '2021',
        subjects: editSubjects.map((s) => ({
          ...s,
          result: ['RA', 'WH', 'WD', 'AB'].includes(s.grade) ? 'RA' : 'PASS',
        })),
      });
      showToast('Academic record updated & audit-logged!', 'success');
      setEditStudent(null);
      fetchAll();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update academic record', 'error');
    }
  };

  if (isLoading) {
    return <DatabaseLoader message="Loading Admin Academics & Calendar..." subtext="Syncing CGPA records, grading scales, and semester holidays" />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Academics, Grading &amp; Semester Calendar
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Manage CGPA records with audit logging, Anna University grading scale, semester dates, and holidays.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === 'RECORDS' ? 'primary' : 'secondary'} onClick={() => setTab('RECORDS')} leftIcon={<Award className="w-4 h-4" />}>
            Student Academics
          </Button>
          <Button size="sm" variant={tab === 'GRADING' ? 'primary' : 'secondary'} onClick={() => setTab('GRADING')} leftIcon={<Sliders className="w-4 h-4" />}>
            Grading &amp; Credits
          </Button>
          <Button size="sm" variant={tab === 'CALENDAR' ? 'primary' : 'secondary'} onClick={() => setTab('CALENDAR')} leftIcon={<Calendar className="w-4 h-4" />}>
            Semester &amp; Holidays
          </Button>
        </div>
      </div>

      {tab === 'RECORDS' && (
        <>
          {deptAverages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {deptAverages.map((d) => (
                <Card key={d.code} className="p-4">
                  <div className="text-xs font-bold text-brand-600">{d.code} Average CGPA</div>
                  <div className="text-2xl font-heading font-extrabold text-content mt-1">{d.averageCgpa.toFixed(2)}</div>
                  <div className="text-[11px] text-content-muted">{d.studentCount} student(s)</div>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-xs bg-white font-semibold"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => downloadProtectedFile(`/api/academics-records/export/excel?classId=${classFilter}`, 'Institution_Academics.xlsx')}
              >
                Export Excel
              </Button>
              <Button
                size="sm"
                leftIcon={<FileText className="w-4 h-4" />}
                onClick={() => downloadProtectedFile(`/api/academics-records/export/pdf?classId=${classFilter}`, 'Institution_Academics.pdf')}
              >
                Export PDF
              </Button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-soft text-content-secondary uppercase text-[10px] border-b border-border">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Roll / Reg</th>
                    <th className="p-3">CGPA</th>
                    <th className="p-3">Credits</th>
                    <th className="p-3">Arrears</th>
                    <th className="p-3 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-content">{s.name}</td>
                      <td className="p-3 text-content-secondary">{s.className}</td>
                      <td className="p-3 font-mono">{s.rollNo} • {s.registerNo}</td>
                      <td className="p-3 font-bold text-brand-700">{s.hasUploaded ? s.cgpa.toFixed(2) : '—'}</td>
                      <td className="p-3">{s.totalCredits}</td>
                      <td className="p-3">
                        <Badge variant={s.arrearsCount > 0 ? 'danger' : 'success'} size="sm">{s.arrearsCount}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => openEditModal(s.studentId)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'GRADING' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="space-y-4">
            <h3 className="font-heading font-bold text-base text-content">Regulation 2021 Grading Scale</h3>
            <div className="space-y-2 text-xs">
              {scales.map((sc) => (
                <div key={sc.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-soft border border-border">
                  <div>
                    <strong className="text-sm">{sc.grade}</strong>
                    <span className="ml-2 text-content-muted">{sc.label || ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={10}
                      defaultValue={sc.points}
                      onBlur={async (e) => {
                        await api.post('/api/academics-records/grading-scales', {
                          regulation: sc.regulation,
                          grade: sc.grade,
                          points: Number(e.target.value),
                          isPass: sc.isPass,
                          isArrear: sc.isArrear,
                          label: sc.label,
                        });
                        showToast(`Grade ${sc.grade} updated`, 'success');
                      }}
                      className="w-16 px-2 py-1 rounded-lg border border-border text-center font-bold"
                    />
                    <Badge variant={sc.isArrear ? 'danger' : 'success'} size="sm">{sc.isArrear ? 'Arrear' : 'Pass'}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span>CGPA to Percentage Multiplier:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-lg border border-border"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    await api.put('/api/academics-records/cgpa-multiplier', { multiplier });
                    showToast('Multiplier updated', 'success');
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="font-heading font-bold text-base text-content">Subject Credit Fallback Lookup</h3>
            <div className="grid grid-cols-12 gap-2 text-xs">
              <input
                placeholder="Code (21AI41T)"
                value={newLookup.subjectCode}
                onChange={(e) => setNewLookup((p) => ({ ...p, subjectCode: e.target.value.toUpperCase() }))}
                className="col-span-4 px-2.5 py-2 rounded-xl border border-border font-mono"
              />
              <input
                placeholder="Subject Name"
                value={newLookup.subjectName}
                onChange={(e) => setNewLookup((p) => ({ ...p, subjectName: e.target.value }))}
                className="col-span-4 px-2.5 py-2 rounded-xl border border-border"
              />
              <input
                type="number"
                step="0.5"
                value={newLookup.credits}
                onChange={(e) => setNewLookup((p) => ({ ...p, credits: Number(e.target.value) }))}
                className="col-span-2 px-2.5 py-2 rounded-xl border border-border"
              />
              <Button
                size="sm"
                className="col-span-2"
                onClick={async () => {
                  await api.post('/api/academics-records/credit-lookup', { ...newLookup, regulation: '2021' });
                  setNewLookup({ subjectCode: '', subjectName: '', credits: 3 });
                  showToast('Credit lookup saved', 'success');
                  fetchAll();
                }}
              >
                Add
              </Button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto text-xs">
              {lookups.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-soft border border-border">
                  <span><strong className="font-mono">{l.subjectCode}</strong> — {l.subjectName || 'Fallback'} ({l.credits} cr)</span>
                  <button
                    onClick={async () => {
                      await api.delete(`/api/academics-records/credit-lookup/${l.id}`);
                      fetchAll();
                    }}
                    className="text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'CALENDAR' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="space-y-4">
            <h3 className="font-heading font-bold text-base text-content">Attendance Thresholds &amp; Semester Dates</h3>
            <div className="grid grid-cols-3 gap-2 items-end text-xs pb-3 border-b border-border">
              <label>
                <span className="text-content-muted block mb-1">Required %</span>
                <input type="number" value={reqThresh} onChange={(e) => setReqThresh(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-border" />
              </label>
              <label>
                <span className="text-content-muted block mb-1">Condonation %</span>
                <input type="number" value={condThresh} onChange={(e) => setCondThresh(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-border" />
              </label>
              <Button
                size="sm"
                onClick={async () => {
                  await api.put('/api/skip/thresholds', { requiredPercent: reqThresh, condonationPercent: condThresh });
                  showToast('Thresholds saved!', 'success');
                }}
              >
                Save Limits
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <input
                placeholder="Semester Label"
                value={semForm.label}
                onChange={(e) => setSemForm((p) => ({ ...p, label: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-border"
              />
              <input
                type="date"
                value={semForm.startDate}
                onChange={(e) => setSemForm((p) => ({ ...p, startDate: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-border"
              />
              <input
                type="date"
                value={semForm.endDate}
                onChange={(e) => setSemForm((p) => ({ ...p, endDate: e.target.value }))}
                className="px-3 py-2 rounded-xl border border-border"
              />
            </div>
            <Button
              size="sm"
              onClick={async () => {
                await api.post('/api/skip/semester-dates', semForm);
                showToast('Semester dates saved!', 'success');
                fetchAll();
              }}
            >
              Add Semester Window
            </Button>

            <div className="space-y-2 text-xs">
              {semesterDates.map((sd) => (
                <div key={sd.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-soft border border-border">
                  <span><strong>{sd.label}</strong>: {new Date(sd.startDate).toLocaleDateString()} – {new Date(sd.endDate).toLocaleDateString()}</span>
                  <button onClick={async () => { await api.delete(`/api/skip/semester-dates/${sd.id}`); fetchAll(); }} className="text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="font-heading font-bold text-base text-content">Institutional Holidays</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <input type="date" value={holForm.date} onChange={(e) => setHolForm((p) => ({ ...p, date: e.target.value }))} className="px-3 py-2 rounded-xl border border-border" />
              <input placeholder="Holiday Name" value={holForm.name} onChange={(e) => setHolForm((p) => ({ ...p, name: e.target.value }))} className="px-3 py-2 rounded-xl border border-border" />
              <Button
                size="sm"
                onClick={async () => {
                  await api.post('/api/skip/holidays', holForm);
                  setHolForm({ date: '', name: '' });
                  showToast('Holiday added!', 'success');
                  fetchAll();
                }}
              >
                Add Holiday
              </Button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-soft border border-border">
                  <span><strong>{new Date(h.date).toLocaleDateString()}</strong> — {h.name}</span>
                  <button onClick={async () => { await api.delete(`/api/skip/holidays/${h.id}`); fetchAll(); }} className="text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Admin Edit Student Academic Record Modal */}
      <Modal
        isOpen={!!editStudent}
        onClose={() => setEditStudent(null)}
        title={editStudent ? `Edit Academic Record — ${editStudent.student.name}` : ''}
        description="Every Admin edit is audit-logged, flagged 'Edited by Admin', and notifies the student."
        size="lg"
      >
        {editStudent && (
          <form onSubmit={handleAdminSaveSemester} className="space-y-4">
            <div className="flex items-center justify-between">
              <select
                value={editSemNum}
                onChange={(e) => {
                  const semNum = Number(e.target.value);
                  setEditSemNum(semNum);
                  const found = editStudent.semesters.find((s: any) => s.semesterNumber === semNum);
                  if (found) {
                    setEditSubjects(found.subjects.map((s: any) => ({ subjectCode: s.subjectCode, subjectName: s.subjectName, credits: s.credits, grade: s.grade })));
                  } else {
                    setEditSubjects([{ subjectCode: `CS${semNum}01`, subjectName: 'Subject 1', credits: 3, grade: 'A+' }]);
                  }
                }}
                className="px-3 py-2 rounded-xl border border-border text-xs font-bold bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setEditSubjects((p) => [...p, { subjectCode: 'NEW101', subjectName: 'New Subject', credits: 3, grade: 'A' }])}
              >
                Add Subject
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {editSubjects.map((sub, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <input
                    value={sub.subjectCode}
                    onChange={(e) => {
                      const next = [...editSubjects];
                      next[idx].subjectCode = e.target.value.toUpperCase();
                      setEditSubjects(next);
                    }}
                    className="col-span-3 px-2 py-1.5 rounded-lg border border-border font-mono"
                  />
                  <input
                    value={sub.subjectName}
                    onChange={(e) => {
                      const next = [...editSubjects];
                      next[idx].subjectName = e.target.value;
                      setEditSubjects(next);
                    }}
                    className="col-span-4 px-2 py-1.5 rounded-lg border border-border"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={sub.credits}
                    onChange={(e) => {
                      const next = [...editSubjects];
                      next[idx].credits = Number(e.target.value);
                      setEditSubjects(next);
                    }}
                    className="col-span-2 px-2 py-1.5 rounded-lg border border-border"
                  />
                  <select
                    value={sub.grade}
                    onChange={(e) => {
                      const next = [...editSubjects];
                      next[idx].grade = e.target.value;
                      setEditSubjects(next);
                    }}
                    className="col-span-2 px-2 py-1.5 rounded-lg border border-border bg-white"
                  >
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditSubjects((p) => p.filter((_, i) => i !== idx))}
                    className="col-span-1 text-rose-500 flex justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditStudent(null)}>Cancel</Button>
              <Button type="submit" size="sm">Save &amp; Log Audit</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
