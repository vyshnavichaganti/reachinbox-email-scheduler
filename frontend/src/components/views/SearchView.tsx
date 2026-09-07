import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Email, Pagination as PaginationType, Sender } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Input } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Pagination } from '../ui/Pagination';
import { Select } from '../ui/Select';
import { EmailDetailsModal } from './EmailDetailsModal';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [senderFilter, setSenderFilter] = useState('');
  const [senders, setSenders] = useState<Sender[]>([]);
  const [results, setResults] = useState<Email[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Fetch senders for filter dropdown
  useEffect(() => {
    api
      .getSenders()
      .then((res) => {
        if (res.data) setSenders(res.data);
      })
      .catch(() => {});
  }, []);

  const handleSearch = async (page = 1) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await api.searchEmails({
        q: query.trim() || undefined,
        status: statusFilter || undefined,
        senderId: senderFilter || undefined,
        page,
        limit: 20,
      });
      setResults(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || 'Elasticsearch search query failed');
    } finally {
      setLoading(false);
    }
  };

  // Initial load search
  useEffect(() => {
    handleSearch(1);
  }, [statusFilter, senderFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(1);
  };

  const senderOptions = [
    { value: '', label: 'All Senders' },
    ...senders.map((s) => ({ value: s.id, label: `${s.displayName} (${s.email})` })),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'SCHEDULED', label: 'SCHEDULED' },
    { value: 'PROCESSING', label: 'PROCESSING' },
    { value: 'SENT', label: 'SENT' },
    { value: 'FAILED', label: 'FAILED' },
    { value: 'CANCELLED', label: 'CANCELLED' },
  ];

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="border-b border-brand-border/60 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold font-serif text-brand-text tracking-tight">
          Elasticsearch Search
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">
          Full-text cluster query across email recipients, subject lines, and body content.
        </p>
      </div>

      {/* Filter & Search Form Card */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-brand-border bg-white p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <Input
              label="Search Query"
              placeholder="Search recipient, subject, or body content..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              label="Status Filter"
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              label="Sender Filter"
              options={senderOptions}
              value={senderFilter}
              onChange={(e) => setSenderFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-end space-x-3 pt-2">
          {(query || statusFilter || senderFilter) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('');
                setSenderFilter('');
              }}
              className="text-xs font-semibold text-brand-muted hover:text-brand-text transition"
            >
              Reset Filters
            </button>
          )}
          <Button type="submit" variant="primary" size="md" isLoading={loading}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Execute Search</span>
          </Button>
        </div>
      </form>

      {/* Search Results Section */}
      {loading ? (
        <LoadingSpinner label="Querying Elasticsearch cluster..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => handleSearch(1)} />
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          title="No emails found"
          description="No Elasticsearch index documents matched your query or selected filters."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-brand-muted px-1">
            <span>
              Returned <strong className="text-brand-text font-bold">{pagination.total}</strong> document matches
            </span>
            <span className="text-[11px] font-mono">Backend Index: <code className="text-brand-gold-dark font-bold">emails</code></span>
          </div>

          {/* Results Table */}
          <div className="overflow-hidden rounded-3xl border border-brand-border bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-brand-border bg-brand-cream-soft uppercase tracking-wider text-brand-muted font-bold">
                  <tr>
                    <th className="px-6 py-4">RECIPIENT</th>
                    <th className="px-6 py-4">SUBJECT</th>
                    <th className="px-6 py-4">SCHEDULED / EVENT TIME</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60 text-brand-text">
                  {results.map((email) => (
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

            <Pagination pagination={pagination} onPageChange={(p) => handleSearch(p)} />
          </div>
        </div>
      )}

      <EmailDetailsModal
        email={selectedEmail}
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
      />
    </div>
  );
};

