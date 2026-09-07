import React from 'react';
import type { EmailStatus } from '../../types';

export interface BadgeProps {
  status: EmailStatus | string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const statusUpper = status.toUpperCase();

  const styles: Record<string, string> = {
    SCHEDULED: 'bg-brand-gold-soft/60 text-[#846629] border-brand-gold/40 font-semibold',
    PROCESSING: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    FAILED: 'bg-red-50 text-red-700 border-red-200 font-semibold',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
  };

  const currentStyle = styles[statusUpper] || 'bg-slate-100 text-slate-700 border-slate-200';

  const sizeStyle = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-2xs ${currentStyle} ${sizeStyle}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {statusUpper}
    </span>
  );
};

