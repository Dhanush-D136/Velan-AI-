import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  className,
  isOnline,
}) => {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const getInitials = (str: string) => {
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0] ? parts[0].slice(0, 2) : 'U').toUpperCase();
  };

  return (
    <div className="relative inline-block select-none shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={twMerge(
            clsx(
              'rounded-full object-cover border-2 border-white shadow-sm',
              sizeStyles[size],
              className
            )
          )}
        />
      ) : (
        <div
          className={twMerge(
            clsx(
              'rounded-full flex items-center justify-center font-bold text-white bg-brand-gradient shadow-sm border-2 border-white',
              sizeStyles[size],
              className
            )
          )}
        >
          {getInitials(name)}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-white',
            size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3',
            isOnline ? 'bg-accent-emerald' : 'bg-slate-300'
          )}
        />
      )}
    </div>
  );
};
