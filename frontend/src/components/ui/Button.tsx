import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyle =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-[0.99]';

  const variantStyles = {
    primary:
      'bg-brand-black hover:bg-brand-black-card text-white focus:ring-brand-black border border-brand-black-border shadow-sm',
    secondary:
      'bg-white hover:bg-brand-cream text-brand-text border border-brand-border focus:ring-brand-gold',
    gold:
      'bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:brightness-105 text-brand-black font-semibold focus:ring-brand-gold border border-brand-gold/30 shadow-sm',
    danger:
      'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 focus:ring-red-500',
    outline:
      'bg-white hover:bg-brand-cream-soft text-brand-text border border-brand-border focus:ring-brand-gold',
    ghost:
      'bg-transparent hover:bg-brand-cream text-brand-muted hover:text-brand-text focus:ring-brand-gold',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

