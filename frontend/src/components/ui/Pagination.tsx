import React from 'react';
import type { Pagination as PaginationType } from '../../types';
import { Button } from './Button';

export interface PaginationProps {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange,
}) => {
  const { page, totalPages, total, limit } = pagination;

  if (total === 0 || totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-brand-border bg-brand-cream-soft px-5 py-3 text-xs text-brand-muted">
      <div>
        Showing <span className="font-bold text-brand-text">{start}</span> to{' '}
        <span className="font-bold text-brand-text">{end}</span> of{' '}
        <span className="font-bold text-brand-text">{total}</span> items
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="px-2 font-medium text-brand-text">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

