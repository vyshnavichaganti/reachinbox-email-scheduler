import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
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

Input.displayName = 'Input';

