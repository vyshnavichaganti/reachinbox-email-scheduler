'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import type { TabId } from '../components/layout/NavTabs';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { ComposeModal } from '../components/views/ComposeModal';
import { LoginPage } from '../components/views/LoginPage';
import { ScheduledEmailsView } from '../components/views/ScheduledEmailsView';
import { SearchView } from '../components/views/SearchView';
import { SentEmailsView } from '../components/views/SentEmailsView';
import { SlackIntegrationView } from '../components/views/SlackIntegrationView';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const checkAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await api.getAuthMe();
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleScheduleSuccess = (count: number) => {
    setToastMessage(`${count} email${count === 1 ? '' : 's'} scheduled successfully.`);
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('scheduled');
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-black text-white">
        <LoadingSpinner label="Authenticating ReachInbox session..." />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-brand-white text-brand-text flex flex-col font-sans">
      {/* Deep Black Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onComposeClick={() => setIsComposeOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Main Workspace (Padded for Desktop Sidebar width 260px) */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-h-screen">
        {/* Top Header */}
        <Header
          user={user}
          onLogout={handleLogout}
          onComposeClick={() => setIsComposeOpen(true)}
          onSearchFocus={() => setActiveTab('search')}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Main View Content Area */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {activeTab === 'scheduled' && (
            <ScheduledEmailsView
              onComposeClick={() => setIsComposeOpen(true)}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'sent' && <SentEmailsView />}
          {activeTab === 'search' && <SearchView />}
          {activeTab === 'slack' && <SlackIntegrationView />}
        </main>

        {/* Subtle Footer */}
        <footer className="border-t border-brand-border/60 bg-brand-cream-soft px-6 py-4 text-xs text-brand-muted flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
          <div>
            <span className="font-semibold text-brand-text">ReachInbox</span> • Build relationships. Drive growth.
          </div>
          <div className="font-mono text-[11px]">v1.0.0</div>
        </footer>
      </div>

      {/* Compose & Schedule Campaign Modal */}
      {isComposeOpen && (
        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          currentUser={user}
          onScheduleSuccess={handleScheduleSuccess}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <Modal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          title="Account & Platform Settings"
          subtitle="Manage your ReachInbox sending defaults and workspace preferences."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-brand-text">
            <div className="rounded-2xl border border-brand-border bg-brand-cream-soft p-4 space-y-2">
              <span className="font-bold text-brand-text block">Workspace User ID</span>
              <p className="font-mono text-[11px] text-brand-muted">{user.id}</p>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white p-4 space-y-2">
              <span className="font-bold text-brand-text block">Authentication Type</span>
              <p className="text-brand-muted">Google OAuth 2.0 (JWT HTTP-Only Cookie)</p>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white p-4 space-y-2">
              <span className="font-bold text-brand-text block">Queue Worker Engine</span>
              <p className="text-brand-muted">BullMQ Redis Delayed Job Queue (Zero Cron)</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-xl border border-brand-border bg-brand-black px-4 py-2 font-semibold text-white shadow-2xs hover:bg-brand-black-card"
              >
                Close Settings
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Success / Info Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

