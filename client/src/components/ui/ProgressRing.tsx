import React from 'react';
import { clsx } from 'clsx';

export interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  showPercent?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 10,
  color = '#6366F1',
  trackColor = '#E2E8F0',
  label,
  sublabel,
  showPercent = true,
}) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          stroke={trackColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {showPercent && (
          <span className="font-heading font-extrabold text-content tracking-tight text-xl">
            {Math.round(normalizedProgress)}%
          </span>
        )}
        {label && <span className="text-[11px] font-semibold text-content-secondary">{label}</span>}
        {sublabel && <span className="text-[9px] text-content-muted">{sublabel}</span>}
      </div>
    </div>
  );
};
