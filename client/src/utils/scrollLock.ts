let lockCount = 0;
let prevBodyOverflow: string | null = null;
let warnTimer: number | null = null;

export function getScrollLockCount(): number {
  return lockCount;
}

export function acquireScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};
  let released = false;

  if (lockCount === 0) {
    prevBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    if ((import.meta as any).env?.DEV) {
      if (warnTimer) window.clearTimeout(warnTimer);
      warnTimer = window.setTimeout(() => {
        if (lockCount > 0) {
          console.warn('[scrollLock] Scroll lock held for >30s (count=' + lockCount + ')');
        }
      }, 30000);
    }
  }
  lockCount += 1;

  return () => {
    if (released) return;
    released = true;
    releaseScrollLock();
  };
}

export function releaseScrollLock(): void {
  if (typeof document === 'undefined' || lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = prevBodyOverflow === 'hidden' ? '' : (prevBodyOverflow ?? '');
    prevBodyOverflow = null;
    if (warnTimer) {
      window.clearTimeout(warnTimer);
      warnTimer = null;
    }
  }
}

export function resetAllScrollLocks(): void {
  if (typeof document === 'undefined') return;
  lockCount = 0;
  document.body.style.overflow = '';
  prevBodyOverflow = null;
  if (warnTimer) {
    window.clearTimeout(warnTimer);
    warnTimer = null;
  }
}
