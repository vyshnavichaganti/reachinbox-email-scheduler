import React from 'react';
import type { Email } from '../../types';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';

export interface EmailDetailsModalProps {
  email: Email | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelEmail?: (id: string) => void;
  isCancelling?: boolean;
}

export const EmailDetailsModal: React.FC<EmailDetailsModalProps> = ({
  email,
  isOpen,
  onClose,
  onCancelEmail,
  isCancelling = false,
}) => {
  if (!email) return null;

  const isCancelable = email.status === 'SCHEDULED';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Email Delivery Details" subtitle={`System ID: ${email.id}`}>
      <div className="space-y-5">
        {/* Status Header */}
        <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-cream-soft p-4">
          <div>
            <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">Status</span>
            <div className="mt-1">
              <Badge status={email.status} />
            </div>
          </div>
          {isCancelable && onCancelEmail && (
            <button
              onClick={() => onCancelEmail(email.id)}
              disabled={isCancelling}
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition shadow-2xs"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Scheduled Email'}
            </button>
          )}
        </div>

        {/* Recipient & Sender */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
              Recipient
            </span>
            <p className="mt-1 text-xs font-bold text-brand-text break-all">{email.recipient}</p>
          </div>
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
              Sender ID
            </span>
            <p className="mt-1 text-xs font-semibold text-brand-muted break-all font-mono">{email.senderId}</p>
          </div>
        </div>

        {/* Subject */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
            Subject Line
          </span>
          <p className="mt-1 text-xs font-bold text-brand-text">{email.subject}</p>
        </div>

        {/* Body Content */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
            Email Body Content
          </span>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-brand-cream-soft p-3.5 text-xs text-brand-text whitespace-pre-wrap border border-brand-border font-sans">
            {email.body}
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-brand-border bg-white p-3 shadow-2xs">
            <span className="text-brand-muted block text-[11px] font-medium">Scheduled Time</span>
            <span className="font-semibold text-brand-text mt-0.5 block">
              {new Date(email.scheduledAt).toLocaleString()}
            </span>
          </div>
          <div className="rounded-xl border border-brand-border bg-white p-3 shadow-2xs">
            <span className="text-brand-muted block text-[11px] font-medium">Sent Time</span>
            <span className="font-semibold text-brand-text mt-0.5 block">
              {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'N/A'}
            </span>
          </div>
          <div className="rounded-xl border border-brand-border bg-white p-3 shadow-2xs">
            <span className="text-brand-muted block text-[11px] font-medium">BullMQ Job ID</span>
            <span className="font-mono text-brand-text mt-0.5 block truncate">
              {email.bullJobId || email.id}
            </span>
          </div>
        </div>

        {/* Error Message if Failed */}
        {email.errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">
              Execution Failure Log
            </span>
            <p className="mt-1 text-xs text-red-700 font-mono break-all">{email.errorMessage}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

