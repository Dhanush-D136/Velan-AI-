import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Copy, Check, ShieldAlert, KeyRound } from 'lucide-react';

export interface TempCredentialInfo {
  name: string;
  identifier: string;
  tempPassword: string;
}

export const PasswordStatusBadge: React.FC<{
  user?: {
    mustChangePassword?: boolean;
    passwordSetBy?: string | null;
    tempPasswordExpiresAt?: string | null;
  } | null;
}> = ({ user }) => {
  if (!user) return <Badge variant="neutral" size="sm">—</Badge>;

  const isTemp = user.mustChangePassword;
  const isExpired =
    isTemp &&
    user.tempPasswordExpiresAt &&
    new Date(user.tempPasswordExpiresAt).getTime() < Date.now();

  if (isExpired) {
    return (
      <Badge variant="danger" size="sm">
        Expired Temp
      </Badge>
    );
  }
  if (isTemp) {
    return (
      <Badge variant="warning" size="sm">
        Temporary ({user.passwordSetBy === 'admin' ? 'Admin' : 'System'})
      </Badge>
    );
  }
  return (
    <Badge variant="success" size="sm">
      Set by User
    </Badge>
  );
};

export const downloadCredentialsCsv = (
  credentials: TempCredentialInfo[],
  filename = 'Temporary_Credentials.csv'
) => {
  if (!credentials || credentials.length === 0) return;
  const escape = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
  const lines = [
    ['Name', 'Identifier', 'Temporary Password'].map(escape).join(','),
    ...credentials.map((c) => [c.name, c.identifier, c.tempPassword].map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const TempPasswordModal: React.FC<{
  credential: TempCredentialInfo | null;
  onClose: () => void;
}> = ({ credential, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <Modal
      isOpen={!!credential}
      onClose={onClose}
      title="One-Time Temporary Password"
      description="Share this temporary password securely with the user. It will not be shown again."
    >
      {credential && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-xs text-content-secondary">Account</div>
            <div className="text-sm font-bold text-content">
              {credential.name}{' '}
              <span className="font-mono text-xs text-brand-600">({credential.identifier})</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Temporary Password
                </div>
                <div className="text-lg font-mono font-extrabold tracking-widest text-slate-900 select-all">
                  {credential.tempPassword}
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This password expires in 7 days and forces a password change immediately on login.
            </span>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button type="button" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
