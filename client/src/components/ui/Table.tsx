import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InlineLoader, TopBar } from './LoadingScreen';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found',
  isLoading = false,
  loadingLabel = 'Loading records',
  className,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className={twMerge('w-full overflow-hidden rounded-3xl border border-border bg-white shadow-subtle', className)}>
      <TopBar active={isLoading && data.length > 0} />
      <div className="overflow-x-auto" style={{ touchAction: 'pan-x pan-y' }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-soft/80 text-content-secondary uppercase text-[11px] font-semibold tracking-wider">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={clsx(
                    'px-6 py-4',
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <InlineLoader showBlocks={false} label={loadingLabel} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-content-secondary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={clsx(
                    'transition-colors duration-150',
                    onRowClick ? 'hover:bg-brand-50/40 cursor-pointer' : 'hover:bg-surface-soft/60'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-6 py-4 text-content font-medium',
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                      )}
                    >
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
