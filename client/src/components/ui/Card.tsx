import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'bordered';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  ...props
}) => {
  const baseStyles = 'rounded-3xl p-6 transition-all duration-200';

  const variantStyles = {
    default: 'bg-white border border-border shadow-glass',
    glass: 'glass-panel shadow-glass',
    interactive: 'bg-white border border-border shadow-glass glass-panel-hover cursor-pointer',
    bordered: 'bg-white border-2 border-border/80 hover:border-brand-300',
  };

  return (
    <div className={twMerge(clsx(baseStyles, variantStyles[variant], className))} {...props}>
      {children}
    </div>
  );
};
