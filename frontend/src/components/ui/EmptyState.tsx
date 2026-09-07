import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-border bg-white py-16 px-6 text-center shadow-xs">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cream text-brand-gold-dark border border-brand-border shadow-2xs">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-bold font-serif text-brand-text">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-brand-muted">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="sm" className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

