import React from 'react';
import { clsx } from 'clsx';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-9 h-9 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-16 h-16 rounded-2xl',
    xl: 'w-24 h-24 rounded-3xl',
  };

  return (
    <div
      className={clsx(
        'overflow-hidden shadow-md shadow-brand-500/20 ring-1 ring-border bg-white shrink-0',
        sizeClasses[size],
        className
      )}
    >
      <img
        src="/logo.png"
        alt="Velan AI Logo"
        className="w-full h-full object-cover"
      />
    </div>
  );
};
