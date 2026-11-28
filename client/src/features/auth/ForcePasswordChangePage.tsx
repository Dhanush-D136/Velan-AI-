import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { UserRole } from '@velan/shared';
import { Eye, EyeOff, CheckCircle2, XCircle, LogOut, ShieldAlert } from 'lucide-react';

export const ForcePasswordChangePage: React.FC = () => {
  const { user, setUser, logout } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isNonEmpty = newPassword.trim().length > 0;
  const notDefault = newPassword.trim() !== '1234';
  const matchesConfirm = isNonEmpty && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isNonEmpty) {
      setError('Password cannot be empty.');
      return;
    }
    if (!notDefault) {
      setError('Please choose a new password. It cannot be 1234.');
      return;
    }
    if (!matchesConfirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post('/api/auth/change-password', { newPassword });
      const nextUser = res.data?.user || (user ? { ...user, mustChangePassword: false } : null);
      setUser(nextUser, res.data?.token);
      showToast('Password updated! Welcome to Velan AI.', 'success');

      const role = nextUser?.role;
      const savedRoute = localStorage.getItem('velan_last_route') || (nextUser as any)?.lastRoute;
      const defaultPath = role === UserRole.ADMIN ? '/admin' : role === UserRole.FACULTY ? '/faculty' : '/student';
      const isAllowed =
        savedRoute &&
        ((role === UserRole.ADMIN && (savedRoute.startsWith('/admin') || savedRoute === '/chat' || savedRoute === '/settings')) ||
          (role === UserRole.FACULTY && (savedRoute.startsWith('/faculty') || savedRoute === '/chat' || savedRoute === '/settings')) ||
          (role === UserRole.STUDENT && (savedRoute.startsWith('/student') || savedRoute === '/chat' || savedRoute === '/settings')));
      navigate(isAllowed ? savedRoute : defaultPath, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not update password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-border rounded-3xl shadow-glass p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <BrandLogo size="lg" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            Security Verification Required
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-content">Set your new password</h1>
          <p className="text-xs text-content-secondary">
            For your security, please choose a new password before you continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-content-secondary uppercase mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter any new password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-2xl border border-border text-sm outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted"
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-content-secondary uppercase mb-1">
              Confirm New Password
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-border text-sm outline-none focus:border-brand-500"
            />
          </div>

          {/* Rules Checklist */}
          <div className="p-3 rounded-2xl bg-surface-soft border border-border space-y-1.5 text-xs">
            {[
              { ok: isNonEmpty, label: 'Password is not empty (any length/characters allowed)' },
              { ok: notDefault, label: 'Must not be 1234' },
              { ok: matchesConfirm, label: 'Passwords match' },
            ].map((r) => (
              <div key={r.label} className={`flex items-center gap-2 ${r.ok ? 'text-emerald-700 font-semibold' : 'text-content-muted'}`}>
                {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{r.label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={isSaving} loadingLabel="Saving your new password">
            Save New Password &amp; Continue
          </Button>
        </form>

        <div className="pt-2 border-t border-border flex justify-center">
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-secondary hover:text-rose-600"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out ({user?.name})
          </button>
        </div>
      </div>
    </div>
  );
};
