import React from 'react';
import { clsx } from 'clsx';

export const FlowLine: React.FC<{ className?: string }> = ({ className }) => (
  <div
    role="progressbar"
    aria-label="Loading progress"
    aria-busy="true"
    className={clsx(
      'w-full h-1 rounded-full overflow-hidden bg-[var(--velan-brand-tint)]',
      className
    )}
  >
    <div className="h-full rounded-full velan-flow-bar" />
  </div>
);

export const TopBar: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-busy="true"
      className="fixed inset-x-0 z-[60] h-[3px] overflow-hidden bg-[var(--velan-brand-tint)] pointer-events-none"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="h-full rounded-full velan-flow-bar" />
    </div>
  );
};
