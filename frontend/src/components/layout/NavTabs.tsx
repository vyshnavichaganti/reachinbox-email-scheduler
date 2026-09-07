import React from 'react';

export type TabId = 'scheduled' | 'sent' | 'search' | 'slack';

export interface NavTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  scheduledCount?: number;
}

export const NavTabs: React.FC<NavTabsProps> = ({
  activeTab,
  onTabChange,
  scheduledCount,
}) => {
  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'scheduled',
      label: 'Scheduled Emails',
      count: scheduledCount,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 'sent',
      label: 'Sent Emails',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      id: 'slack',
      label: 'Slack / Integrations',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="border-b border-slate-800/80 bg-slate-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group inline-flex items-center space-x-2 border-b-2 py-4 px-1 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
