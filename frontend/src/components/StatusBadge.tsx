import React from 'react';
import { ResourceStatus } from '../types';

interface StatusBadgeProps {
  status: ResourceStatus;
  showLabel?: boolean;
}

// Status colours from the Stonepark design system: green = confirmed/open,
// amber = advisory, red = fully booked. Status colours are earned, not
// decorative.
const STATUS_CONFIG: Record<ResourceStatus, { color: string; bg: string; label: string }> = {
  available: { color: '#155C39', bg: '#E1F3EA', label: 'Available' },
  partial:   { color: '#B06B00', bg: '#FDF0DC', label: 'Partial' },
  full:      { color: '#8F1C16', bg: '#FBE7E5', label: 'Full' },
};

const DOT_COLOR: Record<ResourceStatus, string> = {
  available: '#1E7A4C',
  partial: '#E08A00',
  full: '#C0271F',
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
        style={{ backgroundColor: DOT_COLOR[status] }}
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
  return (
    <span
      className="w-3 h-3 rounded-full inline-block"
      style={{ backgroundColor: DOT_COLOR[status] }}
      aria-label={status}
    />
  );
};
