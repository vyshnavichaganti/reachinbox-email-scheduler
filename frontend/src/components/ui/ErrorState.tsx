import React from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load content',
  message,
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/60 py-12 px-6 text-center shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 border border-red-200">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="mt-3 text-sm font-bold text-red-800">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-red-700">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="danger" size="sm" className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
};

