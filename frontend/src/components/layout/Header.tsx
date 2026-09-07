import React, { useState } from 'react';
import type { User } from '../../types';

export interface HeaderProps {
  user: User;
  onLogout: () => void;
  onComposeClick: () => void;
  onSearchFocus?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onComposeClick,
  onSearchFocus,
  onToggleMobileSidebar,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-white/90 backdrop-blur-md px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Sidebar Toggle & Search Input */}
        <div className="flex flex-1 items-center space-x-3 max-w-xl">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="rounded-lg p-2 text-brand-muted hover:bg-brand-cream hover:text-brand-text lg:hidden transition"
              title="Open Navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Search Input Bar with Ctrl K shortcut badge */}
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              onClick={onSearchFocus}
              placeholder="Search emails, campaigns, recipients..."
              className="w-full rounded-xl border border-brand-border bg-brand-cream-soft pl-9 pr-14 py-2 text-xs text-brand-text placeholder-brand-muted focus:border-brand-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/20 transition shadow-xs"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-brand-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-brand-muted shadow-2xs">
                <span>Ctrl</span>
                <span>K</span>
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Notifications, User Profile & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Notification Icon */}
          <button
            className="relative rounded-xl border border-brand-border bg-white p-2 text-brand-text hover:bg-brand-cream transition shadow-2xs"
            title="Notifications"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-gold" />
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2.5 rounded-xl border border-brand-border bg-white px-2.5 py-1.5 text-left hover:bg-brand-cream transition shadow-2xs"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-7 w-7 rounded-full object-cover border border-brand-border"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-brand-gold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left pr-1">
                <p className="text-xs font-semibold text-brand-text leading-tight">{user.name}</p>
                <p className="text-[10px] text-brand-muted leading-tight truncate max-w-[140px]">
                  {user.email}
                </p>
              </div>
              <svg
                className={`h-4 w-4 text-brand-muted transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-brand-border bg-white py-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-brand-border/60">
                  <p className="text-xs font-bold text-brand-text">{user.name}</p>
                  <p className="text-[11px] text-brand-muted truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onComposeClick();
                  }}
                  className="flex w-full items-center space-x-2 px-4 py-2 text-xs font-medium text-brand-text hover:bg-brand-cream transition"
                >
                  <svg className="h-4 w-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Compose Campaign</span>
                </button>
                <div className="my-1 border-t border-brand-border/60" />
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onLogout();
                  }}
                  className="flex w-full items-center space-x-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

