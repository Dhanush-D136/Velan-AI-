import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  History,
  FileSpreadsheet,
  Check,
  X,
  Users,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Edit3,
} from 'lucide-react';

export const AttendanceHistoryEditorPage: React.FC = () => {
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Active session detail/editor state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [isExportingId, setIsExportingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedClassFilter !== 'ALL') params.classId = selectedClassFilter;
      if (selectedDateFilter) params.date = selectedDateFilter;

      const [sessRes, clsRes] = await Promise.all([
        api.get('/api/attendance/sessions', { params }),
        api.get('/api/academics/classes'),
      ]);
      setSessions(sessRes.data?.sessions || []);
      setClasses(clsRes.data?.classes || clsRes.data?.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load attendance sessions', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassFilter, selectedDateFilter]);

  const fetchSessionRoster = useCallback(async (sessId: string) => {
    setIsDetailLoading(true);
    try {
      const res = await api.get(`/api/attendance/session/${sessId}/live`);
      setSessionDetail(res.data.session);
      setRoster(res.data.roster || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load session roster', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useRealtimeSync(
    ['data:updated', 'attendance:marked', 'attendance:session_closed'],
    () => {
      fetchSessions();
      if (selectedSessionId) fetchSessionRoster(selectedSessionId);
    }
  );

  const handleOpenSession = (sessId: string) => {
    setSelectedSessionId(sessId);
    fetchSessionRoster(sessId);
  };

  const handleEditStudentStatus = async (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    if (!selectedSessionId) return;
    setIsSavingId(studentId);
    try {
      await api.post('/api/attendance/manual', {
        sessionId: selectedSessionId,
        records: [{ studentId, status, remarks: `Updated to ${status}` }],
      });
      showToast(`Student marked ${status} & synced across all profiles`, 'success');
      fetchSessionRoster(selectedSessionId);
      fetchSessions();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update attendance', 'error');
    } finally {
      setIsSavingId(null);
    }
  };

  const handleMarkAll = async (status: 'PRESENT' | 'ABSENT') => {
    if (!selectedSessionId || roster.length === 0) return;
    setIsSavingId('ALL');
    try {
      await api.post('/api/attendance/manual', {
        sessionId: selectedSessionId,
        records: roster.map((r) => ({ studentId: r.studentId, status, remarks: `Bulk ${status}` })),
      });
      showToast(`All students marked ${status} & synced`, 'success');
      fetchSessionRoster(selectedSessionId);
      fetchSessions();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to bulk update', 'error');
    } finally {
      setIsSavingId(null);
    }
  };

  const handleExportSessionExcel = async (sessId: string, label?: string) => {
    setIsExportingId(sessId);
    try {
      const res = await api.get(`/api/export/session/${sessId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeLabel = (label || 'Session_Attendance').replace(/[^a-zA-Z0-9_-]+/g, '_');
      link.setAttribute('download', `${safeLabel}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Session Excel downloaded!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to export session Excel', 'error');
    } finally {
      setIsExportingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <DatabaseLoader message="Loading saved attendance sessions..." subtext="Syncing class records from Supabase" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        {selectedSessionId ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetail(null);
                }}
              >
                Back to Saved Sessions
              </Button>

              <Button
                size="sm"
                isLoading={isExportingId === selectedSessionId}
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                onClick={() =>
                  handleExportSessionExcel(
                    selectedSessionId,
                    `${sessionDetail?.className || 'Class'}_${sessionDetail?.subjectCode || 'Subj'}`
                  )
                }
              >
                Export This Session (.xlsx)
              </Button>
            </div>

            {isDetailLoading || !sessionDetail ? (
              <DatabaseLoader message="Loading class student roster..." />
            ) : (
              <>
                <Card className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <Badge variant={sessionDetail.isActive ? 'success' : 'brand'} size="sm">
                        {sessionDetail.isActive ? 'LIVE SESSION' : 'SAVED SESSION'}
                      </Badge>
                      <h2 className="text-xl font-heading font-bold mt-2">
                        {sessionDetail.subjectName} ({sessionDetail.subjectCode})
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        {sessionDetail.className} • Faculty: {sessionDetail.facultyName}
                      </p>
                    </div>
                    <div className="text-left sm:text-right font-mono text-sm">
                      <div className="text-emerald-400 font-bold">
                        {sessionDetail.presentCount} Present / {sessionDetail.totalEnrolled} Total
                      </div>
                      <div className="text-rose-400 text-xs">{sessionDetail.absentCount} Absent</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={isSavingId === 'ALL'}
                      leftIcon={<Users className="w-3.5 h-3.5" />}
                      onClick={() => handleMarkAll('PRESENT')}
                    >
                      Mark All Present
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={isSavingId === 'ALL'}
                      onClick={() => handleMarkAll('ABSENT')}
                    >
                      Mark All Absent
                    </Button>
                  </div>
                </Card>

                <Card className="p-0 overflow-hidden">
                  <div className="divide-y divide-border">
                    {roster.map((st) => (
                      <div
                        key={st.studentId}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={st.name} size="sm" />
                          <div>
                            <h4 className="text-sm font-bold text-content">{st.name}</h4>
                            <span className="text-xs font-mono text-content-secondary">
                              Roll: {st.rollNo} • Reg: {st.registerNo}
                              {st.method ? ` • ${st.method}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Badge
                            variant={
                              st.status === 'PRESENT'
                                ? 'success'
                                : st.status === 'ABSENT'
                                ? 'danger'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {st.status === 'PRESENT' ? (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            ) : st.status === 'ABSENT' ? (
                              <XCircle className="w-3 h-3 mr-1" />
                            ) : null}
                            {st.status}
                          </Badge>

                          <button
                            type="button"
                            disabled={isSavingId === st.studentId}
                            onClick={() => handleEditStudentStatus(st.studentId, 'PRESENT')}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <Check className="w-3.5 h-3.5" /> Present
                          </button>
                          <button
                            type="button"
                            disabled={isSavingId === st.studentId}
                            onClick={() => handleEditStudentStatus(st.studentId, 'ABSENT')}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <X className="w-3.5 h-3.5" /> Absent
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
                  Saved Sessions &amp; Attendance Editor
                </h1>
                <p className="text-xs sm:text-sm text-content-secondary mt-1">
                  View any class period from any day, edit student Present/Absent status, and export to Excel.
                </p>
              </div>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-content-secondary uppercase mb-1">
                    Filter by Class
                  </label>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full p-2.5 rounded-2xl border border-border bg-white text-xs sm:text-sm font-semibold outline-none focus:border-brand-500"
                  >
                    <option value="ALL">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-content-secondary uppercase mb-1">
                    Filter by Date
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Calendar className="w-4 h-4 text-content-muted absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="date"
                        value={selectedDateFilter}
                        onChange={(e) => setSelectedDateFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-2xl border border-border bg-white text-xs sm:text-sm font-semibold outline-none focus:border-brand-500"
                      />
                    </div>
                    {selectedDateFilter && (
                      <Button variant="secondary" size="sm" onClick={() => setSelectedDateFilter('')}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {sessions.length === 0 ? (
              <EmptyState
                icon={History}
                title="No saved attendance sessions found"
                description="Once faculty conduct GPS or manual attendance sessions, they will appear here for viewing, editing, and Excel export."
              />
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <Card
                    key={s.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-300 transition-all"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={s.isActive ? 'success' : 'brand'} size="sm">
                          {s.isActive ? 'LIVE' : 'SAVED'}
                        </Badge>
                        <span className="text-xs font-mono text-content-secondary">
                          {new Date(s.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-content mt-1">
                        {s.className} — {s.subjectName} ({s.subjectCode})
                      </h3>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Faculty: {s.facultyName} •{' '}
                        <span className="font-semibold text-emerald-600">{s.presentCount} Present</span> •{' '}
                        <span className="font-semibold text-rose-600">{s.absentCount} Absent</span> ({s.percentage}%)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={isExportingId === s.id}
                        leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                        onClick={() => handleExportSessionExcel(s.id, `${s.className}_${s.subjectCode}`)}
                      >
                        Excel
                      </Button>
                      <Button
                        size="sm"
                        leftIcon={<Edit3 className="w-4 h-4" />}
                        onClick={() => handleOpenSession(s.id)}
                      >
                        View &amp; Edit Roster
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
