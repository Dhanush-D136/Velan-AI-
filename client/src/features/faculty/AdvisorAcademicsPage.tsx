import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { Award, Search, Download, FileText, Eye } from 'lucide-react';

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

export const AdvisorAcademicsPage: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [advisedClasses, setAdvisedClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [notAdvisor, setNotAdvisor] = useState(false);

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'ARREARS' | 'NOT_UPLOADED' | 'BELOW_7'>('ALL');
  const [sortBy, setSortBy] = useState<'rollNo' | 'cgpa_desc' | 'arrears_desc'>('rollNo');
  const [detailData, setDetailData] = useState<any>(null);

  const fetchAdvisees = useCallback(async () => {
    try {
      const res = await api.get(`/api/academics-records/advisees?classId=${selectedClassId}`);
      setStudents(res.data?.students || []);
      setAdvisedClasses(res.data?.advisedClasses || []);
      setNotAdvisor(false);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setNotAdvisor(true);
      } else {
        showToast('Failed to load advisee academics', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast, selectedClassId]);

  useEffect(() => {
    fetchAdvisees();
  }, [fetchAdvisees]);

  useRealtimeSync(['data:updated'], fetchAdvisees);

  const openStudentDetail = async (studentId: string) => {
    try {
      const res = await api.get(`/api/academics-records/student/${studentId}`);
      setDetailData(res.data);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to load student details', 'error');
    }
  };

  if (isLoading) {
    return <DatabaseLoader message="Loading Advisee Academics..." subtext="Fetching CGPA, credits, and arrears for your advised class" />;
  }

  if (notAdvisor) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          icon={Award}
          title="Class Advisor Access Only"
          description="You are not currently assigned as a Class Advisor. Once Admin assigns you as an advisor in Classes & Subjects, your advisees will appear here."
        />
      </div>
    );
  }

  const filtered = students
    .filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.rollNo.toLowerCase().includes(q) && !s.registerNo.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterMode === 'ARREARS') return s.arrearsCount > 0;
      if (filterMode === 'NOT_UPLOADED') return !s.hasUploaded;
      if (filterMode === 'BELOW_7') return s.hasUploaded && s.cgpa < 7;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'cgpa_desc') return b.cgpa - a.cgpa;
      if (sortBy === 'arrears_desc') return b.arrearsCount - a.arrearsCount;
      return a.rollNo.localeCompare(b.rollNo);
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            My Advisees / Academics
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {advisedClasses.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(selectedClassId === c.id ? 'ALL' : c.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                  selectedClassId === c.id
                    ? 'bg-brand-gradient text-white border-transparent'
                    : 'bg-white border-border text-content hover:bg-surface-soft'
                }`}
              >
                <span>{c.name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase ${selectedClassId === c.id ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'}`}>
                  {c.role === 'advisor' ? 'Advisor' : 'Mentor'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => downloadProtectedFile('/api/academics-records/export/excel', 'Advisees_Academics.xlsx')}
          >
            Export Excel
          </Button>
          <Button
            size="sm"
            leftIcon={<FileText className="w-4 h-4" />}
            onClick={() => downloadProtectedFile('/api/academics-records/export/pdf', 'Advisees_Summary.pdf')}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student, roll or reg no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-xs bg-surface-soft"
            />
          </div>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-border text-xs bg-surface-soft"
          >
            <option value="ALL">All Advisees ({students.length})</option>
            <option value="ARREARS">Has Arrears</option>
            <option value="NOT_UPLOADED">Not Uploaded Yet</option>
            <option value="BELOW_7">CGPA Below 7.0</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-border text-xs bg-surface-soft"
          >
            <option value="rollNo">Sort by Roll No</option>
            <option value="cgpa_desc">Sort by CGPA (High to Low)</option>
            <option value="arrears_desc">Sort by Arrears Count</option>
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-soft text-content-secondary uppercase text-[10px] border-b border-border">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">Roll / Reg No</th>
                <th className="p-3">Latest GPA</th>
                <th className="p-3">CGPA</th>
                <th className="p-3">Attendance</th>
                <th className="p-3">Credits</th>
                <th className="p-3">Arrears</th>
                <th className="p-3">Last Updated</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => (
                <tr key={s.studentId} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-content">{s.name}</td>
                  <td className="p-3 font-mono text-content-secondary">
                    {s.rollNo} • {s.registerNo}
                  </td>
                  <td className="p-3 font-semibold">{s.latestGpa !== null ? s.latestGpa.toFixed(2) : '—'}</td>
                  <td className="p-3">
                    <Badge variant={s.hasUploaded ? (s.cgpa >= 7 ? 'success' : 'warning') : 'neutral'} size="sm">
                      {s.hasUploaded ? s.cgpa.toFixed(2) : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {s.attendancePercent !== null && s.attendancePercent !== undefined ? (
                      <Badge variant={s.attendancePercent < 75 ? 'danger' : 'success'} size="sm">
                        {s.attendancePercent}%
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">{s.totalCredits}</td>
                  <td className="p-3">
                    <Badge variant={s.arrearsCount > 0 ? 'danger' : 'success'} size="sm">
                      {s.arrearsCount}
                    </Badge>
                  </td>
                  <td className="p-3 text-content-muted">
                    {s.lastUpdated ? new Date(s.lastUpdated).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openStudentDetail(s.studentId)}
                      className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50"
                      title="View Semesters"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={!!detailData}
        onClose={() => setDetailData(null)}
        title={detailData ? `${detailData.student.name} — Academic Record` : ''}
        description={detailData ? `${detailData.student.registerNo} • CGPA: ${detailData.cgpa.toFixed(2)}` : ''}
        size="lg"
      >
        {detailData && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {detailData.semesters.length === 0 ? (
              <p className="text-xs text-content-secondary py-6 text-center">No semester results uploaded yet.</p>
            ) : (
              detailData.semesters.map((sem: any) => (
                <div key={sem.id} className="p-3 rounded-2xl bg-surface-soft border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Semester {sem.semesterNumber}</span>
                    <span>GPA: {sem.gpa.toFixed(2)} ({sem.totalCredits} credits)</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {sem.subjects.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between py-1 border-t border-border/60">
                        <span>
                          <strong className="font-mono">{sub.subjectCode}</strong> — {sub.subjectName}
                        </span>
                        <span className="font-bold">
                          {sub.credits} cr • {sub.grade} ({sub.result})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
