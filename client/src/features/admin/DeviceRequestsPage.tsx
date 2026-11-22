import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Column } from '@/components/ui/Table';
import { Smartphone, Check, X, ShieldAlert, History, AlertTriangle } from 'lucide-react';

interface DeviceRequest {
  id: string;
  userName: string;
  userRole: string;
  class: string;
  email: string;
  currentDevice: string;
  newDevice: string;
  reason: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const DeviceRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<DeviceRequest[]>([
    {
      id: 'req_1',
      userName: 'Karthik Raja S',
      userRole: 'STUDENT',
      class: 'CSE – Year 2 – A',
      email: 'karthik.s@velan.ai',
      currentDevice: 'Samsung Galaxy A52 (ID: dev_a52_old)',
      newDevice: 'OnePlus 12R (ID: dev_12r_new)',
      reason: 'Phone display damaged, switched to permanent new phone.',
      requestedAt: '15 mins ago',
      status: 'PENDING',
    },
    {
      id: 'req_2',
      userName: 'Sneha R',
      userRole: 'STUDENT',
      class: 'ECE – Year 3 – A',
      email: 'sneha.r@velan.ai',
      currentDevice: 'iPhone 13 (ID: dev_ip13_old)',
      newDevice: 'iPhone 15 Pro (ID: dev_ip15_new)',
      reason: 'Upgraded phone during festive season.',
      requestedAt: '2 hours ago',
      status: 'PENDING',
    },
  ]);

  const handleApprove = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED' as const } : r))
    );
  };

  const handleReject = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'REJECTED' as const } : r))
    );
  };

  const columns: Column<DeviceRequest>[] = [
    {
      key: 'user',
      header: 'Applicant',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.userName} size="md" />
          <div>
            <h4 className="font-bold text-content text-sm">{r.userName}</h4>
            <span className="text-[11px] text-content-secondary font-mono">{r.email}</span>
            <span className="block text-[10px] font-semibold text-brand-600">{r.class}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'devices',
      header: 'Old & New Hardware',
      render: (r) => (
        <div className="text-xs space-y-1">
          <div className="text-content-secondary">
            Old: <span className="font-medium text-content line-through">{r.currentDevice}</span>
          </div>
          <div className="text-accent-emerald font-semibold flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>New: {r.newDevice}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Stated Reason',
      render: (r) => (
        <p className="text-xs text-content-secondary max-w-xs italic">"{r.reason}"</p>
      ),
    },
    {
      key: 'requestedAt',
      header: 'Requested',
      render: (r) => <span className="text-xs text-content-muted">{r.requestedAt}</span>,
    },
    {
      key: 'actions',
      header: 'Authorization',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === 'PENDING' ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleReject(r.id)}
                className="text-accent-rose hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleApprove(r.id)}
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
              Hardware Device Change Requests
            </h1>
            <Badge variant="brand">One-Account One-Phone Security</Badge>
          </div>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Approve device transfers to prevent proxy GPS attendance marking between students.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3 text-xs text-indigo-950">
        <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Device Lock Security Enforcement</h4>
          <p className="mt-0.5 text-indigo-800">
            Approving a request binds the user's account to the new device identifier and immediately revokes all sessions on the previous device.
          </p>
        </div>
      </div>

      <Table
        columns={columns}
        data={requests}
        keyExtractor={(r) => r.id}
        emptyMessage="No pending device change requests"
      />
    </div>
  );
};
