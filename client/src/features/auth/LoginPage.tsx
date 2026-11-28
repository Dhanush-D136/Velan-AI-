import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@velan/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { api } from '@/lib/api';
import { LOGIN_KURAL_CONFIG } from './kuralLoginConfig';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Users,
  Shield,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const ROLE_OPTIONS = [
  { role: UserRole.STUDENT, label: 'Student', icon: GraduationCap },
  { role: UserRole.FACULTY, label: 'Faculty', icon: Users },
  { role: UserRole.ADMIN, label: 'Admin', icon: Shield },
] as const;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, getDeviceId } = useAuthStore();
  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();

  // Student is selected by default
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(() => {
    if (typeof window === 'undefined') return '';
    const msg = sessionStorage.getItem('velan_forced_logout_msg') || '';
    if (msg) sessionStorage.removeItem('velan_forced_logout_msg');
    return msg;
  });

  // Mobile keyboard & short-viewport detection
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isShortScreen, setIsShortScreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const baseHeight = window.innerHeight;
    const checkViewport = () => {
      const vvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setIsShortScreen(window.innerHeight < 520);
      if (window.innerWidth < 1024 && baseHeight > 520) {
        setIsKeyboardOpen(vvHeight < baseHeight * 0.76);
      } else {
        setIsKeyboardOpen(false);
      }
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.visualViewport?.addEventListener('resize', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.visualViewport?.removeEventListener('resize', checkViewport);
    };
  }, []);

  // Forced Password Change Modal (kept for compatibility)
  const [showForcedPasswordChange, setShowForcedPasswordChange] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdChangeError, setPwdChangeError] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Forgot Password Modal
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotVerify, setForgotVerify] = useState('');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Device Lock Modal
  const [showDeviceLockBlocked, setShowDeviceLockBlocked] = useState(false);
  const [deviceRequestReason, setDeviceRequestReason] = useState('');
  const [deviceRequestSent, setDeviceRequestSent] = useState(false);
  const [deviceResetId, setDeviceResetId] = useState('');
  const [deviceLimitBanner, setDeviceLimitBanner] = useState('');
  const [isDeviceLimitError, setIsDeviceLimitError] = useState(false);

  const line1Words = useMemo(() => LOGIN_KURAL_CONFIG.line1.split(' '), []);
  const line2Words = useMemo(() => LOGIN_KURAL_CONFIG.line2.split(' '), []);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage('');
    setIsDeviceLimitError(false);
    setIdentifier('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setIsLoading(true);
    setErrorMessage('');
    setIsDeviceLimitError(false);

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
        navigate('/set-password', { replace: true });
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
      const serverCode = err.response?.data?.code;
      const serverError =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please verify your credentials.';

      if (serverCode === 'DEVICE_LIMIT_REACHED' || serverCode === 'DEVICE_LOCKED') {
        setDeviceResetId(identifier.trim());
        setDeviceLimitBanner(serverError);
        setErrorMessage(serverError);
        setIsDeviceLimitError(true);
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

    if (newPwd !== confirmPwd) {
      setPwdChangeError('New password and confirmation do not match.');
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
      await api.post('/auth/forgot-password', {
        identifier: forgotId.trim(),
        verifyValue: forgotVerify.trim() || undefined,
        reason: forgotReason.trim() || undefined,
      });
      setForgotSubmitted(true);
      toast.success('Request received. If an account matches, an administrator will review it.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to submit reset request');
    }
  };

  const handleDeviceChangeRequest = async () => {
    const idToSend = (deviceResetId || identifier).trim();
    if (!idToSend) {
      toast.error('Please enter your Register Number or Roll Number.');
      return;
    }

    try {
      await api.post('/auth/device-request', {
        identifier: idToSend,
        registerNo: idToSend,
        newDeviceId: getDeviceId(),
        reason: deviceRequestReason.trim() || 'Device limit reached — requesting reset from login screen',
        platform: navigator.platform || 'Web',
      });
      setDeviceRequestSent(true);
      toast.success('Device reset request submitted to admin.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to submit device reset request');
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
    <div
      className="min-h-[100dvh] lg:h-[100dvh] w-full flex flex-col lg:flex-row bg-[#FBFAFF] overflow-x-hidden lg:overflow-hidden"
      style={{ fontFamily: "'Figtree', 'Inter', sans-serif" }}
    >
      {/* LEFT / TOP: KURAL 391 HERO PANEL */}
      <section
        aria-label="Thirukkural 391 Inspiration"
        className={`relative w-full lg:w-[50%] xl:w-[56%] shrink-0 kural-sunrise-bg text-white flex flex-col justify-between overflow-hidden transition-[padding,min-height] duration-300 ${
          isKeyboardOpen
            ? 'px-5 pt-4 pb-6'
            : isShortScreen
              ? 'px-5 py-4'
              : 'px-5 pt-5 pb-10 sm:px-8 sm:pt-7 sm:pb-12 lg:p-10 xl:p-14 lg:h-full'
        }`}
      >
        {/* Subtle contrast scrim + palm-leaf manuscript texture */}
        <div className="absolute inset-0 bg-[#1E1B4B]/20 pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 kural-palm-texture pointer-events-none" aria-hidden="true" />

        {/* Original Inline SVG: Faint AI "V" Constellation Nodes */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 320"
          className={`absolute right-4 top-6 w-64 sm:w-80 lg:w-[420px] opacity-20 pointer-events-none select-none ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDuration: '9s' }}
          fill="none"
        >
          <g stroke="#FBBF24" strokeWidth="1" strokeOpacity="0.45">
            <line x1="90" y1="50" x2="145" y2="140" />
            <line x1="145" y1="140" x2="200" y2="245" />
            <line x1="200" y1="245" x2="260" y2="140" />
            <line x1="260" y1="140" x2="315" y2="50" />
            <line x1="90" y1="50" x2="210" y2="85" strokeDasharray="3 4" />
            <line x1="210" y1="85" x2="315" y2="50" strokeDasharray="3 4" />
            <line x1="145" y1="140" x2="260" y2="140" strokeDasharray="2 4" />
          </g>
          {[
            [90, 50, 4],
            [145, 140, 3.5],
            [200, 245, 5],
            [260, 140, 3.5],
            [315, 50, 4],
            [210, 85, 2.5],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={i === 2 ? '#FBBF24' : '#FFFFFF'} fillOpacity="0.8" />
          ))}
        </svg>

        {/* Top-left Brand Header */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-2xl bg-white/95 shadow-md">
              <BrandLogo size={isKeyboardOpen || isShortScreen ? 'sm' : 'md'} />
            </div>
            <div>
              <span
                className="font-bold tracking-tight text-white text-base sm:text-lg block leading-none"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                Velan AI
              </span>
              <span className="text-[11px] text-white/75 hidden sm:inline">Smart Campus &amp; GPS Attendance</span>
            </div>
          </div>

          {isKeyboardOpen && (
            <span
              lang="ta"
              className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-semibold text-white backdrop-blur-sm"
              style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}
            >
              {LOGIN_KURAL_CONFIG.pillMobile}
            </span>
          )}
        </div>

        {/* Center-left Kural Block */}
        {!isKeyboardOpen && (
          <div className="relative z-10 my-auto py-3 sm:py-5 lg:py-0 max-w-2xl">
            {/* Large faint gold opening quote mark */}
            <svg
              aria-hidden="true"
              viewBox="0 0 80 64"
              className="hidden sm:block absolute -left-4 -top-6 w-20 h-16 text-[#FBBF24]/15 pointer-events-none select-none"
              fill="currentColor"
            >
              <path d="M18 8C8 14 2 24 2 38c0 11 7 18 16 18 8 0 14-6 14-14 0-8-6-13-13-13-2 0-4 .5-5 1.2C15 21 20 15 27 11L18 8zm38 0C46 14 40 24 40 38c0 11 7 18 16 18 8 0 14-6 14-14 0-8-6-13-13-13-2 0-4 .5-5 1.2C53 21 58 15 65 11L56 8z" />
            </svg>

            {/* Kural Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] sm:text-xs font-semibold text-[#FDE68A] backdrop-blur-sm mb-3 sm:mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" aria-hidden="true" />
              <span lang="ta" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
                <span className="lg:hidden">{LOGIN_KURAL_CONFIG.pillMobile}</span>
                <span className="hidden lg:inline">{LOGIN_KURAL_CONFIG.pillDesktop}</span>
              </span>
            </div>

            {/* Two-Line Couplet */}
            <h2
              lang="ta"
              className="font-semibold text-white tracking-normal hyphens-none"
              style={{
                fontFamily: "'Noto Serif Tamil', 'Noto Sans Tamil', serif",
                fontWeight: 600,
                fontSize: 'clamp(1.42rem, 3.1vw, 3.15rem)',
                lineHeight: 1.65,
                textShadow: '0 2px 24px rgba(11, 11, 15, 0.28)',
              }}
            >
              <span className="block">
                {line1Words.map((word, idx) => (
                  <motion.span
                    key={`l1-${idx}`}
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.2 }
                        : { duration: 0.38, delay: idx * 0.09, ease: 'easeOut' }
                    }
                    className="inline-block mr-[0.28em]"
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
              <span className="block">
                {line2Words.map((word, idx) => (
                  <motion.span
                    key={`l2-${idx}`}
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.2 }
                        : { duration: 0.38, delay: (line1Words.length + idx) * 0.09, ease: 'easeOut' }
                    }
                    className="inline-block mr-[0.28em]"
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
            </h2>

            {/* Thin Gold Kolam / Temple-Border Ornamental Divider (Original Inline SVG) */}
            <motion.div
              aria-hidden="true"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : 0.55 }}
              className="origin-left my-3 sm:my-4"
            >
              <svg viewBox="0 0 260 14" className="w-44 sm:w-56 h-3.5 text-[#FBBF24]" fill="none">
                <line x1="0" y1="7" x2="108" y2="7" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.65" />
                <polygon points="116,7 123,2 130,7 123,12" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.25" />
                <circle cx="138" cy="7" r="2" fill="currentColor" />
                <line x1="146" y1="7" x2="260" y2="7" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" />
              </svg>
            </motion.div>

            {/* Meanings (hidden on very short landscape screens < 520px) */}
            {!isShortScreen && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : 0.7 }}
                className="space-y-2"
              >
                <p
                  lang="ta"
                  className="text-[13px] sm:text-base lg:text-[18px] text-white/95 leading-[1.68] line-clamp-2 sm:line-clamp-none"
                  style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}
                >
                  {LOGIN_KURAL_CONFIG.tamilMeaning}
                </p>
                <p className="hidden sm:block text-sm lg:text-[16px] text-white/80 leading-relaxed max-w-xl">
                  {LOGIN_KURAL_CONFIG.englishMeaning}
                </p>
              </motion.div>
            )}

            {/* Attribution aligned to couplet's left edge, below meaning, with golden stylus icon */}
            <div className="mt-2.5 sm:mt-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#FBBF24]">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15.5 2.5l2 2L6 16l-3.5 1 1-3.5L15.5 2.5z" />
                <path d="M13 5l2 2" />
              </svg>
              <span lang="ta" style={{ fontFamily: "'Noto Sans Tamil', 'Figtree', sans-serif" }}>
                {LOGIN_KURAL_CONFIG.attribution}
              </span>
            </div>
          </div>
        )}

        {/* Bottom-left Quiet Tagline (Desktop) */}
        <div className="relative z-10 hidden lg:flex items-center justify-between text-xs text-white/70 pt-3 border-t border-white/15">
          <span>{LOGIN_KURAL_CONFIG.tagline}</span>
          <span className="font-medium text-white/60">{LOGIN_KURAL_CONFIG.productLine}</span>
        </div>

        {/* Mobile Smooth Wave Divider flowing into White Sign-In Area */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          className="lg:hidden absolute bottom-0 left-0 w-full h-7 sm:h-9 text-[#FBFAFF] pointer-events-none"
          fill="currentColor"
        >
          <path d="M0,36 C320,76 1120,-4 1440,36 L1440,72 L0,72 Z" />
        </svg>
      </section>

      {/* RIGHT / BOTTOM: CLEAN SIGN-IN AREA (No Floating Card) */}
      <main
        aria-label="Sign in"
        className="flex-1 bg-[#FBFAFF] flex flex-col justify-between px-5 py-5 sm:px-10 sm:py-8 lg:px-12 xl:px-16 overflow-y-auto"
      >
        <div className="my-auto w-full max-w-[420px] mx-auto space-y-5 sm:space-y-6">
          {/* Heading */}
          <div>
            <h1
              className="text-2xl sm:text-3xl font-extrabold text-[#0B0B0F] tracking-tight"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              Welcome back
            </h1>
            <div
              className="h-1 w-14 rounded-full bg-gradient-to-r from-[#7C3AED] via-[#DB2777] to-[#F59E0B] mt-2"
              aria-hidden="true"
            />
            <p className="text-xs sm:text-sm text-slate-600 mt-2.5">
              Sign in to continue to Velan AI.
            </p>
          </div>

          {/* Segmented Role Selector with Sliding Highlight */}
          <div
            role="tablist"
            aria-label="Select portal role"
            className="grid grid-cols-3 p-1 rounded-2xl bg-[#F5F3FF] border border-violet-200/70 gap-1"
          >
            {ROLE_OPTIONS.map(({ role, label, icon: Icon }) => {
              const active = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleRoleChange(role)}
                  className={`relative min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl text-xs sm:text-sm font-bold transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                    active ? 'text-[#5B21B6]' : 'text-slate-600 hover:text-[#0B0B0F]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="loginRoleHighlight"
                      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 bg-white rounded-xl shadow-sm border border-violet-200/60"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" aria-hidden="true" />
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              id="login-identifier"
              label={getIdentifierLabel()}
              type="text"
              name="username"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={getIdentifierPlaceholder()}
              className="min-h-[48px] text-sm focus:ring-2 focus:ring-[#7C3AED]"
              leftIcon={<User className="w-4 h-4 text-slate-400" />}
            />

            <Input
              id="login-password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="min-h-[48px] text-sm focus:ring-2 focus:ring-[#7C3AED]"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="p-2 text-slate-400 hover:text-[#5B21B6] transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Inline Error / Device Limit Banner */}
            {errorMessage && (
              <motion.div
                role="alert"
                aria-live="assertive"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                  <span className="font-medium leading-relaxed">{errorMessage}</span>
                </div>
                {isDeviceLimitError && (
                  <button
                    type="button"
                    onClick={() => setShowDeviceLockBlocked(true)}
                    className="inline-flex items-center gap-1 font-bold text-[#7C3AED] hover:underline"
                  >
                    Request device reset <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setForgotId(identifier);
                  setForgotSubmitted(false);
                  setShowForgotPassword(true);
                }}
                className="text-xs font-semibold text-[#5B21B6] hover:text-[#DB2777] hover:underline min-h-[36px] px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white font-bold text-sm shadow-lg shadow-violet-500/25 hover:-translate-y-0.5 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#7C3AED]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <footer className="pt-6 text-center text-[11px] text-slate-500">
          © 2026 Velan AI. All rights reserved.
        </footer>
      </main>

      {/* FORCED PASSWORD CHANGE MODAL */}
      <Modal
        isOpen={showForcedPasswordChange}
        onClose={() => {}}
        title="Set Your New Password"
        description="First-time login requires setting your own password to continue."
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
            placeholder="Enter any new password"
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
        description="Submit your Register Number, Employee ID, or Username. An administrator will generate a one-time temporary password if verified."
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
            <Input
              label="Verification (Register No / Last 4 digits of phone)"
              value={forgotVerify}
              onChange={(e) => setForgotVerify(e.target.value)}
              placeholder="Optional verification detail"
            />
            <Input
              label="Note for Admin (Optional)"
              value={forgotReason}
              onChange={(e) => setForgotReason(e.target.value)}
              placeholder="e.g. Forgot password after device change"
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
              If an account matching that identifier exists, a password reset request has been submitted to the administrator.
            </p>
            <p className="text-[11px] text-content-secondary">
              Once approved, the administrator will share a one-time temporary password with you. You will be prompted to set a new password on your next login.
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
        title="2-Device Limit Reached"
        description={
          deviceLimitBanner ||
          'This account is already signed in on 2 devices (phone and computer). To use a new device, send a request to the admin.'
        }
      >
        {!deviceRequestSent ? (
          <div className="space-y-4">
            <p className="text-xs text-content-secondary leading-relaxed">
              This account is already signed in on 2 devices (phone and computer). To use a new device, send a request to the admin.
            </p>
            <Input
              label="Student ID / Register Number"
              required
              value={deviceResetId}
              onChange={(e) => setDeviceResetId(e.target.value)}
              placeholder="e.g. 113024243032"
            />
            <Input
              label="Optional Note / Reason"
              value={deviceRequestReason}
              onChange={(e) => setDeviceRequestReason(e.target.value)}
              placeholder="e.g. Switched to a new phone"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowDeviceLockBlocked(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleDeviceChangeRequest}>
                Request device reset
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
