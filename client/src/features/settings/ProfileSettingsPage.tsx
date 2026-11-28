import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { InlineLoader } from '@/components/ui/LoadingScreen';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { UserRole } from '@velan/shared';
import {
  User,
  KeyRound,
  Sliders,
  ClipboardList,
  Upload,
  Smartphone,
  CalendarCheck2,
  Edit3,
  AlertCircle,
} from 'lucide-react';

type TabKey = 'profile' | 'security' | 'preferences' | 'requests';

const STUDENT_EDITABLE_FIELDS = [
  { key: 'name', label: 'Full Name' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email Address' },
  { key: 'guardianName', label: 'Guardian Name' },
  { key: 'guardianPhone', label: 'Guardian Phone' },
  { key: 'address', label: 'Residential Address' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'hostelOrDayScholar', label: 'Hostel / Day Scholar' },
  { key: 'dob', label: 'Date of Birth' },
];

async function compressImageToDataUrl(file: File, maxDim = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ProfileSettingsPage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isFaculty = user?.role === UserRole.FACULTY;
  const isStudent = user?.role === UserRole.STUDENT;

  const [tab, setTab] = useState<TabKey>('profile');
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);

  // Faculty profile form
  const [form, setForm] = useState<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Security password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');

  // Preferences
  const [prefs, setPrefs] = useState<Record<string, any>>({
    theme: 'light',
    language: 'en',
    timeFormat: '12h',
    defaultRadius: 500,
    defaultDuration: 15,
    attendanceAlertThreshold: 75,
    notifyAttendance: true,
    notifyChat: true,
    notifyRequests: true,
    notifyAssignments: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Student change request modal
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqField, setReqField] = useState('phone');
  const [reqNewValue, setReqNewValue] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqProofUrl, setReqProofUrl] = useState('');
  const [sendingReq, setSendingReq] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/profile/me');
      const p = res.data?.profile;
      setProfileData(p);
      if (p) {
        setPrefs((prev) => ({ ...prev, ...(p.preferences || {}) }));
        if (p.facultyProfile) {
          setForm({
            name: p.name || '',
            email: p.email || '',
            phone: p.phone || '',
            photoUrl: p.facultyProfile.photoUrl || p.avatarUrl || '',
            designation: p.facultyProfile.designation || '',
            qualification: p.facultyProfile.qualification || '',
            specialization: p.facultyProfile.specialization || '',
            experienceYears: p.facultyProfile.experienceYears ?? '',
            officeRoom: p.facultyProfile.officeRoom || '',
            dateOfBirth: p.facultyProfile.dateOfBirth ? String(p.facultyProfile.dateOfBirth).split('T')[0] : '',
            address: p.facultyProfile.address || '',
            emergencyContact: p.facultyProfile.emergencyContact || '',
            bio: p.facultyProfile.bio || '',
          });
        }
      }
      if (isStudent) {
        const reqRes = await api.get('/api/profile/my-requests');
        setMyRequests(reqRes.data?.requests || []);
      }
    } catch {
      showToast('Failed to load profile details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Photo must be 2 MB or smaller.', 'error');
      return;
    }
    try {
      const compressed = await compressImageToDataUrl(file);
      setForm((prev) => ({ ...prev, photoUrl: compressed }));
    } catch {
      showToast('Could not process image.', 'error');
    }
  };

  const handleSaveFacultyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await api.put('/api/profile/me', form);
      if (user) {
        setUser({ ...user, name: form.name || user.name, email: form.email || user.email, avatarUrl: form.photoUrl || user.avatarUrl });
      }
      showToast('Profile saved and synced everywhere.', 'success');
      loadAll();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPwd) return;
    setPwdError('');
    if (!newPassword.trim()) {
      setPwdError('New password cannot be empty.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }
    setSavingPwd(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated. Other devices remain signed in.', 'success');
    } catch (err: any) {
      setPwdError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleSavePrefs = async () => {
    if (savingPrefs) return;
    setSavingPrefs(true);
    try {
      await api.put('/api/profile/preferences', { preferences: prefs });
      if (prefs.language) {
        localStorage.setItem('velan_lang', prefs.language);
      }
      showToast('Preferences saved.', 'success');
    } catch {
      showToast('Failed to save preferences.', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const getStudentFieldCurrentValue = (field: string): string => {
    if (!profileData) return '';
    const sp = profileData.studentProfile || {};
    switch (field) {
      case 'name': return profileData.name || '';
      case 'email': return profileData.email || sp.personalEmail || '';
      case 'phone': return sp.phone || profileData.phone || '';
      case 'dob': return sp.dob ? String(sp.dob).split('T')[0] : '';
      default: return sp[field] || '';
    }
  };

  const handleOpenChangeRequest = (fieldKey: string) => {
    setReqField(fieldKey);
    setReqNewValue('');
    setReqReason('');
    setReqProofUrl('');
    setReqModalOpen(true);
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingReq) return;
    setSendingReq(true);
    try {
      const res = await api.post('/api/profile/change-requests', {
        field: reqField,
        newValue: reqNewValue,
        reason: reqReason,
        proofUrl: reqProofUrl || undefined,
      });
      showToast(res.data?.message || 'Change request sent to admin.', 'success');
      setReqModalOpen(false);
      loadAll();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to submit request', 'error');
    } finally {
      setSendingReq(false);
    }
  };

  if (loading) {
    return <InlineLoader context="settings" label="Loading settings" subtext="Fetching your profile and preferences." />;
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { key: 'security', label: 'Security', icon: <KeyRound className="w-4 h-4" /> },
    { key: 'preferences', label: 'Preferences', icon: <Sliders className="w-4 h-4" /> },
    ...(isStudent ? [{ key: 'requests' as TabKey, label: 'My requests', icon: <ClipboardList className="w-4 h-4" /> }] : []),
  ];

  const sp = profileData?.studentProfile;
  const fp = profileData?.facultyProfile;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          Profile &amp; Settings
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          {isFaculty
            ? 'Update your profile, password, and teaching preferences.'
            : 'View your profile, submit change requests to the admin, and manage preferences.'}
        </p>
      </div>

      {/* Shared Tab Bar */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition ${
              tab === t.key
                ? 'bg-brand-gradient text-white shadow-sm'
                : 'bg-surface-soft text-content-secondary hover:text-content'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PROFILE */}
      {tab === 'profile' && isFaculty && (
        <form onSubmit={handleSaveFacultyProfile} className="space-y-5">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-border shrink-0">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-lg text-brand-600">
                      {(form.name || 'F')[0]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-content">{fp?.employeeId} · {fp?.department?.name}</p>
                  <p className="text-xs text-content-secondary">Faculty ID &amp; Department are managed by the admin.</p>
                </div>
              </div>
              <label className="min-h-[44px] px-4 py-2 rounded-2xl border border-border bg-surface-soft hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                Upload Photo (Max 2 MB)
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full Name" required className="text-base" value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <Input label="Email" type="email" className="text-base" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" type="tel" inputMode="tel" className="text-base" value={form.phone || ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="Designation" className="text-base" value={form.designation || ''} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} />
              <Input label="Qualification" className="text-base" value={form.qualification || ''} onChange={(e) => setForm((p) => ({ ...p, qualification: e.target.value }))} />
              <Input label="Specialization" className="text-base" value={form.specialization || ''} onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))} />
              <Input label="Experience (Years)" type="number" inputMode="numeric" className="text-base" value={form.experienceYears ?? ''} onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))} />
              <Input label="Office Room" className="text-base" value={form.officeRoom || ''} onChange={(e) => setForm((p) => ({ ...p, officeRoom: e.target.value }))} />
              <Input label="Date of Birth" type="date" className="text-base" value={form.dateOfBirth || ''} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
              <Input label="Emergency Contact" className="text-base" value={form.emergencyContact || ''} onChange={(e) => setForm((p) => ({ ...p, emergencyContact: e.target.value }))} />
            </div>
            <Input label="Address" className="text-base" value={form.address || ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            <div>
              <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Bio</label>
              <textarea
                rows={3}
                value={form.bio || ''}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                className="w-full p-3.5 rounded-2xl border border-border text-base"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" isLoading={savingProfile} loadingLabel="Saving...">
                Save Profile
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <h3 className="text-sm font-bold text-content">Teaching &amp; Advisory Summary (Read-Only)</h3>
            <p className="text-xs text-content-secondary">
              Advised Classes: {fp?.advisedClasses?.map((c: any) => c.name).join(', ') || 'None'}
            </p>
            <p className="text-xs text-content-secondary">
              Mentored Classes: {fp?.classMentors?.map((m: any) => m.class?.name).join(', ') || 'None'}
            </p>
            <p className="text-xs text-content-secondary">
              Assigned Subjects ({fp?.classSubjects?.length || 0}) · Weekly Timetable Slots: {fp?._count?.timetableSlots || 0}
            </p>
          </Card>
        </form>
      )}

      {tab === 'profile' && isStudent && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-content">{profileData?.name}</h2>
                <p className="text-xs font-mono text-content-secondary">
                  Reg: {sp?.registerNo} · Roll: {sp?.rollNo} · {sp?.class?.name}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" leftIcon={<CalendarCheck2 className="w-4 h-4" />} onClick={() => navigate('/student/attendance')}>
                  Attendance
                </Button>
                <Button size="sm" leftIcon={<Edit3 className="w-4 h-4" />} onClick={() => handleOpenChangeRequest('phone')}>
                  Request profile change
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STUDENT_EDITABLE_FIELDS.map((f) => (
                <div key={f.key} className="p-3.5 rounded-2xl border border-border bg-surface-soft flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase text-content-secondary block">{f.label}</span>
                    <span className="text-sm font-semibold text-content truncate block">
                      {getStudentFieldCurrentValue(f.key) || '—'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenChangeRequest(f.key)}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-semibold text-brand-600 hover:bg-brand-50 shrink-0"
                  >
                    Request a change
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border text-xs text-content-secondary space-y-1">
              <div>Class Advisor: <strong className="text-content">{sp?.class?.advisor?.user?.name || 'Unassigned'}</strong></div>
              <div>Mentors: <strong className="text-content">{sp?.class?.mentors?.map((m: any) => m.faculty?.user?.name).filter(Boolean).join(', ') || 'None'}</strong></div>
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <h3 className="text-sm font-bold text-content flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-brand-600" />
              Registered Devices (Read-Only)
            </h3>
            {(profileData?.devices || []).length === 0 ? (
              <p className="text-xs text-content-muted">No devices bound.</p>
            ) : (
              <div className="space-y-2">
                {profileData.devices.map((d: any) => (
                  <div key={d.id} className="p-3 rounded-xl border border-border bg-surface-soft text-xs flex items-center justify-between">
                    <span className="font-semibold text-content">{d.label || d.platform || d.deviceType}</span>
                    <Badge variant="neutral" size="sm">{d.deviceType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: SECURITY */}
      {tab === 'security' && (
        <Card className="p-5 sm:p-6 max-w-lg">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h2 className="text-base font-bold text-content">Change Password</h2>
            <p className="text-xs text-content-secondary">
              Any password is allowed. Changing it will keep your other signed-in devices active.
            </p>
            <Input label="Current Password" type="password" required className="text-base" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <Input label="New Password" type="password" required className="text-base" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Input label="Confirm New Password" type="password" required className="text-base" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {pwdError && (
              <p className="text-xs text-accent-rose font-medium flex items-center gap-1.5" role="alert">
                <AlertCircle className="w-4 h-4" /> {pwdError}
              </p>
            )}
            <Button type="submit" isLoading={savingPwd} loadingLabel="Saving...">
              Update Password
            </Button>
          </form>
        </Card>
      )}

      {/* TAB 3: PREFERENCES */}
      {tab === 'preferences' && (
        <Card className="p-5 sm:p-6 space-y-5 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Theme</label>
              <select
                value={prefs.theme || 'light'}
                onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value }))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Language</label>
              <select
                value={prefs.language || 'en'}
                onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>
          </div>

          {isFaculty && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Default Radius (m)" type="number" inputMode="numeric" className="text-base" value={prefs.defaultRadius ?? 500} onChange={(e) => setPrefs((p) => ({ ...p, defaultRadius: Number(e.target.value) }))} />
              <Input label="Default Duration (min)" type="number" inputMode="numeric" className="text-base" value={prefs.defaultDuration ?? 15} onChange={(e) => setPrefs((p) => ({ ...p, defaultDuration: Number(e.target.value) }))} />
              <div>
                <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Time Format</label>
                <select
                  value={prefs.timeFormat || '12h'}
                  onChange={(e) => setPrefs((p) => ({ ...p, timeFormat: e.target.value }))}
                  className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
            </div>
          )}

          {isStudent && (
            <Input
              label="Attendance Alert Threshold (%)"
              type="number"
              inputMode="numeric"
              className="text-base max-w-xs"
              value={prefs.attendanceAlertThreshold ?? 75}
              onChange={(e) => setPrefs((p) => ({ ...p, attendanceAlertThreshold: Number(e.target.value) }))}
            />
          )}

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-content">Attendance notifications</span>
              <Switch checked={!!prefs.notifyAttendance} onChange={(v) => setPrefs((p) => ({ ...p, notifyAttendance: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-content">Class chat messages</span>
              <Switch checked={!!prefs.notifyChat} onChange={(v) => setPrefs((p) => ({ ...p, notifyChat: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-content">Assignments &amp; updates</span>
              <Switch checked={!!prefs.notifyAssignments} onChange={(v) => setPrefs((p) => ({ ...p, notifyAssignments: v }))} />
            </div>
          </div>

          <Button onClick={handleSavePrefs} isLoading={savingPrefs} loadingLabel="Saving...">
            Save Preferences
          </Button>
        </Card>
      )}

      {/* TAB 4: MY REQUESTS (STUDENT) */}
      {tab === 'requests' && isStudent && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-content">My Profile Change Requests</h2>
            <Button size="sm" onClick={() => handleOpenChangeRequest('phone')}>
              New Request
            </Button>
          </div>
          {myRequests.length === 0 ? (
            <p className="text-xs text-content-muted py-4">No profile change requests submitted yet.</p>
          ) : (
            <div className="space-y-2.5">
              {myRequests.map((r) => (
                <div key={r.id} className="p-3.5 rounded-2xl border border-border bg-surface-soft space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-content">{r.field || 'Profile Edit'}</span>
                    <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                      {r.status}
                    </Badge>
                  </div>
                  {r.newValue && (
                    <p className="text-xs text-content-secondary">
                      {r.oldValue || '—'} → <strong className="text-content">{r.newValue}</strong>
                    </p>
                  )}
                  <p className="text-xs text-content-secondary italic">&ldquo;{r.reason}&rdquo;</p>
                  {r.adminReply && (
                    <p className="text-xs text-brand-700 font-medium">Admin reply: {r.adminReply}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Student Profile Change Request Modal */}
      <Modal
        isOpen={reqModalOpen}
        onClose={() => !sendingReq && setReqModalOpen(false)}
        title="Request Profile Change"
        description="Your request goes to the admin. Once approved, your profile updates automatically."
      >
        <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-content-secondary uppercase mb-1.5">Field</label>
            <select
              value={reqField}
              onChange={(e) => setReqField(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-2xl border border-border bg-white text-base"
            >
              {STUDENT_EDITABLE_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          <Input label="Current Value" disabled className="text-base" value={getStudentFieldCurrentValue(reqField) || '—'} />
          <Input label="Requested New Value" required className="text-base" value={reqNewValue} onChange={(e) => setReqNewValue(e.target.value)} placeholder="Enter new value" />
          <Input label="Reason" required className="text-base" value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="Why is this change needed?" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setReqModalOpen(false)} disabled={sendingReq}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={sendingReq} loadingLabel="Sending your request...">
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
