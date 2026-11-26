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
import { Award, Search, Eye, MessageSquarePlus, Trash2, Send } from 'lucide-react';

export const MentoringPortalPage: React.FC = () => {
  const { showToast } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterMentor, setFilterMentor] = useState('ALL');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'LOW_ATT' | 'ARREARS' | 'MY_MENTEES'>('ALL');

  const [detail, setDetail] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('meeting');
  const [noteFollowUp, setNoteFollowUp] = useState('');
  const [announceText, setAnnounceText] = useState('');

  const fetchRolesAndData = useCallback(async () => {
    try {
      const rRes = await api.get('/api/mentoring/roles');
      const roleList = rRes.data?.roles || [];
      setRoles(roleList);
      const activeCid = selectedClassId || roleList[0]?.classId || '';
      if (activeCid) {
        if (!selectedClassId) setSelectedClassId(activeCid);
        const mRes = await api.get(`/api/mentoring/mentees?classId=${activeCid}`);
        setData(mRes.data);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchRolesAndData();
  }, [fetchRolesAndData]);

  useRealtimeSync(['data:updated'], fetchRolesAndData);

  const openDetail = async (studentId: string) => {
    try {
      const res = await api.get(`/api/mentoring/student/${studentId}`);
      setDetail(res.data);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to load student detail', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !noteText.trim()) return;
    try {
      await api.post(`/api/mentoring/student/${detail.student.id}/notes`, {
        type: noteType,
        note: noteText.trim(),
        followUpDate: noteFollowUp || undefined,
      });
      setNoteText('');
      setNoteFollowUp('');
      showToast('Mentor note saved (private to Mentor/Advisor/Admin)', 'success');
      openDetail(detail.student.id);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save note', 'error');
    }
  };

  if (isLoading) {
    return <DatabaseLoader message="Loading Mentoring Portal..." subtext="Fetching your mentees, attendance, and CGPA summary" />;
  }

  if (roles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          icon={Award}
          title="No Mentoring Assignments Yet"
          description="Once Admin assigns you as a Class Advisor or Mentor, your mentoring dashboard and mentees will appear here."
        />
      </div>
    );
  }

  const students = (data?.students || []).filter((s: any) => {
    if (filterMentor !== 'ALL' && s.mentorId !== filterMentor) return false;
    if (filterRisk === 'LOW_ATT' && !s.belowThreshold) return false;
    if (filterRisk === 'ARREARS' && s.arrearsCount === 0) return false;
    if (filterRisk === 'MY_MENTEES' && !s.isMyMentee) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q) || s.registerNo.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Mentoring &amp; Advisee Hub
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Scope: <strong>{data?.scope === 'advisor' ? 'Class Advisor (Full Class)' : 'Mentor (My Mentees Only)'}</strong>
          </p>
        </div>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border text-xs font-bold bg-white"
        >
          {roles.map((r) => (
            <option key={r.classId} value={r.classId}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Dashboard Metrics */}
      {data?.dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-content-muted">Students in Scope</div>
            <div className="text-2xl font-extrabold text-content mt-1">{data.dashboard.menteeCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-content-muted">Avg Attendance</div>
            <div className="text-2xl font-extrabold text-brand-600 mt-1">{data.dashboard.avgAttendance}%</div>
            <div className="text-[11px] text-rose-600">{data.dashboard.belowThresholdCount} below threshold</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-content-muted">Average CGPA</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">{data.dashboard.avgCgpa.toFixed(2)}</div>
            <div className="text-[11px] text-amber-600">{data.dashboard.withArrearsCount} with arrears</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-content-muted">Open Action Items</div>
            <div className="text-2xl font-extrabold text-content mt-1">{data.dashboard.openActionItems}</div>
            <div className="text-[11px] text-content-secondary">{data.dashboard.meetingsDue} follow-ups due</div>
          </Card>
        </div>
      )}

      {/* Advisor Mentor Groups Summary */}
      {data?.scope === 'advisor' && (data?.mentorGroups || []).length > 0 && (
        <Card className="space-y-3">
          <h3 className="font-heading font-bold text-sm text-content">Mentor Groups Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {data.mentorGroups.map((g: any) => (
              <div key={g.mentorId} className="p-3 rounded-2xl bg-surface-soft border border-border">
                <div className="font-bold text-content">{g.mentorName}</div>
                <div className="text-content-secondary mt-1">
                  {g.count} mentees • Avg Att: <strong>{g.avgAttendance}%</strong> • Avg CGPA: <strong>{g.avgCgpa.toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Announcement to My Mentees */}
      <Card className="p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          placeholder="Send announcement / reminder to your mentees..."
          value={announceText}
          onChange={(e) => setAnnounceText(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl border border-border text-xs"
        />
        <Button
          size="sm"
          leftIcon={<Send className="w-3.5 h-3.5" />}
          onClick={async () => {
            if (!announceText.trim()) return;
            try {
              const res = await api.post('/api/mentoring/announce', { classId: selectedClassId, message: announceText });
              showToast(res.data.message, 'success');
              setAnnounceText('');
            } catch (err: any) {
              showToast(err?.response?.data?.error || 'Failed to send announcement', 'error');
            }
          }}
        >
          Notify My Mentees
        </Button>
      </Card>

      {/* Filters & Student List */}
      <Card className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search name, roll, reg..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-border"
            />
          </div>
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value as any)} className="px-3 py-2 rounded-xl border border-border bg-white">
            <option value="ALL">All Students ({data?.students?.length || 0})</option>
            <option value="MY_MENTEES">My Mentees Only</option>
            <option value="LOW_ATT">Below Attendance Threshold</option>
            <option value="ARREARS">Has Arrears</option>
          </select>
          {data?.scope === 'advisor' && (
            <select value={filterMentor} onChange={(e) => setFilterMentor(e.target.value)} className="px-3 py-2 rounded-xl border border-border bg-white">
              <option value="ALL">All Mentors</option>
              {(data.mentorGroups || []).map((g: any) => (
                <option key={g.mentorId} value={g.mentorId}>{g.mentorName}</option>
              ))}
            </select>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-soft text-[10px] uppercase text-content-muted border-b border-border">
              <tr>
                <th className="p-2.5">Student</th>
                <th className="p-2.5">Roll / Reg</th>
                <th className="p-2.5">Mentor</th>
                <th className="p-2.5">Attendance</th>
                <th className="p-2.5">CGPA</th>
                <th className="p-2.5">Arrears</th>
                <th className="p-2.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((s: any) => (
                <tr key={s.studentId} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold text-content">
                    {s.name} {s.isMyMentee && <Badge variant="brand" size="sm">My Mentee</Badge>}
                  </td>
                  <td className="p-2.5 font-mono">{s.rollNo} • {s.registerNo}</td>
                  <td className="p-2.5">{s.mentorName}</td>
                  <td className="p-2.5">
                    <Badge variant={s.belowThreshold ? 'danger' : 'success'} size="sm">{s.attendancePercent}%</Badge>
                  </td>
                  <td className="p-2.5 font-bold">{s.hasUploadedResults ? s.cgpa.toFixed(2) : '—'}</td>
                  <td className="p-2.5">
                    <Badge variant={s.arrearsCount > 0 ? 'danger' : 'success'} size="sm">{s.arrearsCount}</Badge>
                  </td>
                  <td className="p-2.5 text-right">
                    <button onClick={() => openDetail(s.studentId)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Full Unified Student Detail + Private Mentor Notes */}
      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.student.name} (${detail.student.registerNo})` : ''}
        description={detail ? `${detail.student.className} • Mentor: ${detail.student.mentorName} • Advisor: ${detail.student.advisorName}` : ''}
        size="lg"
      >
        {detail && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-surface-soft border border-border">
                <div className="text-content-muted">Attendance</div>
                <div className="text-base font-bold">{detail.attendance.percentage}%</div>
                <div className="text-[10px] text-content-secondary">{detail.attendance.advice}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-border">
                <div className="text-content-muted">CGPA</div>
                <div className="text-base font-bold text-brand-600">{detail.academics.cgpa.toFixed(2)}</div>
                <div className="text-[10px] text-content-secondary">{detail.academics.arrearsCount} arrears</div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-border">
                <div className="text-content-muted">Phone</div>
                <div className="font-mono font-bold">{detail.student.phone || '—'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-border">
                <div className="text-content-muted">Devices</div>
                <div className="font-bold">{detail.devicesCount} bound</div>
              </div>
            </div>

            {/* Private Mentor Notes */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-content flex items-center gap-1.5">
                  <MessageSquarePlus className="w-4 h-4 text-brand-600" />
                  Mentor Notes &amp; Meetings (Private — never visible to student)
                </h4>
              </div>
              <form onSubmit={handleAddNote} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="sm:col-span-3 px-2 py-1.5 rounded-xl border border-border bg-white">
                  <option value="meeting">Meeting</option>
                  <option value="concern">Concern</option>
                  <option value="achievement">Achievement</option>
                  <option value="counselling">Counselling</option>
                  <option value="action_item">Action Item</option>
                </select>
                <input
                  placeholder="Write note or action item..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="sm:col-span-5 px-2.5 py-1.5 rounded-xl border border-border bg-white"
                />
                <input
                  type="date"
                  value={noteFollowUp}
                  onChange={(e) => setNoteFollowUp(e.target.value)}
                  className="sm:col-span-2 px-2 py-1.5 rounded-xl border border-border bg-white"
                />
                <Button type="submit" size="sm" className="sm:col-span-2">Add Note</Button>
              </form>

              <div className="space-y-2 max-h-44 overflow-y-auto">
                {(detail.mentorNotes || []).map((n: any) => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-white border border-border flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="neutral" size="sm">{n.type}</Badge>
                      <span className="ml-2 font-semibold">{n.note}</span>
                      <div className="text-[10px] text-content-muted mt-0.5">
                        {n.mentor?.user?.name || 'Mentor'} • {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await api.delete(`/api/mentoring/notes/${n.id}`);
                        openDetail(detail.student.id);
                      }}
                      className="text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
