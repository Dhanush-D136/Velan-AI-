import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { X, AlertCircle, ArrowRight } from 'lucide-react';

interface PersonEditDrawerProps {
  isOpen: boolean;
  mode: 'faculty' | 'student';
  person: any | null;
  departments?: any[];
  classes?: any[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const PersonEditDrawer: React.FC<PersonEditDrawerProps> = ({
  isOpen,
  mode,
  person,
  departments = [],
  classes = [],
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [movePreview, setMovePreview] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !person) return;
    setError('');
    setMovePreview(null);
    if (mode === 'faculty') {
      setForm({
        name: person.user?.name || person.name || '',
        employeeId: person.employeeId || '',
        email: person.user?.email || person.email || '',
        phone: person.user?.phone || person.phone || '',
        departmentId: person.departmentId || person.department?.id || '',
        designation: person.designation || 'Assistant Professor',
        qualification: person.qualification || '',
        specialization: person.specialization || '',
        experienceYears: person.experienceYears ?? '',
        officeRoom: person.officeRoom || '',
        dateOfBirth: person.dateOfBirth ? String(person.dateOfBirth).split('T')[0] : '',
        address: person.address || '',
        emergencyContact: person.emergencyContact || '',
        bio: person.bio || '',
      });
    } else {
      setForm({
        name: person.user?.name || person.name || '',
        registerNo: person.registerNo || '',
        rollNo: person.rollNo || '',
        classId: person.classId || person.class?.id || '',
        email: person.user?.email || person.personalEmail || '',
        phone: person.phone || person.user?.phone || '',
        guardianName: person.guardianName || '',
        guardianPhone: person.guardianPhone || '',
        address: person.address || '',
        dob: person.dob ? String(person.dob).split('T')[0] : '',
        bloodGroup: person.bloodGroup || '',
        hostelOrDayScholar: person.hostelOrDayScholar || 'DAY_SCHOLAR',
        admissionYear: person.admissionYear ?? '',
      });
    }
  }, [isOpen, person, mode]);

  useEffect(() => {
    if (!isOpen || mode !== 'student' || !person) return;
    if (!form.classId || form.classId === person.classId) {
      setMovePreview(null);
      return;
    }
    api
      .get(`/api/academics/students/${person.id}/move-preview?targetClassId=${form.classId}`)
      .then((res) => setMovePreview(res.data))
      .catch(() => setMovePreview(null));
  }, [form.classId, isOpen, mode, person]);

  if (!isOpen || !person) return null;

  const originalLoginId = mode === 'faculty' ? person.employeeId : person.registerNo;
  const currentLoginId = mode === 'faculty' ? form.employeeId : form.registerNo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (
      currentLoginId &&
      originalLoginId &&
      currentLoginId.trim().toUpperCase() !== originalLoginId.trim().toUpperCase()
    ) {
      const ok = window.confirm(
        `Changing ${mode === 'faculty' ? 'Faculty ID' : 'Register Number'} from "${originalLoginId}" to "${currentLoginId.trim().toUpperCase()}" updates their login ID. Continue?`
      );
      if (!ok) return;
    }

    setSaving(true);
    setError('');
    try {
      const endpoint =
        mode === 'faculty'
          ? `/api/academics/faculty/${person.id}`
          : `/api/academics/students/${person.id}`;
      const res = await api.put(endpoint, form);
      onSaved(res.data?.message || 'Details updated successfully.');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Edit details">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div
        className="relative z-10 w-full sm:max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-heading font-bold text-lg text-content">
              Edit {mode === 'faculty' ? 'Faculty' : 'Student'} Details
            </h2>
            <p className="text-xs text-content-secondary">
              Changes are audited, notified, and synced live without ending active sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-content-secondary hover:bg-surface-muted"
            aria-label="Close edit drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Full Name"
            required
            className="text-base"
            value={form.name || ''}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />

          {mode === 'faculty' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Faculty ID (Login ID)"
                  required
                  className="text-base"
                  value={form.employeeId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}
                />
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Department</label>
                  <select
                    value={form.departmentId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                    className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
                  >
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Email" type="email" className="text-base" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                <Input label="Phone" type="tel" inputMode="tel" className="text-base" value={form.phone || ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Designation" className="text-base" value={form.designation || ''} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} />
                <Input label="Qualification" className="text-base" value={form.qualification || ''} onChange={(e) => setForm((p) => ({ ...p, qualification: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Specialization" className="text-base" value={form.specialization || ''} onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))} />
                <Input label="Experience (Years)" type="number" inputMode="numeric" className="text-base" value={form.experienceYears ?? ''} onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Office Room" className="text-base" value={form.officeRoom || ''} onChange={(e) => setForm((p) => ({ ...p, officeRoom: e.target.value }))} />
                <Input label="Date of Birth" type="date" className="text-base" value={form.dateOfBirth || ''} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
              </div>
              <Input label="Address" className="text-base" value={form.address || ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              <Input label="Emergency Contact" className="text-base" value={form.emergencyContact || ''} onChange={(e) => setForm((p) => ({ ...p, emergencyContact: e.target.value }))} />
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Bio</label>
                <textarea
                  rows={3}
                  value={form.bio || ''}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  className="w-full p-3.5 rounded-2xl border border-border text-base"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Register Number (Login ID)" required className="text-base" value={form.registerNo || ''} onChange={(e) => setForm((p) => ({ ...p, registerNo: e.target.value }))} />
                <Input label="Roll / VH Number" required className="text-base" value={form.rollNo || ''} onChange={(e) => setForm((p) => ({ ...p, rollNo: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Class / Section</label>
                <select
                  value={form.classId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value }))}
                  className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
                >
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {movePreview && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      {movePreview.fromClass} <ArrowRight className="w-3.5 h-3.5" /> {movePreview.toClass}
                    </div>
                    <div>New Advisor: {movePreview.newAdvisor} · Timetable slots: {movePreview.timetableSlotsCount} · Chat group updates automatically.</div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Email" type="email" className="text-base" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                <Input label="Phone" type="tel" inputMode="tel" className="text-base" value={form.phone || ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Guardian Name" className="text-base" value={form.guardianName || ''} onChange={(e) => setForm((p) => ({ ...p, guardianName: e.target.value }))} />
                <Input label="Guardian Phone" type="tel" inputMode="tel" className="text-base" value={form.guardianPhone || ''} onChange={(e) => setForm((p) => ({ ...p, guardianPhone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Date of Birth" type="date" className="text-base" value={form.dob || ''} onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))} />
                <Input label="Blood Group" className="text-base" value={form.bloodGroup || ''} onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Hostel / Day Scholar</label>
                  <select
                    value={form.hostelOrDayScholar || 'DAY_SCHOLAR'}
                    onChange={(e) => setForm((p) => ({ ...p, hostelOrDayScholar: e.target.value }))}
                    className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
                  >
                    <option value="DAY_SCHOLAR">Day Scholar</option>
                    <option value="HOSTEL">Hostel</option>
                  </select>
                </div>
                <Input label="Admission Year" type="number" inputMode="numeric" className="text-base" value={form.admissionYear ?? ''} onChange={(e) => setForm((p) => ({ ...p, admissionYear: e.target.value }))} />
              </div>
              <Input label="Address" className="text-base" value={form.address || ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </>
          )}

          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" isLoading={saving} loadingLabel="Saving...">
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
