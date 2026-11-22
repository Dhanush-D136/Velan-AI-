import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'admin' | 'faculty' | 'student' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'brand',
  size = 'md',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full select-none';

  const sizeStyles = {
    sm: 'text-[11px] px-2.5 py-0.5 gap-1',
    md: 'text-xs px-3 py-1 gap-1.5',
  };

  const variantStyles = {
    brand: 'bg-brand-50 text-brand-700 border border-brand-200/80',
    admin: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
    faculty: 'bg-teal-50 text-teal-700 border border-teal-200/80',
    student: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    success: 'bg-emerald-50 text-accent-emerald border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    danger: 'bg-rose-50 text-accent-rose border border-rose-200/80',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  return (
    <span className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))} {...props}>
      {children}
    </span>
  );
};
