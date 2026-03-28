import type { Metadata } from 'next';
import { DM_Serif_Display, Outfit } from 'next/font/google';
import './globals.css';
import { OnboardingGuard } from '@/components/OnboardingGuard';

const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pulse — Collective Opinion Engine',
  description: 'Read news. Share your take. Discover where you stand.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${outfit.variable} h-full`}>
      <body className="min-h-full bg-[#08080f] text-[#f0f0ff] antialiased">
        <OnboardingGuard>{children}</OnboardingGuard>
      </body>
    </html>
  );
}
