import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: {
    value: string | number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  iconBg?: string;
  sparkline?: number[];
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  icon,
  iconBg = 'bg-brand-50 text-brand-600',
  className,
}) => {
  return (
    <Card variant="interactive" className={twMerge('p-6', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1">
            {title}
          </p>
          <h3 className="text-2xl sm:text-3xl font-heading font-bold text-content tracking-tight">
            {value}
          </h3>
        </div>
        {icon && (
          <div className={clsx('p-3 rounded-2xl flex items-center justify-center shrink-0', iconBg)}>
            {icon}
          </div>
        )}
      </div>

      {(subtitle || change) && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          {change && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold',
                change.isPositive
                  ? 'bg-emerald-50 text-accent-emerald'
                  : 'bg-rose-50 text-accent-rose'
              )}
            >
              {change.isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {change.value}
            </span>
          )}
          {subtitle && <span className="text-content-secondary">{subtitle}</span>}
        </div>
      )}
    </Card>
  );
};
