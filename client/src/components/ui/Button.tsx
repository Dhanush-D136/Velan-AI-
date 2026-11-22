import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'admin' | 'faculty' | 'student';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none rounded-2xl';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-5 py-2.5 gap-2 h-11',
    lg: 'text-base px-6 py-3.5 gap-2.5 h-13',
  };

  const variantStyles = {
    primary:
      'bg-brand-gradient text-white shadow-glass hover:shadow-glass-hover focus:ring-brand-500 hover:brightness-105',
    secondary:
      'bg-surface-muted text-content hover:bg-slate-200/70 border border-border focus:ring-slate-400',
    soft:
      'bg-brand-50 text-brand-600 hover:bg-brand-100/80 border border-brand-200 focus:ring-brand-400',
    ghost:
      'bg-transparent text-content hover:bg-slate-100 focus:ring-slate-400',
    danger:
      'bg-accent-rose text-white hover:bg-rose-600 shadow-sm focus:ring-rose-400',
    admin:
      'bg-admin-gradient text-white shadow-glass hover:shadow-glass-hover focus:ring-indigo-500',
    faculty:
      'bg-faculty-gradient text-white shadow-glass hover:shadow-glass-hover focus:ring-teal-500',
    student:
      'bg-student-gradient text-white shadow-glass hover:shadow-glass-hover focus:ring-blue-500',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
