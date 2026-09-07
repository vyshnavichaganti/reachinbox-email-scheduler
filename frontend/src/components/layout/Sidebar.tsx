import React from 'react';
import type { TabId } from './NavTabs';

export interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onComposeClick: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onSettingsClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onComposeClick,
  isOpenMobile = false,
  onCloseMobile,
  onSettingsClick,
}) => {
  const navItems: { id: TabId | 'compose' | 'settings'; label: string; icon: React.ReactNode }[] = [
    {
      id: 'compose',
      label: 'Compose Email',
      icon: (
        <svg className="h-4 w-4 transform -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
    },
    {
      id: 'scheduled',
      label: 'Scheduled Emails',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
        </svg>
      ),
    },
    {
      id: 'sent',
      label: 'Sent Emails',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'slack',
      label: 'Slack / Integrations',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleNavClick = (id: TabId | 'compose' | 'settings') => {
    if (id === 'compose') {
      onComposeClick();
    } else if (id === 'settings') {
      if (onSettingsClick) onSettingsClick();
    } else {
      onTabChange(id);
    }
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-brand-black/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-[260px] flex-col justify-between bg-brand-black border-r border-brand-border-dark text-white transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Brand Logo */}
        <div>
          <div className="flex items-center justify-between px-6 py-6 border-b border-brand-border-dark/60">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark text-brand-black font-serif font-bold text-base shadow-sm">
                R
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-sans font-bold text-lg tracking-tight text-white">ReachInbox</span>
                <span className="rounded-md border border-brand-gold/40 bg-brand-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
                  PRO
                </span>
              </div>
            </div>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="rounded-lg p-1 text-slate-400 hover:text-white lg:hidden"
              >
                ✕
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 px-4 py-6">
            {navItems.map((item) => {
              const isCompose = item.id === 'compose';
              const isActive = activeTab === item.id && !isCompose;

              if (isCompose) {
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className="group flex w-full items-center space-x-3 rounded-xl bg-gradient-to-r from-brand-cream to-[#EADFCB] px-4 py-3 text-sm font-semibold text-brand-black shadow-md hover:brightness-105 active:scale-[0.99] transition mb-4"
                  >
                    <span className="text-brand-black group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center space-x-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-cream text-brand-black font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-brand-black-subtle hover:text-slate-100'
                  }`}
                >
                  <span className={isActive ? 'text-brand-gold-dark' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Promotional Card */}
        <div className="p-4">
          <div className="relative overflow-hidden rounded-2xl border border-brand-gold/20 bg-gradient-to-b from-[#141412] to-[#0E0E0D] p-4 text-left shadow-lg dark-gold-wave-bg">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-brand-gold mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-white tracking-tight">Scale your</h4>
            <h4 className="text-sm font-bold text-brand-gold tracking-tight">outreach smarter.</h4>
            <p className="mt-2 text-xs text-slate-400 font-sans">Reliable. Fast. Effortless.</p>

            {/* Subtle decorative gold wave accent */}
            <div className="absolute right-0 bottom-0 top-0 w-24 opacity-20 pointer-events-none">
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-brand-gold">
                <path d="M0,50 Q25,30 50,50 T100,50" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M0,70 Q25,50 50,70 T100,70" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
