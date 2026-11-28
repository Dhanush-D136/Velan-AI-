import { useEffect, useRef, useState, useCallback } from 'react';
import { UserRole } from '@velan/shared';
import { api } from '@/lib/api';

export type LoadingStage = 'workspace' | 'data' | 'waking' | 'slow' | 'error';

export interface LoadingErrorDetails {
  status?: number | string;
  url?: string;
  message?: string;
}

export interface UseLoadingStageOptions {
  isLoading: boolean;
  role?: UserRole | string;
  hasError?: boolean;
  errorDetails?: LoadingErrorDetails | null;
  enableHealthPing?: boolean;
  onRetry?: () => void;
}

export interface UseLoadingStageResult {
  visible: boolean;
  isFadingOut: boolean;
  stage: LoadingStage;
  elapsedSeconds: number;
  isOffline: boolean;
  statusTitle: string;
  helperText: string;
  retry: () => void;
  errorDetails?: LoadingErrorDetails | null;
}

function getWorkspaceTitle(role?: UserRole | string): string {
  switch (role) {
    case UserRole.STUDENT:
      return 'Loading your attendance';
    case UserRole.FACULTY:
      return 'Loading your classes';
    case UserRole.ADMIN:
      return 'Loading the admin dashboard';
    default:
      return 'Loading your workspace';
  }
}

export function useLoadingStage({
  isLoading,
  role,
  hasError = false,
  errorDetails = null,
  enableHealthPing = false,
  onRetry,
}: UseLoadingStageOptions): UseLoadingStageResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [visible, setVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [serverSlowEarly, setServerSlowEarly] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  // Track online/offline status & auto-retry on reconnect
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

  // Anti-flicker visibility: delay 200ms before showing, keep >=500ms once shown, fade out 250ms
  useEffect(() => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

    if (isLoading || hasError) {
      setIsFadingOut(false);
      if (!visible) {
        showTimerRef.current = window.setTimeout(() => {
          shownAtRef.current = Date.now();
          setVisible(true);
        }, hasError ? 0 : 200);
      }
      return;
    }

    if (visible) {
      const elapsedVisible = shownAtRef.current ? Date.now() - shownAtRef.current : 500;
      const remainingMin = Math.max(0, 500 - elapsedVisible);
      hideTimerRef.current = window.setTimeout(() => {
        setIsFadingOut(true);
        fadeTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          setIsFadingOut(false);
          shownAtRef.current = null;
        }, 250);
      }, remainingMin);
    }
  }, [isLoading, hasError, visible]);

  // Elapsed timer while loading
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      setServerSlowEarly(false);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(secs);
    }, 500);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  // Optional startup health ping: if /api/health takes >3s, jump to 'waking' stage
  useEffect(() => {
    if (!enableHealthPing || !isLoading) return;
    let cancelled = false;
    let retryTimer: number | null = null;

    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setServerSlowEarly(true);
    }, 3000);

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

  let statusTitle = getWorkspaceTitle(role);
  let helperText = 'Just a moment.';

  if (isOffline) {
    statusTitle = 'You are offline. Reconnecting...';
    helperText = 'Waiting for your internet connection to come back.';
  } else if (stage === 'data') {
    statusTitle = 'Getting your data ready';
    helperText = 'Fetching your classes and attendance.';
  } else if (stage === 'waking') {
    statusTitle = 'Waking up the server';
    helperText = 'Free servers can take a little while to start.';
  } else if (stage === 'slow') {
    statusTitle = 'Still working on it';
    helperText = 'The server is slow right now. This can take up to a minute.';
  } else if (stage === 'error') {
    statusTitle = isOffline
      ? 'You are offline'
      : elapsedSeconds >= 30
        ? 'This is taking too long'
        : 'We could not reach the server';
    helperText = 'Your session is safe. Please try again in a moment.';
  }

  return {
    visible,
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
