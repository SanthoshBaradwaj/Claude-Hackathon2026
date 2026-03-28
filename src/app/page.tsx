'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useSession } from '@/hooks/useSession';
import { useUnlockStatus } from '@/hooks/useUnlockStatus';
import type { Prompt, Article } from '@/types';

type PromptWithArticle = Prompt & { article: Article | null; is_adjacent_fill: boolean };

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export default function Home() {
  const [prompts, setPrompts] = useState<PromptWithArticle[]>([]);
  const [fetching, setFetching] = useState(true);

  const { userId, isUnlocked, responsesCount, loading: sessionLoading } = useSession();
  const { remaining } = useUnlockStatus(responsesCount, isUnlocked);

  useEffect(() => {
    if (sessionLoading) return;

    // Fetch user's selected categories then load filtered feed
    async function loadFeed() {
      let categoriesParam = '';

      if (userId) {
        try {
          const profileRes = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: localStorage.getItem('pulse_session_id') }),
          });
          if (profileRes.ok) {
            const { user } = await profileRes.json();
            const cats: string[] = user?.selected_categories ?? [];
            if (cats.length > 0) {
              categoriesParam = `?categories=${cats.join(',')}`;
            }
          }
        } catch {
          // Non-fatal — fall back to all categories
        }
      }

      const res = await fetch(`/api/prompts${categoriesParam}`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(Array.isArray(data) ? data : []);
      }
      setFetching(false);
    }

    loadFeed();
  }, [sessionLoading, userId]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Background orbs ───────────────────────────────── */}
      <div
        aria-hidden
        className="animate-orb-drift pointer-events-none fixed top-[-15%] right-[-8%] h-[600px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(124,106,255,0.18) 0%, rgba(45,212,191,0.06) 55%, transparent 70%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        aria-hidden
        className="animate-orb-drift pointer-events-none fixed bottom-[-28%] left-[-8%] h-[520px] w-[520px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(45,212,191,0.12) 0%, rgba(124,106,255,0.05) 55%, transparent 70%)',
          filter: 'blur(64px)',
          animationDelay: '-9s',
          animationDuration: '22s',
        }}
      />

      {/* ── Sticky header ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#08080f]/60 px-5 py-4 backdrop-blur-md">
        <span className="font-display text-xl font-bold tracking-[0.3em] text-white">
          PULSE
        </span>

        {!sessionLoading && (
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              isUnlocked
                ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/10 text-[#2dd4bf]'
                : 'border-white/10 bg-white/5 text-white/50'
            }`}
          >
            {isUnlocked ? (
              <>
                <span>✦</span>
                <span>Unlocked — explore results</span>
              </>
            ) : (
              <>
                <span>🔒</span>
                <span>
                  {remaining} response{remaining !== 1 ? 's' : ''} to unlock
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="font-display mb-3 text-4xl text-white sm:text-5xl">
            What do you think?
          </h1>
          <p className="text-lg text-white/35">
            Share your perspective on today's news.{' '}
            {isUnlocked ? 'See where you stood.' : 'Unlock the collective view.'}
          </p>
        </motion.div>

        {fetching ? (
          <div className="flex flex-col gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-52 rounded-2xl" />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center">
            <p className="text-white/30">No prompts yet.</p>
            <p className="mt-2 text-sm text-white/20">
              POST /api/news/ingest → POST /api/prompts/generate to seed content.
            </p>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-5"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {prompts.map((prompt) => (
              <motion.div key={prompt.id} variants={cardVariants}>
                <PromptCard prompt={prompt} isUnlocked={isUnlocked} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

/* ── Prompt card ──────────────────────────────────────────────── */

function PromptCard({
  prompt,
  isUnlocked,
}: {
  prompt: PromptWithArticle;
  isUnlocked: boolean;
}) {
  const article = prompt.article;

  return (
    <Link href={`/prompt/${prompt.id}`} className="group block">
      <article className="glass flex overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1">
        {/* Image column */}
        <div className="relative w-[35%] min-h-[190px] flex-shrink-0 overflow-hidden">
          {article?.image_url ? (
            <Image
              src={article.image_url}
              alt={article.headline || ''}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 35vw, 300px"
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#7c6aff]/25 to-[#2dd4bf]/10" />
          )}
          {/* Right-edge fade into card */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-[#08080f]/40" />
        </div>

        {/* Content column */}
        <div className="flex flex-1 flex-col justify-between p-6">
          <div>
            {/* Tags row */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {article?.source && (
                <span className="rounded-full bg-[#7c6aff]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#7c6aff]">
                  {article.source}
                </span>
              )}
              {isUnlocked && (
                <span className="rounded-full bg-[#2dd4bf]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#2dd4bf]">
                  Results available
                </span>
              )}
              {prompt.is_adjacent_fill && article?.category && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white/30">
                  Related: {article.category}
                </span>
              )}
            </div>

            {/* Neutral summary */}
            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-white/35">
              {prompt.neutral_summary}
            </p>

            {/* Prompt question — display font */}
            <h2 className="font-display text-xl leading-snug text-white sm:text-2xl">
              {prompt.balanced_prompt}
            </h2>
          </div>

          {/* CTA */}
          <div className="mt-5 flex items-center text-sm font-medium text-[#7c6aff] transition-colors duration-200 group-hover:text-white">
            Share your take
            <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
