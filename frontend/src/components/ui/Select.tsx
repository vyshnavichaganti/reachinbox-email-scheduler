import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, hint, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-brand-text placeholder-brand-muted shadow-xs transition focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-brand-border focus:border-brand-gold focus:ring-brand-gold/20'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white text-brand-text py-1">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {hint && !error && <p className="text-xs text-brand-muted mt-1">{hint}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

