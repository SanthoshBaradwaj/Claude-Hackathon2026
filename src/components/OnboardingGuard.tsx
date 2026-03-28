'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Redirects new users (no existing session) to /onboarding if they haven't
 * completed it yet. Existing users who predate onboarding are let through.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/onboarding') return;
    const done = localStorage.getItem('pulse_onboarding_complete');
    if (done === 'true') return;
    // Only redirect truly new users — existing users have a stored session
    const hasSession = Boolean(localStorage.getItem('pulse_session_id'));
    if (!hasSession) {
      router.replace('/onboarding');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
