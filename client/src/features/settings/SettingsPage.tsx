import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  Smartphone,
  ShieldCheck,
  Bell,
  Building,
  KeyRound,
  Save,
  Send,
  User,
  MessageSquarePlus,
} from 'lucide-react';

const REQUEST_TYPES = [
  { value: 'PROFILE_CORRECTION', label: 'Profile Correction' },
  { value: 'ATTENDANCE_CORRECTION', label: 'Attendance Correction' },
  { value: 'DEVICE_RESET', label: 'Device Reset' },
  { value: 'PASSWORD_HELP', label: 'Password Help' },
  { value: 'OTHER', label: 'Other' },
];

export const SettingsPage: React.FC = () => {
  const { user, deviceId } = useAuthStore();
  const { showToast } = useToast();

  // Institution settings (Admin)
  const [institutionName, setInstitutionName] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Registered devices
  const [devices, setDevices] = useState<any[]>([]);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification & UI prefs
  const [prefs, setPrefs] = useState({
    attendanceAlerts: true,
    chatAlerts: true,
    assignmentAlerts: true,
    materialAlerts: true,
    timetableAlerts: true,
    thresholdAlert: true,
    theme: 'light',
    language: 'en',
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Student requests
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [reqType, setReqType] = useState('PROFILE_CORRECTION');
  const [reqSubject, setReqSubject] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const reqs: Promise<any>[] = [
        api.get('/api/settings'),
        api.get('/api/auth/devices'),
        api.get('/api/notifications/preferences'),
      ];
      if (user?.role === 'STUDENT') {
        reqs.push(api.get('/api/requests/my'));
      }
      const [settingsRes, devRes, prefRes, myReqRes] = await Promise.all(reqs);
      setInstitutionName(settingsRes.data?.settings?.INSTITUTION_NAME || '');
      setDevices(devRes.data?.devices || []);
      if (prefRes.data?.preferences) {
        setPrefs((prev) => ({ ...prev, ...prefRes.data.preferences }));
      }
      if (myReqRes?.data?.requests) {
        setMyRequests(myReqRes.data.requests);
      }
    } catch {
      // ignore partial load errors
    }
  }, [user?.role]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useRealtimeSync(['notification:new', 'data:updated'], loadAll, { userId: user?.id });

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await api.put('/api/settings', {
        institutionName: institutionName.trim(),
      });
      showToast(res.data.message || 'Institution settings updated successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      return showToast('New password must be at least 4 characters', 'error');
    }
    setIsChangingPassword(true);
    try {
      const res = await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      showToast(res.data?.message || 'Password updated successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    try {
      await api.put('/api/notifications/preferences', prefs);
      showToast('Notification & display preferences saved', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save preferences', 'error');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqSubject.trim() || !reqMessage.trim()) {
      return showToast('Please enter a subject and message', 'error');
    }
    setIsSubmittingReq(true);
    try {
      await api.post('/api/requests', {
        type: reqType,
        subject: reqSubject.trim(),
        message: reqMessage.trim(),
      });
      showToast('Request submitted to Admin!', 'success');
      setReqSubject('');
      setReqMessage('');
      loadAll();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to submit request', 'error');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          Profile, Settings &amp; Requests
        </h1>
        <p className="text-xs sm:text-sm text-content-secondary mt-1">
          Manage your account security, registered devices, notification channels, and admin requests.
        </p>
      </div>

      {/* Account Overview */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-brand-50 text-brand-600">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-content">{user?.name}</h3>
            <p className="text-xs text-content-secondary">
              Role: <strong>{user?.role}</strong> • Email: <span className="font-mono">{user?.email}</span>
            </p>
          </div>
        </div>
        {user?.studentProfile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-surface-soft border border-border">
              <span className="text-content-muted block text-[11px]">Roll No</span>
              <span className="font-mono font-bold text-content">{user.studentProfile.rollNo}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-soft border border-border">
              <span className="text-content-muted block text-[11px]">Register No</span>
              <span className="font-mono font-bold text-content">{user.studentProfile.registerNo}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-soft border border-border">
              <span className="text-content-muted block text-[11px]">Class</span>
              <span className="font-bold text-content">{(user.studentProfile as any).class?.name || 'Assigned'}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-soft border border-border">
              <span className="text-content-muted block text-[11px]">Class Advisor</span>
              <span className="font-bold text-brand-600">{(user as any).advisor?.name || 'Unassigned'}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Institution Name Configuration (Admin only) */}
      {user?.role === 'ADMIN' && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-brand-50 text-brand-600">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-content">
                Institution Branding &amp; Identity
              </h3>
              <p className="text-xs text-content-secondary">
                Leave blank for generic portal, or specify your college/university name.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveInstitution} className="space-y-4">
            <Input
              label="Institution Name (Optional)"
              placeholder="e.g. National Institute of Technology"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" leftIcon={<Save className="w-4 h-4" />} isLoading={isSavingSettings}>
                Save Settings
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Registered Devices (Read-Only) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-accent-emerald">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-content">
                Registered Devices ({devices.length} / 2 Max for Students)
              </h3>
              <p className="text-xs text-content-secondary">
                1 Phone + 1 Computer/Laptop allowed. Contact Admin to reset a lost or replaced device.
              </p>
            </div>
          </div>
          <Badge variant="success">Active</Badge>
        </div>

        <div className="space-y-2 text-xs">
          {devices.length === 0 ? (
            <div className="p-3 rounded-2xl bg-surface-soft border border-border flex justify-between">
              <span className="text-content-secondary">Current Browser Fingerprint:</span>
              <span className="font-mono font-bold text-content">{deviceId}</span>
            </div>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="p-3 rounded-2xl bg-surface-soft border border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Smartphone className="w-4 h-4 text-brand-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="brand" size="sm">{d.deviceType || 'DEVICE'}</Badge>
                      <span className="font-semibold text-content">{d.platform || 'Web Browser'}</span>
                      {d.deviceId === deviceId && <Badge variant="success" size="sm">This Device</Badge>}
                    </div>
                    <span className="font-mono text-[11px] text-content-muted block truncate">{d.deviceId}</span>
                  </div>
                </div>
                <span className="text-[10px] text-content-muted shrink-0">
                  Last active {new Date(d.lastActive).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Change Password */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-content">Change Password</h3>
            <p className="text-xs text-content-secondary">Update your login credentials securely.</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Input
            label="Current Password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="New Password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" isLoading={isChangingPassword}>
            Update Password
          </Button>
        </form>
      </Card>

      {/* Notification & Display Preferences */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-600" />
            Notification &amp; Display Preferences
          </h3>
          <Button size="sm" onClick={handleSavePrefs} isLoading={isSavingPrefs} leftIcon={<Save className="w-3.5 h-3.5" />}>
            Save Preferences
          </Button>
        </div>

        <div className="space-y-4 divide-y divide-border">
          <div className="pt-2 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Attendance Session Alerts</h4>
              <p className="text-xs text-content-secondary">Notify when faculty starts a GPS attendance window.</p>
            </div>
            <Switch checked={prefs.attendanceAlerts} onChange={(v) => setPrefs((p) => ({ ...p, attendanceAlerts: v }))} />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Class Chat Messages</h4>
              <p className="text-xs text-content-secondary">Receive notifications for new messages and announcements.</p>
            </div>
            <Switch checked={prefs.chatAlerts} onChange={(v) => setPrefs((p) => ({ ...p, chatAlerts: v }))} />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Assignments &amp; Deadlines</h4>
              <p className="text-xs text-content-secondary">Notify when new assignments are posted or updated.</p>
            </div>
            <Switch checked={prefs.assignmentAlerts} onChange={(v) => setPrefs((p) => ({ ...p, assignmentAlerts: v }))} />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Material Library Updates</h4>
              <p className="text-xs text-content-secondary">Notify when faculty uploads notes, slides, or question papers.</p>
            </div>
            <Switch checked={prefs.materialAlerts} onChange={(v) => setPrefs((p) => ({ ...p, materialAlerts: v }))} />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Low Attendance Threshold Alert</h4>
              <p className="text-xs text-content-secondary">Alert if attendance falls below institutional threshold.</p>
            </div>
            <Switch checked={prefs.thresholdAlert} onChange={(v) => setPrefs((p) => ({ ...p, thresholdAlert: v }))} />
          </div>

          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Theme</label>
              <select
                value={prefs.theme}
                onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Language</label>
              <select
                value={prefs.language}
                onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white"
              >
                <option value="en">English</option>
                <option value="ta">Tamil</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Student Requests to Admin */}
      {user?.role === 'STUDENT' && (
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-content">Send Request to Admin</h3>
              <p className="text-xs text-content-secondary">
                Request profile/attendance corrections, device resets, or support.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Request Type</label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-xs bg-white"
                >
                  {REQUEST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Subject"
                required
                placeholder="Brief summary..."
                value={reqSubject}
                onChange={(e) => setReqSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-content-secondary uppercase block mb-1">Details / Message</label>
              <textarea
                rows={3}
                required
                value={reqMessage}
                onChange={(e) => setReqMessage(e.target.value)}
                placeholder="Explain your request clearly..."
                className="w-full px-3 py-2 rounded-xl border border-border text-xs"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" isLoading={isSubmittingReq} leftIcon={<Send className="w-4 h-4" />}>
                Submit Request
              </Button>
            </div>
          </form>

          {myRequests.length > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <h4 className="text-xs font-bold uppercase text-content-secondary">My Submitted Requests</h4>
              {myRequests.map((r) => (
                <div key={r.id} className="p-3 rounded-2xl bg-surface-soft border border-border text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-content">{r.subject}</span>
                    <Badge
                      variant={
                        r.status === 'APPROVED' || r.status === 'RESOLVED'
                          ? 'success'
                          : r.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-content-secondary">{r.message}</p>
                  {r.adminReply && (
                    <div className="mt-1.5 p-2 rounded-xl bg-white border border-border text-content">
                      <strong>Admin Reply:</strong> {r.adminReply}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
