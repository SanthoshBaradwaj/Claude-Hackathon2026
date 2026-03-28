'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const PHRASES = [
  'Analyzing your perspective...',
  'Mapping the opinion landscape...',
  'Finding your people...',
] as const;

const PHRASE_DURATION = 2200;   // ms per phrase
const FADE_DURATION   = 280;    // ms cross-fade
const MIN_DISPLAY     = 3000;   // hard minimum on screen

function AnalyzingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const promptId = searchParams.get('promptId');

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // phrase cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, FADE_DURATION);
    }, PHRASE_DURATION);
    return () => clearInterval(interval);
  }, []);

  // main processing + redirect
  const didRun = useRef(false);
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (!promptId) {
      router.push('/');
      return;
    }

    const minWait = new Promise<void>((r) => setTimeout(r, MIN_DISPLAY));

    const processing = fetch('/api/clusters/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId }),
    }).catch(() => {}); // fire-and-forget — route may not exist yet in Phase 2

    Promise.all([processing, minWait]).then(() => {
      router.push(`/results/${promptId}`);
    });
  }, [promptId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080f]">
      <div className="relative flex h-64 w-64 items-center justify-center">

        {/* Morphing blob */}
        <div
          aria-hidden
          className="animate-blob-morph absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #7c6aff 0%, #2dd4bf 100%)',
            opacity: 0.38,
          }}
        />

        {/* Inner glow ring */}
        <div
          aria-hidden
          className="animate-blob-morph absolute inset-4"
          style={{
            background: 'linear-gradient(135deg, #9d8fff 0%, #5ee8d6 100%)',
            opacity: 0.15,
            animationDelay: '-2s',
            animationDuration: '6s',
          }}
        />

        {/* Cycling phrase */}
        <p
          key={phraseIndex}
          className="font-display relative z-10 px-6 text-center text-xl text-white sm:text-2xl"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(6px)',
            transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
          }}
        >
          {PHRASES[phraseIndex]}
        </p>
      </div>
    </div>
  );
}

// useSearchParams requires Suspense in Next.js App Router
export default function AnalyzingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#08080f]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7c6aff] border-t-transparent" />
        </div>
      }
    >
      <AnalyzingContent />
    </Suspense>
  );
}
