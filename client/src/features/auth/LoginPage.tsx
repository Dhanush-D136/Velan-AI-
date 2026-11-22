import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  Sparkles,
  Lock,
  User,
  Eye,
  EyeOff,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  GraduationCap,
  Users,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, getDeviceId } = useAuthStore();
  const toast = useToast();

  // Student is selected by default as requested in Section 5
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forced Password Change Modal (for first login with default 1234)
  const [showForcedPasswordChange, setShowForcedPasswordChange] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdChangeError, setPwdChangeError] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Forgot Password Modal
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Device Lock Modal
  const [showDeviceLockBlocked, setShowDeviceLockBlocked] = useState(false);
  const [deviceRequestReason, setDeviceRequestReason] = useState('');
  const [deviceRequestSent, setDeviceRequestSent] = useState(false);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage('');
    setIdentifier('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const deviceId = getDeviceId();
      const res = await api.post('/auth/login', {
        identifier: identifier.trim(),
        password,
        deviceId,
        deviceLabel: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
        platform: navigator.platform || 'Web',
      });

      const { user, token, mustChangePassword } = res.data;

      setUser(user, token);

      if (mustChangePassword) {
        setCurrentPwd(password);
        setShowForcedPasswordChange(true);
        return;
      }

      toast.success(`Welcome back, ${user.name}!`);

      if (user.role === UserRole.ADMIN) {
        navigate('/admin');
      } else if (user.role === UserRole.FACULTY) {
        navigate('/faculty');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      const serverError =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please verify your credentials.';

      if (serverError?.includes('DEVICE_LOCKED') || serverError?.includes('linked to another device')) {
        setShowDeviceLockBlocked(true);
      } else {
        setErrorMessage(serverError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecutePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdChangeError('');

    if (!newPwd || newPwd.trim() === '') {
      setPwdChangeError('New password cannot be empty.');
      return;
    }

    if (newPwd === '1234') {
      setPwdChangeError('Password cannot stay 1234. Please choose a new password.');
      return;
    }

    if (newPwd !== confirmPwd) {
      setPwdChangeError('New passwords do not match.');
      return;
    }

    setIsChangingPwd(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword: currentPwd,
        newPassword: newPwd,
      });

      toast.success('Password changed successfully! You may now proceed.');
      setShowForcedPasswordChange(false);

      const user = useAuthStore.getState().user;
      if (user?.role === UserRole.ADMIN) navigate('/admin');
      else if (user?.role === UserRole.FACULTY) navigate('/faculty');
      else navigate('/student');
    } catch (err: any) {
      setPwdChangeError(err.message || 'Failed to update password');
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotId.trim()) return;

    try {
      await api.post('/auth/forgot-password', { identifier: forgotId.trim() });
      setForgotSubmitted(true);
      toast.success('Password reset request submitted for admin review.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reset request');
    }
  };

  const handleDeviceChangeRequest = async () => {
    if (!deviceRequestReason.trim()) return;

    try {
      await api.post('/auth/device-request', {
        identifier: identifier.trim(),
        newDeviceId: getDeviceId(),
        reason: deviceRequestReason,
        platform: navigator.platform || 'Web',
      });
      setDeviceRequestSent(true);
      toast.success('Device change request submitted to admin.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit device change request');
    }
  };

  const getIdentifierLabel = () => {
    if (selectedRole === UserRole.STUDENT) return 'Register Number / Roll Number';
    if (selectedRole === UserRole.FACULTY) return 'Employee ID';
    return 'Admin Username';
  };

  const getIdentifierPlaceholder = () => {
    if (selectedRole === UserRole.STUDENT) return 'e.g. 710024104001 or 24CS001';
    if (selectedRole === UserRole.FACULTY) return 'e.g. FAC001';
    return 'e.g. Vel';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 animated-gradient-bg relative overflow-hidden">
      {/* Centered Clean Rounded Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/60 relative z-10"
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center text-white mx-auto shadow-lg shadow-brand-500/30 mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Velan <span className="bg-clip-text text-transparent bg-brand-gradient">AI</span>
          </h1>
          <p className="text-xs text-content-secondary mt-1 font-medium">
            Next-Gen GPS Attendance & Management Platform
          </p>
        </div>

        {/* Role Selector Tabs (Student selected by default) */}
        <div className="flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 mb-6 gap-1">
          <button
            type="button"
            onClick={() => handleRoleChange(UserRole.STUDENT)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none ${
              selectedRole === UserRole.STUDENT
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange(UserRole.FACULTY)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none ${
              selectedRole === UserRole.FACULTY
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange(UserRole.ADMIN)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none ${
              selectedRole === UserRole.ADMIN
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </button>
        </div>

        {/* Animated Form Fields */}
        <AnimatePresence mode="wait">
          <motion.form
            key={selectedRole}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleLogin}
            className="space-y-4"
          >
            <Input
              label={getIdentifierLabel()}
              type="text"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={getIdentifierPlaceholder()}
              leftIcon={<User className="w-4 h-4 text-slate-400" />}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-accent-rose text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end text-xs">
              <button
                type="button"
                onClick={() => {
                  setForgotId(identifier);
                  setForgotSubmitted(false);
                  setShowForgotPassword(true);
                }}
                className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              variant={
                selectedRole === UserRole.ADMIN
                  ? 'admin'
                  : selectedRole === UserRole.FACULTY
                  ? 'faculty'
                  : 'student'
              }
              isLoading={isLoading}
              className="w-full font-bold shadow-glass text-sm h-12"
            >
              Sign In as {selectedRole}
            </Button>
          </motion.form>
        </AnimatePresence>
      </motion.div>

      {/* FORCED PASSWORD CHANGE MODAL (For 1st Login with 1234) */}
      <Modal
        isOpen={showForcedPasswordChange}
        onClose={() => {}}
        title="Set Your New Password"
        description="First-time login requires changing your default password (1234) to secure your account."
        showCloseButton={false}
      >
        <form onSubmit={handleExecutePasswordChange} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            disabled
          />
          <Input
            label="New Password"
            type="password"
            required
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Enter any new password (cannot be 1234)"
          />
          <Input
            label="Confirm New Password"
            type="password"
            required
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Re-enter new password"
          />

          {pwdChangeError && (
            <p className="text-xs text-accent-rose font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {pwdChangeError}
            </p>
          )}

          <Button
            type="submit"
            size="md"
            variant="primary"
            isLoading={isChangingPwd}
            className="w-full font-bold"
          >
            Update Password & Proceed
          </Button>
        </form>
      </Modal>

      {/* FORGOT PASSWORD MODAL */}
      <Modal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        title="Reset Password Request"
        description="Submit your Register Number, Employee ID, or Username. When approved by admin, your password will be reset to 1234."
      >
        {!forgotSubmitted ? (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <Input
              label="Account Identifier"
              required
              value={forgotId}
              onChange={(e) => setForgotId(e.target.value)}
              placeholder="e.g. 710024104001 or FAC001 or Vel"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowForgotPassword(false)}
              >
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Submit Request
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-accent-emerald mx-auto" />
            <p className="text-xs font-semibold text-content">
              Your password reset request has been submitted to the administrator.
            </p>
            <p className="text-[11px] text-content-secondary">
              Once approved, your password will be reset to 1234 and you will be prompted to set a new password on your next login.
            </p>
            <Button size="sm" onClick={() => setShowForgotPassword(false)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      {/* DEVICE LOCK MODAL */}
      <Modal
        isOpen={showDeviceLockBlocked}
        onClose={() => setShowDeviceLockBlocked(false)}
        title="Account Bound to Another Phone"
        description="For collegiate GPS attendance security, accounts are bound to one registered phone."
      >
        {!deviceRequestSent ? (
          <div className="space-y-4">
            <p className="text-xs text-content-secondary leading-relaxed">
              To transfer your attendance device, request administrator authorization stating your reason:
            </p>
            <Input
              label="Reason for Transfer"
              required
              value={deviceRequestReason}
              onChange={(e) => setDeviceRequestReason(e.target.value)}
              placeholder="e.g. New permanent phone, damaged screen repaired"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowDeviceLockBlocked(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleDeviceChangeRequest}>
                Submit Transfer Request
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-accent-emerald mx-auto" />
            <p className="text-xs font-bold text-content">
              Device change request submitted to admin for authorization.
            </p>
            <Button size="sm" onClick={() => setShowDeviceLockBlocked(false)}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
