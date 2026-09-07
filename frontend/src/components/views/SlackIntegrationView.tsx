import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { SlackStatus } from '../../types';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export const SlackIntegrationView: React.FC = () => {
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSlackStatus();
      setSlackStatus(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Slack integration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.disconnectSlack();
      setSlackStatus({ connected: false });
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect Slack workspace');
    } finally {
      setDisconnecting(false);
    }
  };

  const connectUrl = api.getSlackConnectUrl();

  if (loading) {
    return <LoadingSpinner label="Checking Slack integration status..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchStatus} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="border-b border-brand-border/60 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold font-serif text-brand-text tracking-tight">
          Slack Integration
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">
          Get notified when your email sender reaches its hourly limit.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-brand-border bg-white p-6 shadow-xs sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-brand-border/60 pb-6">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.521A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.523v-2.521h2.52zM15.165 17.685a2.527 2.527 0 0 1-2.52-2.52 2.527 2.527 0 0 1 2.52-2.521h6.323A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.52h-6.313z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold font-serif text-brand-text">Slack Notifications</h3>
              <p className="text-xs text-brand-muted">OAuth 2.0 Web API Dispatcher</p>
            </div>
          </div>

          <div>
            {slackStatus?.connected ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected ✓
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                Not Connected
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {slackStatus?.connected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-border bg-brand-cream-soft p-4">
                <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
                  Connected Slack Workspace
                </span>
                <p className="mt-1 text-sm font-bold text-brand-text">
                  {slackStatus.teamName || 'Slack Workspace'}
                </p>
                <p className="mt-2 text-xs text-brand-muted leading-relaxed">
                  Rate-limit alerts are dispatched to this workspace automatically with Redis hourly window deduplication.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleDisconnect}
                  variant="danger"
                  size="sm"
                  isLoading={disconnecting}
                >
                  Disconnect Slack
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-brand-muted leading-relaxed">
                When your email sending rate exceeds hourly global or sender limits, our background worker triggers a Redis-deduplicated Slack alert so your team is informed immediately.
              </p>
              <div className="flex justify-start">
                <a
                  href={connectUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-purple-800"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
                  </svg>
                  <span>Connect Slack</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

