import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { useToast } from '@/components/ui/Toast';
import {
  FileText,
  Plus,
  ExternalLink,
  Trash2,
  Edit3,
  Lock,
  Unlock,
  Clock,
  Youtube,
  FolderOpen,
  Link as LinkIcon,
  Info,
} from 'lucide-react';

function getLinkMeta(url: string) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('drive.google.com')) {
    return { label: 'Google Drive', icon: <FolderOpen className="w-3.5 h-3.5 text-emerald-600" /> };
  }
  if (lower.includes('docs.google.com')) {
    return { label: 'Google Docs', icon: <FileText className="w-3.5 h-3.5 text-blue-600" /> };
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { label: 'YouTube', icon: <Youtube className="w-3.5 h-3.5 text-rose-600" /> };
  }
  return { label: 'External Link', icon: <LinkIcon className="w-3.5 h-3.5 text-brand-600" /> };
}

function getCountdownLabel(dueDate: string, submissionDate?: string, isClosed?: boolean) {
  if (isClosed) return { text: 'Closed', variant: 'neutral' as const, group: 'past' as const };
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const cutoff = submissionDate ? new Date(submissionDate).getTime() : due;
  if (now > cutoff) return { text: 'Overdue / Cutoff Passed', variant: 'danger' as const, group: 'past' as const };
  if (now > due) return { text: 'Past Due (Grace Window)', variant: 'warning' as const, group: 'active' as const };
  const diffHours = Math.ceil((due - now) / (1000 * 60 * 60));
  if (diffHours <= 24) return { text: `Due in ${diffHours}h`, variant: 'warning' as const, group: 'active' as const };
  const diffDays = Math.ceil(diffHours / 24);
  return { text: `Due in ${diffDays}d`, variant: 'success' as const, group: 'active' as const };
}

export const AssignmentsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const isFaculty = user?.role === 'FACULTY';
  const isAdmin = user?.role === 'ADMIN';
  const classId = user?.studentProfile?.classId;

  const [assignments, setAssignments] = useState<any[]>([]);
  const [teachingPairs, setTeachingPairs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'PAST'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
  const [submissionDate, setSubmissionDate] = useState(() => new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 16));
  const [links, setLinks] = useState<{ title: string; url: string }[]>([]);
  const [formError, setFormError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const reqs: Promise<any>[] = [api.get('/api/assignments')];
      if (isFaculty) {
        reqs.push(api.get('/api/assignments/teaching-pairs'));
      }
      const [aRes, pairsRes] = await Promise.all(reqs);
      setAssignments(aRes.data?.assignments || []);
      if (pairsRes?.data?.pairs) {
        const pairs = pairsRes.data.pairs;
        setTeachingPairs(pairs);
        if (pairs.length > 0 && !formClassId) {
          setFormClassId(pairs[0].classId);
          setFormSubjectId(pairs[0].subjectId);
        }
      }
    } catch {
      showToast('Failed to load assignments', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isFaculty, formClassId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeSync(
    ['assignment:created', 'assignment:updated', 'assignment:deleted', 'data:updated'],
    fetchData,
    { classId }
  );

  const openCreateModal = () => {
    setEditingId(null);
    setFormError('');
    setTitle('');
    setDescription('');
    setStartDate(new Date().toISOString().slice(0, 16));
    setDueDate(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
    setSubmissionDate(new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 16));
    setLinks([]);
    if (teachingPairs.length > 0) {
      setFormClassId(teachingPairs[0].classId);
      setFormSubjectId(teachingPairs[0].subjectId);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (a: any) => {
    setEditingId(a.id);
    setFormError('');
    setFormClassId(a.classId || a.classSubject?.classId);
    setFormSubjectId(a.subjectId || a.classSubject?.subjectId);
    setTitle(a.title);
    setDescription(a.description || '');
    setStartDate(new Date(a.startDate || a.createdAt).toISOString().slice(0, 16));
    setDueDate(new Date(a.dueDate).toISOString().slice(0, 16));
    setSubmissionDate(new Date(a.submissionDate || a.dueDate).toISOString().slice(0, 16));
    setLinks(
      a.links?.length > 0
        ? a.links.map((l: any) => ({ title: l.title, url: l.url }))
        : []
    );
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formClassId || !formSubjectId) {
      const msg = 'Select a class and subject you teach';
      setFormError(msg);
      return showToast(msg, 'error');
    }
    if (title.trim().length < 2) {
      const msg = 'Assignment title must be at least 2 characters';
      setFormError(msg);
      return showToast(msg, 'error');
    }
    const sTime = new Date(startDate).getTime();
    const dTime = new Date(dueDate).getTime();
    const cTime = new Date(submissionDate).getTime();
    if (sTime > dTime || dTime > cTime) {
      const msg = 'Dates must satisfy: Start Date ≤ Due Date ≤ Submission Cutoff';
      setFormError(msg);
      return showToast(msg, 'error');
    }
    const cleanLinks = links.filter((l) => l.url.trim());
    for (const l of cleanLinks) {
      if (!/^https?:\/\//i.test(l.url.trim())) {
        const msg = 'Resource URLs must start with http:// or https://';
        setFormError(msg);
        return showToast(msg, 'error');
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        classId: formClassId,
        subjectId: formSubjectId,
        title: title.trim(),
        description: description.trim(),
        startDate: new Date(startDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        submissionDate: new Date(submissionDate).toISOString(),
        links: cleanLinks.map((l) => ({ title: l.title.trim() || 'Resource Link', url: l.url.trim() })),
      };
      if (editingId) {
        await api.put(`/api/assignments/${editingId}`, payload);
        showToast('Assignment updated!', 'success');
      } else {
        await api.post('/api/assignments', payload);
        showToast('Assignment published to students!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Failed to save assignment';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleClose = async (a: any) => {
    try {
      await api.put(`/api/assignments/${a.id}`, { isClosed: !a.isClosed });
      showToast(a.isClosed ? 'Assignment reopened' : 'Assignment closed', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (a: any) => {
    if (!window.confirm(`Delete assignment "${a.title}"?`)) return;
    try {
      await api.delete(`/api/assignments/${a.id}`);
      showToast('Assignment deleted', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const now = Date.now();
  const filtered = assignments.filter((a) => {
    if (filterTab === 'ALL') return true;
    const start = new Date(a.startDate || a.createdAt).getTime();
    const meta = getCountdownLabel(a.dueDate, a.submissionDate, a.isClosed);
    if (filterTab === 'UPCOMING') return start > now && !a.isClosed;
    if (filterTab === 'PAST') return meta.group === 'past';
    return start <= now && meta.group === 'active';
  });

  if (isLoading) {
    return <InlineLoader label="Loading assignments..." subtext="Syncing tasks and submission deadlines" />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            {isFaculty ? 'Assignments Manager' : isAdmin ? 'All Assignments (Read-Only)' : 'My Assignments'}
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            {isFaculty
              ? 'Publish coursework with Google Drive / resource links and track deadlines.'
              : 'View upcoming, active, and past assignments with resource links.'}
          </p>
        </div>

        {isFaculty && (
          <Button onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Create Assignment
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'ACTIVE', 'UPCOMING', 'PAST'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filterTab === tab
                ? 'bg-brand-gradient text-white shadow-sm'
                : 'bg-white border border-border text-content-secondary hover:bg-surface-soft'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No assignments found"
          description={isFaculty ? 'Create an assignment for your assigned classes.' : 'No assignments match the selected filter.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((a) => {
            const start = new Date(a.startDate || a.createdAt).getTime();
            const isUpcoming = start > now && !a.isClosed;
            const statusMeta = isUpcoming
              ? { text: 'Upcoming', variant: 'brand' as const }
              : getCountdownLabel(a.dueDate, a.submissionDate, a.isClosed);

            return (
              <Card key={a.id} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand" size="sm">
                        {a.subject?.code} • {a.subject?.name}
                      </Badge>
                      {a.class?.name && <Badge variant="neutral" size="sm">{a.class.name}</Badge>}
                      <Badge variant={statusMeta.variant} size="sm">{statusMeta.text}</Badge>
                    </div>
                    <h3 className="text-lg font-heading font-bold text-content mt-2">{a.title}</h3>
                    {a.description && <p className="text-xs text-content-secondary mt-1 whitespace-pre-line">{a.description}</p>}
                  </div>

                  {isFaculty && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(a)} leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleClose(a)}
                        leftIcon={a.isClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      >
                        {a.isClosed ? 'Reopen' : 'Close'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDelete(a)}
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-content-secondary border-t border-border pt-2.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-brand-500" />
                    Start: {new Date(a.startDate || a.createdAt).toLocaleString()}
                  </span>
                  <span>Due: <strong>{new Date(a.dueDate).toLocaleString()}</strong></span>
                  {a.submissionDate && (
                    <span>Cutoff: <strong>{new Date(a.submissionDate).toLocaleString()}</strong></span>
                  )}
                  {a.faculty?.user?.name && <span>By: {a.faculty.user.name}</span>}
                </div>

                {a.links?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {a.links.map((l: any, idx: number) => {
                      const meta = getLinkMeta(l.url);
                      return (
                        <a
                          key={l.id || idx}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft border border-border text-xs font-semibold text-content hover:border-brand-400 hover:bg-brand-50/40 transition"
                        >
                          {meta.icon}
                          <span>{l.title || meta.label}</span>
                          <ExternalLink className="w-3 h-3 text-content-muted" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Faculty Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Assignment' : 'Create Assignment'}
        description="Assign coursework with dates and Google Drive / web links"
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Class &amp; Subject *</label>
              <select
                value={`${formClassId}_${formSubjectId}`}
                onChange={(e) => {
                  const [cId, sId] = e.target.value.split('_');
                  setFormClassId(cId);
                  setFormSubjectId(sId);
                }}
                disabled={!!editingId}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-white"
              >
                {teachingPairs.length === 0 && <option value="">No assigned classes in timetable</option>}
                {teachingPairs.map((p) => (
                  <option key={`${p.classId}_${p.subjectId}`} value={`${p.classId}_${p.subjectId}`}>
                    {p.className} — {p.subjectCode} ({p.subjectName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Assignment Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unit 3 Neural Networks Lab"
                className="w-full px-3 py-2 rounded-xl border border-border text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Description / Instructions</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write instructions, deliverables, or rubric..."
              className="w-full px-3 py-2 rounded-xl border border-border text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Start Date *</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Due Date *</label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Submission Cutoff *</label>
              <input
                type="datetime-local"
                required
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Tip: Set the Google Drive link sharing to <strong>&apos;Anyone with the link can view&apos;</strong>.</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-secondary uppercase">Resource Links (Optional, http/https)</label>
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, { title: '', url: '' }])}
                className="text-xs font-bold text-brand-600 hover:text-brand-700"
              >
                + Add Link
              </button>
            </div>
            {links.map((l, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="Link title (e.g. Problem PDF)"
                  value={l.title}
                  onChange={(e) => {
                    const next = [...links];
                    next[idx].title = e.target.value;
                    setLinks(next);
                  }}
                  className="sm:col-span-4 px-3 py-2 rounded-xl border border-border text-xs"
                />
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={l.url}
                  onChange={(e) => {
                    const next = [...links];
                    next[idx].url = e.target.value;
                    setLinks(next);
                  }}
                  className="sm:col-span-7 px-3 py-2 rounded-xl border border-border text-xs"
                />
                <button
                  type="button"
                  onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingId ? 'Save Changes' : 'Publish Assignment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
