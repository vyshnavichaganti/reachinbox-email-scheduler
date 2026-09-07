import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ReachInbox | Premium B2B Email Outreach Platform',
  description: 'Enterprise email scheduling, bulk campaigns & delivery management for ReachInbox',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-brand-white text-brand-text font-sans antialiased selection:bg-brand-gold/30 selection:text-brand-black">
        {children}
      </body>
    </html>
  );
}

