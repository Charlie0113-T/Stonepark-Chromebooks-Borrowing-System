import React from 'react';
import { ResourceStatus } from '../types';

interface StatusBadgeProps {
  status: ResourceStatus;
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<ResourceStatus, { color: string; bg: string; label: string }> = {
  available: { color: '#28a745', bg: '#d4edda', label: 'Available' },
  partial:   { color: '#856404', bg: '#fff3cd', label: 'Partial' },
  full:      { color: '#dc3545', bg: '#f8d7da', label: 'Full' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showLabel = true }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: cfg.color }}
        aria-hidden="true"
      />
      {showLabel && cfg.label}
    </span>
  );
};

interface StatusDotProps {
  status: ResourceStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => {
  const color =
    status === 'available' ? '#28a745' : status === 'partial' ? '#ffc107' : '#dc3545';
  return (
    <span
      className="w-3 h-3 rounded-full inline-block"
      style={{ backgroundColor: color }}
      aria-label={status}
    />
  );
};
