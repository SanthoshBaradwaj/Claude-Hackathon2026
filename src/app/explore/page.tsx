'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { useUnlockStatus } from '@/hooks/useUnlockStatus';
import type { Prompt, Article } from '@/types';

type PromptWithArticle = Prompt & { article: Article | null };

interface TopCluster {
  label: string;
  percentage: number;
  cluster_index: number;
}

const CLUSTER_COLORS = ['#7c6aff', '#2dd4bf', '#ff6b6b'];

export default function ExplorePage() {
  const { isUnlocked, responsesCount, loading: sessionLoading } = useSession();
  const { remaining } = useUnlockStatus(responsesCount, isUnlocked);

  const [prompts, setPrompts] = useState<PromptWithArticle[]>([]);
  const [topClusters, setTopClusters] = useState<Map<string, TopCluster>>(new Map());
  const [fetching, setFetching] = useState(true);
  const [confettiFired, setConfettiFired] = useState(false);

  // ── One-time confetti burst ────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('pulse_confetti_fired')) return;

    // Slight delay so the banner is visible first
    const t = setTimeout(() => {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 160,
          spread: 75,
          origin: { y: 0.45 },
          colors: ['#7c6aff', '#2dd4bf', '#ff6b6b', '#ffffff', '#a78bfa'],
          ticks: 200,
        });
        // Second burst from left
        setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.5 },
            colors: ['#7c6aff', '#2dd4bf'],
          });
        }, 150);
        // Third burst from right
        setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.5 },
            colors: ['#ff6b6b', '#ffffff'],
          });
        }, 300);
      });
      sessionStorage.setItem('pulse_confetti_fired', 'true');
      setConfettiFired(true);
    }, 400);

    return () => clearTimeout(t);
  }, []);

  // ── Fetch prompts + clusters ────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: promptData } = await supabase
        .from('prompts')
        .select('*, article:articles(*)')
        .in('safety_category', ['safe', 'sensitive'])
        .order('created_at', { ascending: false })
        .limit(20);

      const prompts = (promptData as PromptWithArticle[]) || [];
      setPrompts(prompts);

      if (prompts.length === 0) {
        setFetching(false);
        return;
      }

      // Fetch top cluster per prompt
      const { data: clusterData } = await supabase
        .from('clusters')
        .select('prompt_id, label, percentage, cluster_index')
        .in('prompt_id', prompts.map((p) => p.id))
        .order('percentage', { ascending: false });

      const map = new Map<string, TopCluster>();
      for (const c of clusterData ?? []) {
        if (!map.has(c.prompt_id)) {
          map.set(c.prompt_id, {
            label: c.label,
            percentage: c.percentage,
            cluster_index: c.cluster_index,
          });
        }
      }
      setTopClusters(map);
      setFetching(false);
    }

    load();
  }, []);

  // ── Redirect if not unlocked ────────────────────────────────
  if (!sessionLoading && !isUnlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#08080f] px-4 text-center">
        <p className="font-display text-2xl text-white">Not yet unlocked</p>
        <p className="text-sm text-white/35">
          {remaining} more response{remaining !== 1 ? 's' : ''} needed.
        </p>
        <Link href="/" className="mt-2 text-sm text-[#7c6aff] hover:underline">
          ← Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background orbs */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-[-10%] right-[-5%] h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#08080f]/60 px-5 py-4 backdrop-blur-md">
        <span className="font-display text-xl font-bold tracking-[0.3em] text-white">PULSE</span>
        <Link href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          ← Feed
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">

        {/* ── Unlock banner ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 overflow-hidden rounded-2xl border border-[#2dd4bf]/20 bg-gradient-to-r from-[#7c6aff]/10 to-[#2dd4bf]/10 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#2dd4bf]">
                ✦ Unlocked
              </p>
              <h1 className="font-display text-2xl text-white sm:text-3xl">
                You've unlocked the opinion map
              </h1>
              <p className="mt-2 text-sm text-white/40">
                See where the collective stands on every story below.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Prompt cards ──────────────────────────────────── */}
        {fetching ? (
          <div className="flex flex-col gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-52 rounded-2xl" />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center">
            <p className="text-white/30">No prompts yet.</p>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-5"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden"
            animate="show"
          >
            {prompts.map((prompt) => (
              <motion.div
                key={prompt.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
                }}
              >
                <ExploreCard
                  prompt={prompt}
                  topCluster={topClusters.get(prompt.id) ?? null}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

/* ── Explore card ─────────────────────────────────────────────── */
function ExploreCard({
  prompt,
  topCluster,
}: {
  prompt: PromptWithArticle;
  topCluster: TopCluster | null;
}) {
  const article = prompt.article;
  const clusterColor = topCluster
    ? CLUSTER_COLORS[topCluster.cluster_index % CLUSTER_COLORS.length]
    : '#7c6aff';

  return (
    <Link href={`/results/${prompt.id}`} className="group block">
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
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(135deg, ${clusterColor}30 0%, rgba(45,212,191,0.08) 100%)`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-[#08080f]/40" />
        </div>

        {/* Content column */}
        <div className="flex flex-1 flex-col justify-between p-6">
          <div>
            {/* Tags */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {article?.source && (
                <span className="rounded-full bg-[#7c6aff]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#7c6aff]">
                  {article.source}
                </span>
              )}
              {topCluster && (
                <span
                  className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{
                    backgroundColor: `${clusterColor}15`,
                    color: clusterColor,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: clusterColor }}
                  />
                  {topCluster.label}
                </span>
              )}
            </div>

            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-white/35">
              {prompt.neutral_summary}
            </p>

            <h2 className="font-display text-xl leading-snug text-white sm:text-2xl">
              {prompt.balanced_prompt}
            </h2>
          </div>

          <div className="mt-5 flex items-center text-sm font-medium text-[#2dd4bf] transition-colors duration-200 group-hover:text-white">
            View results
            <span className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
