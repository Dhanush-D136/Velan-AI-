import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-content-secondary mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-4 text-content-muted pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={twMerge(
              clsx(
                'w-full bg-white border border-border text-content text-sm rounded-2xl transition-all duration-200 outline-none',
                'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 placeholder:text-content-muted/70',
                'disabled:bg-surface-muted disabled:cursor-not-allowed',
                leftIcon ? 'pl-11 pr-4 py-3' : 'px-4 py-3',
                rightIcon ? 'pr-11' : '',
                error && 'border-accent-rose focus:border-accent-rose focus:ring-accent-rose/10',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-content-muted flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-accent-rose font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-content-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
