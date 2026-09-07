import React from 'react';
import { api } from '../../lib/api';

export const LoginPage: React.FC = () => {
  const googleAuthUrl = api.getGoogleAuthUrl();

  return (
    <div className="flex min-h-screen w-full bg-brand-cream-soft">
      {/* LEFT: Deep Black Branded Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-black p-12 text-white relative overflow-hidden dark-gold-wave-bg border-r border-brand-border-dark">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark text-brand-black font-serif font-bold text-xl shadow-md">
            R
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-sans font-bold text-2xl tracking-tight text-white">ReachInbox</span>
            <span className="rounded-md border border-brand-gold/40 bg-brand-gold/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-gold">
              PRO
            </span>
          </div>
        </div>

        {/* Hero Tagline & Features List */}
        <div className="space-y-8 z-10 max-w-lg my-auto">
          <div>
            <h1 className="text-4xl font-bold font-serif leading-tight text-white tracking-tight">
              Scale your <br />
              <span className="text-brand-gold">outreach smarter.</span>
            </h1>
            <p className="mt-3 text-sm text-slate-400 font-sans leading-relaxed">
              Enterprise email scheduling, per-sender rate limiting, and BullMQ queue management platform.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold font-bold">
                ✓
              </div>
              <span>Distributed hourly & per-sender rate limiting</span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold font-bold">
                ✓
              </div>
              <span>BullMQ delayed job queue with zero cron reliance</span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold font-bold">
                ✓
              </div>
              <span>Elasticsearch full-text email cluster index</span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold font-bold">
                ✓
              </div>
              <span>Automated Slack workspace rate-limit alerts</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-slate-500 z-10">
          ReachInbox • Reliable. Fast. Effortless.
        </div>

        {/* Decorative Gold Graphic Accent */}
        <div className="absolute -right-16 -bottom-16 w-96 h-96 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-brand-gold">
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.5" fill="none" />
            <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="0.5" fill="none" />
          </svg>
        </div>
      </div>

      {/* RIGHT: White/Cream Login Card */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8 rounded-3xl border border-brand-border bg-white p-8 sm:p-10 shadow-xl">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex lg:hidden h-12 w-12 items-center justify-center rounded-full bg-brand-black text-brand-gold font-serif font-bold text-xl mb-4 shadow-sm">
              R
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-brand-text tracking-tight">
              Welcome to ReachInbox
            </h2>
            <p className="mt-2 text-xs text-brand-muted">
              Sign in to continue to your outreach workspace
            </p>
          </div>

          {/* Login CTA Button */}
          <div className="space-y-4 pt-2">
            <a
              href={googleAuthUrl}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-black px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-black-card focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2 active:scale-[0.99]"
            >
              <svg className="h-5 w-5 fill-current text-white" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>

          {/* Security Subtext */}
          <p className="text-center text-[11px] text-brand-muted pt-2 leading-relaxed">
            Protected by JWT HTTP-only cookie authentication & tenant isolation.
          </p>
        </div>
      </div>
    </div>
  );
};

