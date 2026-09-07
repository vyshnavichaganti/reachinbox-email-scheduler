import React, { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: 'bg-[#EBF6EE] border-[#B2E2C0] text-[#1B5731]',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-brand-cream border-brand-gold/40 text-brand-text',
  };

  const icons = {
    success: (
      <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="h-5 w-5 text-brand-gold-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-4">
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${styles[type]}`}>
        {icons[type]}
        <p className="text-xs font-semibold">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 text-brand-muted hover:text-brand-text transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

