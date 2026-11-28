import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { RefreshCw, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { LoadingStage, LoadingErrorDetails } from '@/hooks/useLoadingStage';
import { getContextMessage, LoadingContext } from '@/config/loadingMessages';
import { LeafLoader } from './LeafLoader';
import { FlowLine, TopBar } from './FlowLine';

export { TopBar, FlowLine, LeafLoader };

export const Spinner: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
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
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

interface LoadingScreenProps {
  role?: string;
  context?: LoadingContext;
  stage?: LoadingStage;
  statusTitle?: string;
  helperText?: string;
  isOffline?: boolean;
  isFadingOut?: boolean;
  onRetry?: () => void;
  errorDetails?: LoadingErrorDetails | null;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  role,
  context = 'app_start',
  stage = 'workspace',
  statusTitle,
  helperText,
  isFadingOut = false,
  onRetry,
  errorDetails,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  const fallbackMsg = getContextMessage(context, role);
  const primary = statusTitle || fallbackMsg.primary;
  const helper = helperText || fallbackMsg.helper;

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setVpHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return (
    <div
      aria-busy={stage !== 'error'}
      className={clsx(
        'min-h-[100dvh] w-full bg-surface flex flex-col items-center justify-center px-6 transition-opacity duration-200',
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
      style={{
        minHeight: vpHeight ? `${vpHeight}px` : '100dvh',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="w-full max-w-[320px] mx-auto flex flex-col items-center text-center gap-6">
        {/* 1. Real Velan AI logo + "Velan AI" centred */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-1 ring-border bg-white shrink-0">
            <img
              src="/logo.png"
              alt="Velan AI"
              className="w-full h-full object-cover"
            />
          </div>
          <span
            className="text-[22px] font-extrabold tracking-tight text-content leading-none"
            style={{ fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}
          >
            Velan AI
          </span>
        </div>

        {stage !== 'error' ? (
          <>
            {/* 2. Palm-leaf animation */}
            <div className="w-full flex justify-center">
              <LeafLoader size="full" />
            </div>

            {/* 3. Fixed 200px wide flowing line track centred under the logo */}
            <div className="w-[200px] mx-auto">
              <FlowLine />
            </div>

            {/* 4. Status text (primary + helper) centred with reserved height */}
            <div
              role="status"
              aria-live="polite"
              className="min-h-[4rem] w-full flex flex-col items-center justify-start text-center transition-opacity duration-200"
            >
              <p
                className="text-[16px] sm:text-[17px] font-semibold text-content leading-snug [text-wrap:balance]"
                style={{ fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}
              >
                {primary}
              </p>
              <p
                className="text-[13.5px] font-normal text-content-secondary mt-1 leading-relaxed [text-wrap:balance]"
                style={{ fontFamily: "'Figtree', 'Inter', sans-serif" }}
              >
                {helper}
              </p>
            </div>
          </>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="w-full mt-6 p-6 bg-surface-soft border border-border rounded-3xl text-center shadow-subtle"
          >
            <h2
              className="text-[17px] font-semibold text-content"
              style={{ fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}
            >
              {primary}
            </h2>
            <p
              className="text-[13.5px] text-content-secondary mt-1.5 leading-relaxed"
              style={{ fontFamily: "'Figtree', 'Inter', sans-serif" }}
            >
              {helper}
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
  context?: LoadingContext;
  compact?: boolean;
  showBlocks?: boolean;
  className?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({
  label,
  subtext,
  context,
  compact = false,
  showBlocks = true,
  className,
}) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const ctxMsg = context ? getContextMessage(context) : null;
  let primary = label || ctxMsg?.primary || 'Loading...';
  let helper = subtext ?? ctxMsg?.helper;

  if (elapsed >= 15) {
    primary = 'Still working on it';
    helper = 'The server is slow right now. This can take up to a minute.';
  } else if (elapsed >= 8) {
    primary = 'Waking up the server';
    helper = 'Free servers can take a little while to start.';
  }

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={clsx(
          'w-full py-4 px-4 flex flex-col items-center justify-center text-center bg-surface border border-border rounded-2xl',
          className
        )}
      >
        <div className="w-full max-w-[160px]">
          <LeafLoader size="compact" />
        </div>
        <div className="w-full max-w-[200px] mt-2">
          <FlowLine />
        </div>
        <p
          className="text-xs font-semibold text-content mt-2"
          style={{ fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}
        >
          {primary}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={clsx('w-full space-y-4', className)}
    >
      {/* Static light-gray layout blocks (no animation) */}
      {showBlocks && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-20 bg-slate-100 rounded-2xl border border-border/50" />
          <div className="h-20 bg-slate-100 rounded-2xl border border-border/50" />
          <div className="h-20 bg-slate-100 rounded-2xl border border-border/50" />
        </div>
      )}

      {/* Centered palm-leaf + flowing line + status (NO logo, NO "Velan AI") */}
      <div className="w-full py-10 px-6 flex flex-col items-center justify-center text-center bg-surface border border-border rounded-3xl shadow-subtle">
        <div className="w-full max-w-[260px]">
          <LeafLoader size="inpage" />
        </div>
        <div className="w-full max-w-[260px] mt-4">
          <FlowLine />
        </div>
        <p
          className="text-[16px] sm:text-[17px] font-semibold text-content mt-4 leading-snug"
          style={{ fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif" }}
        >
          {primary}
        </p>
        {helper && (
          <p
            className="text-[13.5px] font-normal text-content-secondary mt-1 max-w-xs leading-relaxed"
            style={{ fontFamily: "'Figtree', 'Inter', sans-serif" }}
          >
            {helper}
          </p>
        )}
      </div>
    </div>
  );
};
