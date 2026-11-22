import React from 'react';
import { Button } from './Button';
import { Plus, FolderPlus } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: any;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
}) => {
  const renderIcon = () => {
    if (!Icon) return <FolderPlus className="w-7 h-7" />;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === 'function' || typeof Icon === 'object') {
      const Comp = Icon as React.ElementType;
      return <Comp className="w-7 h-7" />;
    }
    return <FolderPlus className="w-7 h-7" />;
  };

  return (
    <div className="p-12 rounded-3xl border-2 border-dashed border-border/80 bg-surface-soft/60 flex flex-col items-center justify-center text-center my-6">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 shadow-sm">
        {renderIcon()}
      </div>
      <h3 className="text-base font-heading font-bold text-content">{title}</h3>
      <p className="text-xs text-content-secondary max-w-sm mt-1 mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="md" leftIcon={<Plus className="w-4 h-4" />}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
