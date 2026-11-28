import React, { useState } from 'react';
import { clsx } from 'clsx';
import { RefreshCw, RotateCcw, ChevronDown, ChevronUp, WifiOff } from 'lucide-react';
import { LoadingStage, LoadingErrorDetails } from '@/hooks/useLoadingStage';

export const Spinner: React.FC<{ size?: number; className?: string }> = ({
  size = 28,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    aria-hidden="true"
    className={clsx('velan-spinner shrink-0', className)}
  >
    <circle
      cx="14"
      cy="14"
      r="11"
      stroke="var(--velan-brand-tint, rgba(124, 58, 237, 0.14))"
      strokeWidth="2.5"
    />
    <path
      d="M14 3a11 11 0 0 1 11 11"
      stroke="var(--velan-brand-violet, #7C3AED)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const TopBar: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-busy="true"
      className="fixed top-0 inset-x-0 z-[60] h-[3px] overflow-hidden bg-[var(--velan-brand-tint)] pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="h-full velan-loading-bar rounded-full" />
    </div>
  );
};

interface LoadingScreenProps {
  stage: LoadingStage;
  statusTitle: string;
  helperText: string;
  isOffline?: boolean;
  isFadingOut?: boolean;
  onRetry?: () => void;
  errorDetails?: LoadingErrorDetails | null;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  stage,
  statusTitle,
  helperText,
  isOffline = false,
  isFadingOut = false,
  onRetry,
  errorDetails,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      aria-busy={stage !== 'error'}
      className={clsx(
        'min-h-screen w-full bg-surface flex flex-col items-center justify-center px-6 transition-opacity duration-200',
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="w-full max-w-[360px] flex flex-col items-center text-center">
        {/* Still real Velan AI logo (~72px) */}
        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shadow-md ring-1 ring-border bg-white shrink-0">
          <img
            src="/logo.png"
            alt="Velan AI"
            className="w-full h-full object-cover"
          />
        </div>

        {stage !== 'error' ? (
          <>
            {/* Indeterminate 4px loading bar */}
            <div className="w-full h-1 rounded-full bg-[var(--velan-brand-tint)] overflow-hidden mt-7">
              <div className="h-full rounded-full velan-loading-bar" />
            </div>

            {/* 28px spinner */}
            <div className="mt-6 flex items-center justify-center">
              {isOffline ? (
                <WifiOff className="w-7 h-7 text-amber-600" aria-hidden="true" />
              ) : (
                <Spinner size={28} />
              )}
            </div>

            {/* Status & helper lines with reserved height to avoid layout shift */}
            <div
              role="status"
              aria-live="polite"
              className="mt-4 min-h-[3.75rem] flex flex-col items-center justify-start transition-opacity duration-200"
            >
              <p className="text-[16px] font-medium text-content leading-snug">
                {statusTitle}
              </p>
              <p className="text-[13px] text-content-secondary mt-1 leading-relaxed">
                {helperText}
              </p>
            </div>
          </>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="w-full mt-7 p-6 bg-surface-soft border border-border rounded-3xl text-center shadow-subtle"
          >
            <h2 className="text-base font-heading font-bold text-content">
              {statusTitle}
            </h2>
            <p className="text-[13px] text-content-secondary mt-1.5 leading-relaxed">
              {helperText}
            </p>

            <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={onRetry || (() => window.location.reload())}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-brand-gradient text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-glass"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-border text-content text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-surface-muted"
              >
                <RotateCcw className="w-4 h-4" />
                Reload page
              </button>
            </div>

            {errorDetails && (errorDetails.status || errorDetails.url || errorDetails.message) && (
              <div className="mt-4 pt-3 border-t border-border/70 text-left">
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="text-xs font-medium text-content-secondary hover:text-content inline-flex items-center gap-1"
                >
                  Details
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showDetails && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white border border-border text-[11px] font-mono text-content-secondary break-all space-y-1">
                    {errorDetails.status && <div>Status: {errorDetails.status}</div>}
                    {errorDetails.url && <div>URL: {errorDetails.url}</div>}
                    {errorDetails.message && <div>Message: {errorDetails.message}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface InlineLoaderProps {
  label?: string;
  subtext?: string;
  className?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({
  label = 'Loading...',
  subtext,
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={clsx('w-full space-y-4', className)}
    >
      {/* Static light layout blocks (no pulsing) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-20 bg-slate-100 rounded-2xl border border-border/50" />
        <div className="h-20 bg-slate-100 rounded-2xl border border-border/50" />
        <div className="h-20 bg-slate-100 rounded-2xl border border-border/50" />
      </div>

      {/* Centered calm spinner + noun label */}
      <div className="w-full py-12 px-6 flex flex-col items-center justify-center text-center bg-surface border border-border rounded-3xl shadow-subtle">
        <Spinner size={28} />
        <p className="text-[15px] font-medium text-content mt-3.5">{label}</p>
        {subtext && (
          <p className="text-[13px] text-content-secondary mt-1 max-w-xs">{subtext}</p>
        )}
      </div>
    </div>
  );
};
