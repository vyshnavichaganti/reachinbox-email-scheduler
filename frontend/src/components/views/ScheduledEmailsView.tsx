import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Email, Pagination as PaginationType } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Pagination } from '../ui/Pagination';
import { EmailDetailsModal } from './EmailDetailsModal';

export interface ScheduledEmailsViewProps {
  onComposeClick: () => void;
  refreshTrigger?: number;
}

export const ScheduledEmailsView: React.FC<ScheduledEmailsViewProps> = ({
  onComposeClick,
  refreshTrigger = 0,
}) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchEmails = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getScheduledEmails(page, 20);
      setEmails(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails(pagination.page);
  }, [refreshTrigger]);

  const handleCancelEmail = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelEmail(id);
      setSelectedEmail(null);
      fetchEmails(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel email');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading && emails.length === 0) {
    return <LoadingSpinner label="Fetching scheduled queue..." />;
  }

  if (error && emails.length === 0) {
    return <ErrorState message={error} onRetry={() => fetchEmails(1)} />;
  }

  if (!loading && emails.length === 0) {
    return (
      <EmptyState
        title="No scheduled emails yet"
        description="Schedule a bulk email batch or individual message to begin queuing emails."
        actionLabel="Compose New Email"
        onAction={onComposeClick}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-brand-text tracking-tight">
            Scheduled Emails
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Manage upcoming email delivery jobs queued for delayed send & hourly limits.
          </p>
        </div>
        <Button
          onClick={() => fetchEmails(pagination.page)}
          variant="secondary"
          size="sm"
          isLoading={loading}
          className="shadow-2xs"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Luxury White Data Table Card */}
      <div className="overflow-hidden rounded-3xl border border-brand-border bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-brand-border bg-brand-cream-soft uppercase tracking-wider text-brand-muted font-bold">
              <tr>
                <th className="px-6 py-4">RECIPIENT</th>
                <th className="px-6 py-4">SUBJECT</th>
                <th className="px-6 py-4">SCHEDULED TIME</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4">SENDER</th>
                <th className="px-6 py-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60 text-brand-text">
              {emails.map((email) => (
                <tr
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="cursor-pointer hover:bg-brand-cream/40 transition group"
                >
                  <td className="px-6 py-4 font-semibold text-brand-text max-w-[200px] truncate">
                    {email.recipient}
                  </td>
                  <td className="px-6 py-4 font-medium text-brand-text max-w-[260px] truncate group-hover:text-brand-gold-dark transition">
                    {email.subject}
                  </td>
                  <td className="px-6 py-4 text-brand-muted whitespace-nowrap">
                    {new Date(email.scheduledAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge status={email.status} />
                  </td>
                  <td className="px-6 py-4 text-brand-muted font-mono text-[11px] truncate max-w-[140px]">
                    {email.senderId}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedEmail(email)}
                      className="rounded-xl border border-brand-border bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-text hover:bg-brand-cream transition shadow-2xs"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination pagination={pagination} onPageChange={(p) => fetchEmails(p)} />
      </div>

      <EmailDetailsModal
        email={selectedEmail}
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        onCancelEmail={handleCancelEmail}
        isCancelling={Boolean(cancellingId)}
      />
    </div>
  );
};

