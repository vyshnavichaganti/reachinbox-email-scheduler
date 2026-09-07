import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'xl',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container Card */}
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} transform rounded-3xl border border-brand-border bg-brand-white p-6 text-left shadow-2xl transition-all sm:p-8 my-8 max-h-[90vh] overflow-y-auto`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-brand-border/60 pb-4">
          <div>
            <h3 className="text-xl font-bold font-serif text-brand-text tracking-tight">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-brand-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-brand-muted hover:bg-brand-cream hover:text-brand-text transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
};

