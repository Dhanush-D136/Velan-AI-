import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { useToast } from '@/components/ui/Toast';
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Edit3,
  FolderOpen,
  FileText,
  Youtube,
  Link as LinkIcon,
  Info,
} from 'lucide-react';

const MATERIAL_TYPES = [
  { value: 'notes', label: 'Lecture Notes' },
  { value: 'slides', label: 'Slides / PPT' },
  { value: 'question_paper', label: 'Question Paper' },
  { value: 'video', label: 'Video Lecture' },
  { value: 'other', label: 'Other' },
];

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
  return { label: 'Open Resource', icon: <LinkIcon className="w-3.5 h-3.5 text-brand-600" /> };
}

export const MaterialsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const isFaculty = user?.role === 'FACULTY';
  const isAdmin = user?.role === 'ADMIN';
  const classId = user?.studentProfile?.classId;

  const [materials, setMaterials] = useState<any[]>([]);
  const [teachingPairs, setTeachingPairs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('notes');
  const [links, setLinks] = useState<{ title: string; url: string }[]>([{ title: 'Drive Link', url: '' }]);

  const fetchMaterials = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (subjectFilter) params.set('subjectId', subjectFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const reqs: Promise<any>[] = [api.get(`/api/materials?${params.toString()}`)];
      if (isFaculty) {
        reqs.push(api.get('/api/timetable/my-faculty'));
      }
      const [mRes, ttRes] = await Promise.all(reqs);
      setMaterials(mRes.data?.materials || []);

      if (ttRes?.data?.slots) {
        const pairMap = new Map<string, any>();
        for (const s of ttRes.data.slots) {
          const key = `${s.classId}_${s.classSubject?.subjectId}`;
          if (!pairMap.has(key) && s.class && s.classSubject?.subject) {
            pairMap.set(key, {
              classId: s.classId,
              className: s.class.name,
              subjectId: s.classSubject.subjectId,
              subjectName: s.classSubject.subject.name,
              subjectCode: s.classSubject.subject.code,
            });
          }
        }
        const pairs = Array.from(pairMap.values());
        setTeachingPairs(pairs);
        if (pairs.length > 0 && !formClassId) {
          setFormClassId(pairs[0].classId);
          setFormSubjectId(pairs[0].subjectId);
        }
      }
    } catch {
      showToast('Failed to load materials', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, subjectFilter, searchQuery, isFaculty, formClassId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useRealtimeSync(
    ['material:created', 'material:updated', 'material:deleted', 'data:updated'],
    fetchMaterials,
    { classId }
  );

  const uniqueSubjects = Array.from(
    new Map(
      materials
        .filter((m) => m.subject)
        .map((m) => [m.subject.id, { id: m.subject.id, code: m.subject.code, name: m.subject.name }])
    ).values()
  );

  const openCreateModal = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setType('notes');
    setLinks([{ title: 'Drive Link', url: '' }]);
    if (teachingPairs.length > 0) {
      setFormClassId(teachingPairs[0].classId);
      setFormSubjectId(teachingPairs[0].subjectId);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (m: any) => {
    setEditingId(m.id);
    setFormClassId(m.classId);
    setFormSubjectId(m.subjectId);
    setTitle(m.title);
    setDescription(m.description || '');
    setType(m.type || 'notes');
    setLinks(
      m.links?.length > 0
        ? m.links.map((l: any) => ({ title: l.title, url: l.url }))
        : [{ title: 'Resource Link', url: m.fileUrl || '' }]
    );
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClassId || !formSubjectId) {
      return showToast('Select a class and subject you teach', 'error');
    }
    const cleanLinks = links.filter((l) => l.url.trim());
    if (cleanLinks.length === 0) {
      return showToast('Add at least one valid http/https link', 'error');
    }
    for (const l of cleanLinks) {
      if (!/^https?:\/\//i.test(l.url.trim())) {
        return showToast('Resource URLs must start with http:// or https://', 'error');
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        classId: formClassId,
        subjectId: formSubjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        links: cleanLinks.map((l) => ({ title: l.title.trim() || 'Material Link', url: l.url.trim() })),
      };
      if (editingId) {
        await api.put(`/api/materials/${editingId}`, payload);
        showToast('Material updated!', 'success');
      } else {
        await api.post('/api/materials', payload);
        showToast('Material published to library!', 'success');
      }
      setIsModalOpen(false);
      fetchMaterials();
    } catch (err: any) {
      showToast(err?.response?.data?.error || err.message || 'Failed to save material', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (m: any) => {
    if (!window.confirm(`Delete material "${m.title}"?`)) return;
    try {
      await api.delete(`/api/materials/${m.id}`);
      showToast('Material removed', 'success');
      fetchMaterials();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  if (isLoading) {
    return <DatabaseLoader message="Loading Material Library..." subtext="Fetching notes, slides, and question papers" />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Study Material Library
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            {isFaculty
              ? 'Share notes, slides, question papers, and video lectures via Google Drive or web links.'
              : isAdmin
                ? 'Moderate and inspect study materials shared across all classes.'
                : 'Search and filter course notes, slides, and question papers for your class.'}
          </p>
        </div>

        {isFaculty && (
          <Button onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Add Material
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-xs bg-surface-soft"
            />
          </div>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border text-xs bg-surface-soft"
          >
            <option value="">All Subjects</option>
            {uniqueSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border text-xs bg-surface-soft"
          >
            <option value="">All Types</option>
            {MATERIAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {materials.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No study materials yet"
          description="Materials added by faculty will appear here in newest-first order."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map((m) => (
            <Card key={m.id} className="flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="brand" size="sm">{m.subject?.code}</Badge>
                    <Badge variant="neutral" size="sm">
                      {MATERIAL_TYPES.find((t) => t.value === m.type)?.label || m.type}
                    </Badge>
                    {m.class?.name && <Badge variant="neutral" size="sm">{m.class.name}</Badge>}
                  </div>
                  {(isAdmin || (isFaculty && m.faculty?.userId === user?.id)) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {isFaculty && (
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(m)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-base font-heading font-bold text-content mt-2">{m.title}</h3>
                {m.description && <p className="text-xs text-content-secondary mt-1">{m.description}</p>}
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  {(m.links?.length ? m.links : m.fileUrl ? [{ title: 'Open Material', url: m.fileUrl }] : []).map(
                    (l: any, idx: number) => {
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
                    }
                  )}
                </div>
                <div className="text-[11px] text-content-muted flex justify-between">
                  <span>{m.faculty?.user?.name || 'Faculty'}</span>
                  <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Faculty Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Study Material' : 'Add Study Material'}
        description="Share Google Drive, Docs, YouTube, or web links with your class"
        size="md"
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
                className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white"
              >
                {teachingPairs.length === 0 && <option value="">No assigned classes</option>}
                {teachingPairs.map((p) => (
                  <option key={`${p.classId}_${p.subjectId}`} value={`${p.classId}_${p.subjectId}`}>
                    {p.className} — {p.subjectCode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Material Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white"
              >
                {MATERIAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 2 Complete Lecture Notes"
              className="w-full px-3 py-2 rounded-xl border border-border text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topics covered..."
              className="w-full px-3 py-2 rounded-xl border border-border text-sm"
            />
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Tip: Set the Drive link to <strong>&apos;Anyone with the link can view&apos;</strong>.</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-content-secondary uppercase">Links *</label>
              <button
                type="button"
                onClick={() => setLinks((prev) => [...prev, { title: '', url: '' }])}
                className="text-xs font-bold text-brand-600"
              >
                + Add Link
              </button>
            </div>
            {links.map((l, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="Label"
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
                  required
                  placeholder="https://drive.google.com/..."
                  value={l.url}
                  onChange={(e) => {
                    const next = [...links];
                    next[idx].url = e.target.value;
                    setLinks(next);
                  }}
                  className="sm:col-span-7 px-3 py-2 rounded-xl border border-border text-xs"
                />
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                    className="sm:col-span-1 p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingId ? 'Save Changes' : 'Publish Material'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
