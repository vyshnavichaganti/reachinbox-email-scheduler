import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-brand-text placeholder-brand-muted shadow-xs transition focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-brand-border focus:border-brand-gold focus:ring-brand-gold/20'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {hint && !error && <p className="text-xs text-brand-muted mt-1">{hint}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

