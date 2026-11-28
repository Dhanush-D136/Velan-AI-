import { useEffect, useRef, useState, useCallback } from 'react';
import { UserRole } from '@velan/shared';
import { api } from '@/lib/api';
import {
  ELAPSED_STAGE_MESSAGES,
  getAppLanguage,
  getContextMessage,
  LoadingContext,
} from '@/config/loadingMessages';
import { LOADING_TIMING } from '@/config/loadingSizes';

export type LoadingStage = 'workspace' | 'data' | 'waking' | 'slow' | 'error';

export interface LoadingErrorDetails {
  status?: number | string;
  url?: string;
  message?: string;
}

export interface UseLoadingStageOptions {
  isLoading: boolean;
  context?: LoadingContext;
  scope?: 'full' | 'inpage';
  role?: UserRole | string;
  hasError?: boolean;
  errorDetails?: LoadingErrorDetails | null;
  enableHealthPing?: boolean;
  onRetry?: () => void;
}

export interface UseLoadingStageResult {
  visible: boolean;
  showTopLine: boolean;
  isFadingOut: boolean;
  stage: LoadingStage;
  elapsedSeconds: number;
  isOffline: boolean;
  statusTitle: string;
  helperText: string;
  retry: () => void;
  errorDetails?: LoadingErrorDetails | null;
}

export function useLoadingStage(
  options: UseLoadingStageOptions
): UseLoadingStageResult {
  const {
    isLoading,
    context = 'dashboard',
    scope = 'full',
    role,
    hasError = false,
    errorDetails = null,
    enableHealthPing = false,
    onRetry,
  } = options;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTopLine, setShowTopLine] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [serverSlowEarly, setServerSlowEarly] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const shownAtRef = useRef<number | null>(null);
  const topLineTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (onRetry) onRetry();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onRetry]);

  // 0-200ms: nothing | 200ms-1s: top line only | >1s: full/in-page loader (min 600ms + 250ms fade)
  useEffect(() => {
    if (topLineTimerRef.current) window.clearTimeout(topLineTimerRef.current);
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

    if (isLoading || hasError) {
      setIsFadingOut(false);
      if (!showTopLine) {
        topLineTimerRef.current = window.setTimeout(() => {
          setShowTopLine(true);
        }, hasError ? 0 : LOADING_TIMING.topLineThresholdMs);
      }
      if (!visible) {
        const delay = hasError
          ? 0
          : scope === 'full'
            ? LOADING_TIMING.delayBeforeShowMs
            : LOADING_TIMING.fullOrInlineThresholdMs;
        showTimerRef.current = window.setTimeout(() => {
          shownAtRef.current = Date.now();
          setVisible(true);
        }, delay);
      }
      return;
    }

    setShowTopLine(false);
    if (visible) {
      const elapsedVisible = shownAtRef.current ? Date.now() - shownAtRef.current : LOADING_TIMING.minDisplayMs;
      const remainingMin = Math.max(0, LOADING_TIMING.minDisplayMs - elapsedVisible);
      hideTimerRef.current = window.setTimeout(() => {
        setIsFadingOut(true);
        fadeTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          setIsFadingOut(false);
          shownAtRef.current = null;
        }, LOADING_TIMING.fadeOutMs);
      }, remainingMin);
    }
  }, [isLoading, hasError, visible, showTopLine, scope]);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      setServerSlowEarly(false);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  // Startup health ping: if /api/health takes > 3s, jump to 'waking' stage immediately
  useEffect(() => {
    if (!enableHealthPing || !isLoading) return;
    let cancelled = false;
    let retryTimer: number | null = null;

    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setServerSlowEarly(true);
    }, LOADING_TIMING.healthSlowMs);

    const ping = async () => {
      try {
        await api.get('/health', { timeout: 25000 });
        if (!cancelled) {
          window.clearTimeout(slowTimer);
          setServerSlowEarly(false);
        }
      } catch {
        if (!cancelled) {
          setServerSlowEarly(true);
          retryTimer = window.setTimeout(ping, 3000);
        }
      }
    };

    ping();

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [enableHealthPing, isLoading]);

  const retry = useCallback(() => {
    setElapsedSeconds(0);
    setServerSlowEarly(false);
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  }, [onRetry]);

  let stage: LoadingStage = 'workspace';
  if (hasError || elapsedSeconds >= 30) {
    stage = 'error';
  } else if (elapsedSeconds >= 15) {
    stage = 'slow';
  } else if (elapsedSeconds >= 8 || serverSlowEarly) {
    stage = 'waking';
  } else if (elapsedSeconds >= 3) {
    stage = 'data';
  }

  const lang = getAppLanguage();
  const baseMsg = getContextMessage(context, role, lang);
  const elapsedMsgs = ELAPSED_STAGE_MESSAGES[lang];

  let statusTitle = baseMsg.primary;
  let helperText = baseMsg.helper;

  if (isOffline) {
    statusTitle = elapsedMsgs.offline.primary;
    helperText = elapsedMsgs.offline.helper;
  } else if (stage === 'data') {
    statusTitle = elapsedMsgs.data.primary;
    helperText = elapsedMsgs.data.helper;
  } else if (stage === 'waking') {
    statusTitle = elapsedMsgs.waking.primary;
    helperText = elapsedMsgs.waking.helper;
  } else if (stage === 'slow') {
    statusTitle = elapsedMsgs.slow.primary;
    helperText = elapsedMsgs.slow.helper;
  } else if (stage === 'error') {
    const errPair = elapsedSeconds >= 30 ? elapsedMsgs.error_timeout : elapsedMsgs.error_reach;
    statusTitle = isOffline ? elapsedMsgs.offline.primary : errPair.primary;
    helperText = errPair.helper;
  }

  return {
    visible,
    showTopLine,
    isFadingOut,
    stage,
    elapsedSeconds,
    isOffline,
    statusTitle,
    helperText,
    retry,
    errorDetails,
  };
}
