import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  KeyRound,
  UserCheck,
  Smartphone,
  Check,
  X,
  ShieldAlert,
  Clock,
  ClipboardList,
} from 'lucide-react';

export const AdminRequestsPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'PASSWORD' | 'PROFILE' | 'DEVICE' | 'GENERAL'>('PASSWORD');
  const [isLoading, setIsLoading] = useState(false);

  const [passwordRequests, setPasswordRequests] = useState<any[]>([]);
  const [profileEditRequests, setProfileEditRequests] = useState<any[]>([]);
  const [deviceRequests, setDeviceRequests] = useState<any[]>([]);
  const [generalRequests, setGeneralRequests] = useState<any[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const [res, genRes] = await Promise.all([
        api.get('/api/academics/requests'),
        api.get('/api/requests'),
      ]);
      setPasswordRequests(res.data.passwordRequests || []);
      setProfileEditRequests(res.data.profileEditRequests || []);
      setDeviceRequests(res.data.deviceRequests || []);
      setGeneralRequests(genRes.data.requests || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to fetch admin requests queue', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handlePasswordDecision = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await api.post(`/api/academics/requests/password/${id}/decision`, { action });
      showToast(res.data.message || `Password request ${action.toLowerCase()}d`, 'success');
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleProfileDecision = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const adminReply = action === 'REJECT' ? (window.prompt('Optional reason for rejection:') || undefined) : undefined;
      const res = await api.post(`/api/academics/requests/profile-edit/${id}/decision`, { action, adminReply });
      showToast(res.data.message || `Profile request ${action.toLowerCase()}d`, 'success');
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleDeviceDecision = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await api.post(`/api/academics/device-requests/${id}/decision`, { action });
      showToast(res.data.message || `Device request ${action.toLowerCase()}d`, 'success');
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleGeneralDecision = async (id: string, status: 'APPROVED' | 'REJECTED' | 'RESOLVED') => {
    try {
      await api.post(`/api/requests/${id}/decision`, {
        status,
        adminReply: (replyDrafts[id] || '').trim() || undefined,
      });
      showToast(`Request marked as ${status}`, 'success');
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update request', 'error');
    }
  };

  const pendingPasswordCount = passwordRequests.filter((r) => r.status === 'PENDING').length;
  const pendingProfileCount = profileEditRequests.filter((r) => r.status === 'PENDING').length;
  const pendingDeviceCount = deviceRequests.filter((r) => r.status === 'PENDING').length;
  const pendingGeneralCount = generalRequests.filter((r) => r.status === 'PENDING').length;

  const passwordColumns: Column<any>[] = [
    {
      key: 'user',
      header: 'Applicant',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.user?.name || 'User'} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{r.user?.name}</h4>
            <span className="text-[11px] text-content-secondary font-mono">
              {r.user?.studentProfile?.registerNo || r.user?.facultyProfile?.employeeId || r.identifier}
            </span>
            <span className="block text-[10px] font-semibold text-brand-600">{r.user?.role}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'identifier',
      header: 'Submitted Identifier',
      render: (r) => <span className="font-mono text-xs font-semibold text-content">{r.identifier}</span>,
    },
    {
      key: 'reason',
      header: 'Stated Reason',
      render: (r) => <span className="text-xs text-content-secondary italic">"{r.reason || 'Forgot password'}"</span>,
    },
    {
      key: 'requestedAt',
      header: 'Requested At',
      render: (r) => <span className="text-xs text-content-muted">{new Date(r.requestedAt).toLocaleString()}</span>,
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === 'PENDING' ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handlePasswordDecision(r.id, 'REJECT')}
                className="text-accent-rose hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handlePasswordDecision(r.id, 'APPROVE')}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Approve (Reset to 1234)
              </Button>
            </>
          ) : (
            <Badge variant={r.status === 'APPROVED' ? 'success' : 'danger'} size="sm">
              {r.status}
            </Badge>
          )}
        </div>
      ),
    },
  ];

  const profileColumns: Column<any>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.student?.user?.name || 'Student'} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{r.student?.user?.name}</h4>
            <span className="text-[11px] text-content-secondary font-mono">
              Reg: {r.student?.registerNo} • Roll: {r.student?.rollNo}
            </span>
            <span className="block text-[10px] font-semibold text-brand-600">{r.student?.class?.name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason for Edit Request',
      render: (r) => <span className="text-xs text-content-secondary italic">"{r.reason}"</span>,
    },
    {
      key: 'requestedAt',
      header: 'Requested At',
      render: (r) => <span className="text-xs text-content-muted">{new Date(r.requestedAt).toLocaleString()}</span>,
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === 'PENDING' ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleProfileDecision(r.id, 'REJECT')}
                className="text-accent-rose hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleProfileDecision(r.id, 'APPROVE')}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                {r.field ? 'Approve & Apply' : 'Unlock for 1 Edit'}
              </Button>
            </>
          ) : (
            <Badge variant={r.status === 'APPROVED' ? 'success' : 'danger'} size="sm">
              {r.status}
            </Badge>
          )}
        </div>
      ),
    },
  ];

  const deviceColumns: Column<any>[] = [
    {
      key: 'user',
      header: 'Applicant',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.user?.name || 'User'} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{r.user?.name}</h4>
            <span className="text-[11px] text-content-secondary font-mono">{r.user?.email}</span>
            <span className="block text-[10px] font-semibold text-brand-600">{r.user?.role}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'devices',
      header: 'Hardware Swap',
      render: (r) => (
        <div className="text-xs space-y-1">
          <div className="text-content-secondary">
            Old ID: <span className="font-mono text-content">{r.currentDeviceId}</span>
          </div>
          <div className="text-accent-emerald font-semibold flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>New ID: {r.newDeviceId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => <span className="text-xs text-content-secondary italic">"{r.reason}"</span>,
    },
    {
      key: 'requestedAt',
      header: 'Requested At',
      render: (r) => <span className="text-xs text-content-muted">{new Date(r.requestedAt).toLocaleString()}</span>,
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === 'PENDING' ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeviceDecision(r.id, 'REJECT')}
                className="text-accent-rose hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleDeviceDecision(r.id, 'APPROVE')}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Approve & Rebind
              </Button>
            </>
          ) : (
            <Badge variant={r.status === 'APPROVED' ? 'success' : 'danger'} size="sm">
              {r.status}
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
              Requests & Security Approvals
            </h1>
            <Badge variant="brand">Queue Active</Badge>
          </div>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Review and authorize password resets, locked student profile edit requests, and hardware device re-bindings.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('PASSWORD')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'PASSWORD'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-content-secondary hover:text-content'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Password Resets</span>
          {pendingPasswordCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {pendingPasswordCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'PROFILE'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-content-secondary hover:text-content'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Profile Edit Requests</span>
          {pendingProfileCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
              {pendingProfileCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('DEVICE')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'DEVICE'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-content-secondary hover:text-content'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Device Rebinds</span>
          {pendingDeviceCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {pendingDeviceCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'GENERAL'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-content-secondary hover:text-content'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Student Requests</span>
          {pendingGeneralCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800">
              {pendingGeneralCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'PASSWORD' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Password Reset Policy</h4>
              <p className="mt-0.5 text-amber-900">
                Approving a reset sets the user's password to <strong>1234</strong> and flags their account to require a mandatory password change on their next sign-in. Admin never views raw user passwords.
              </p>
            </div>
          </div>

          {passwordRequests.length === 0 && !isLoading ? (
            <EmptyState
              icon={KeyRound}
              title="No password reset requests"
              description="When a faculty or student clicks 'Forgot password?' on the login screen, their authorization ticket appears here."
            />
          ) : (
            <Table
              columns={passwordColumns}
              data={passwordRequests}
              keyExtractor={(r) => r.id}
              emptyMessage="No password reset requests found"
            />
          )}
        </div>
      )}

      {activeTab === 'PROFILE' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Profile Edit Permission Policy</h4>
              <p className="mt-0.5 text-indigo-900">
                Approving grants the student exactly <strong>one edit session</strong>. As soon as the student clicks Save, their profile is automatically locked again to maintain data integrity.
              </p>
            </div>
          </div>

          {profileEditRequests.length === 0 && !isLoading ? (
            <EmptyState
              icon={UserCheck}
              title="No profile edit requests"
              description="Locked student profiles that require corrections will submit unlock requests to this queue."
            />
          ) : (
            <Table
              columns={profileColumns}
              data={profileEditRequests}
              keyExtractor={(r) => r.id}
              emptyMessage="No profile edit requests found"
            />
          )}
        </div>
      )}

      {activeTab === 'DEVICE' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">One-Account One-Phone Security</h4>
              <p className="mt-0.5 text-emerald-900">
                Approving binds the account to the newly requested hardware fingerprint ID and revokes attendance signing authorization on the old hardware.
              </p>
            </div>
          </div>

          {deviceRequests.length === 0 && !isLoading ? (
            <EmptyState
              icon={Smartphone}
              title="No device transfer requests"
              description="Pending hardware transfer requests to prevent attendance proxying will appear here."
            />
          ) : (
            <Table
              columns={deviceColumns}
              data={deviceRequests}
              keyExtractor={(r) => r.id}
              emptyMessage="No device rebind requests found"
            />
          )}
        </div>
      )}

      {activeTab === 'GENERAL' && (
        <div className="space-y-4">
          {generalRequests.length === 0 && !isLoading ? (
            <EmptyState
              icon={ClipboardList}
              title="No student requests"
              description="General requests from students (profile, attendance, device reset, password help) appear here."
            />
          ) : (
            <div className="space-y-3">
              {generalRequests.map((r) => (
                <Card key={r.id} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="brand" size="sm">{r.type}</Badge>
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
                      <h4 className="font-bold text-sm text-content mt-1">{r.subject}</h4>
                      <p className="text-xs text-content-secondary">
                        From: <strong>{r.student?.user?.name || 'Student'}</strong> ({r.student?.registerNo || '—'})
                      </p>
                    </div>
                    <span className="text-[11px] text-content-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-content bg-surface-soft p-3 rounded-xl border border-border">
                    {r.message}
                  </p>

                  {r.status === 'PENDING' ? (
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                      <input
                        type="text"
                        placeholder="Optional reply to student..."
                        value={replyDrafts[r.id] || ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-xl border border-border text-xs"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => handleGeneralDecision(r.id, 'REJECTED')}>
                          Reject
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleGeneralDecision(r.id, 'APPROVED')}>
                          Approve
                        </Button>
                        <Button size="sm" onClick={() => handleGeneralDecision(r.id, 'RESOLVED')}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ) : r.adminReply ? (
                    <p className="text-xs text-content-secondary">
                      <strong>Admin Reply:</strong> {r.adminReply}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
