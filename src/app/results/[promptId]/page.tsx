'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSession } from '@/hooks/useSession';
import { useUnlockStatus } from '@/hooks/useUnlockStatus';

import { CLUSTER_PALETTE, NOISE_CLUSTER_INDEX } from '@/lib/constants';

/* ── Types ──────────────────────────────────────────────────── */
interface ClusterDist {
  id: string;
  label: string;
  percentage: number;
  color: string;
  isUser: boolean;
  isNoise: boolean;
}

interface ResultsData {
  clusters: { id: string; label: string; member_count: number; percentage: number; cluster_index: number }[];
  userCluster: { id: string; label: string; percentage: number; cluster_index: number } | null;
  distribution: ClusterDist[];
  voices: {
    similar: string[];
    opposing: string[];
    middle: string[];
    opposingLabel: string | null;
    middleLabel: string | null;
  };
}

/* ── Page ────────────────────────────────────────────────────── */
export default function ResultsPage() {
  const { promptId } = useParams() as { promptId: string };
  const router = useRouter();
  const { userId, isUnlocked, responsesCount, loading: sessionLoading } = useSession();
  const { remaining } = useUnlockStatus(responsesCount, isUnlocked);

  const [data, setData] = useState<ResultsData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  // ── Entrance: black flash then reveal ──────────────────────
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 500);
    return () => clearTimeout(t);
  }, []);

  // ── Redirect if not unlocked ────────────────────────────────
  useEffect(() => {
    if (!sessionLoading && !isUnlocked) {
      router.push('/');
    }
  }, [sessionLoading, isUnlocked, router]);

  // ── Fetch results ───────────────────────────────────────────
  useEffect(() => {
    if (sessionLoading || !userId) return;

    fetch(`/api/results/${promptId}?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setFetching(false);
      })
      .catch(() => {
        setError('Failed to load results');
        setFetching(false);
      });
  }, [promptId, userId, sessionLoading]);

  /* ── Render states ─────────────────────────────────────────── */
  if (sessionLoading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7c6aff] border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#08080f] text-center px-4">
        <p className="text-white/40">{error || 'No results available yet.'}</p>
        {remaining > 0 && (
          <p className="text-sm text-white/25">
            {remaining} more response{remaining !== 1 ? 's' : ''} needed to unlock.
          </p>
        )}
        <Link href="/" className="mt-2 text-sm text-[#7c6aff] hover:underline">
          ← Back to feed
        </Link>
      </div>
    );
  }

  const { userCluster, distribution, voices } = data;
  const isNoise = userCluster?.cluster_index === NOISE_CLUSTER_INDEX;
  const userColorIndex = !userCluster
    ? 0
    : isNoise
    ? CLUSTER_PALETTE.length - 1
    : userCluster.cluster_index % (CLUSTER_PALETTE.length - 1);
  const userColor = CLUSTER_PALETTE[userColorIndex];

  return (
    <div className="relative min-h-screen bg-[#08080f] pb-32">

      {/* ── Black entrance overlay ────────────────────────────── */}
      <AnimatePresence>
        {!revealed && (
          <motion.div
            key="overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-[100] bg-black"
          />
        )}
      </AnimatePresence>

      {/* ── Subtle background orb ────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${userColor}22 0%, transparent 65%)`,
          filter: 'blur(60px)',
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative z-10"
      >
        {/* ── Back link ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-6">
          <Link href="/" className="text-sm text-white/30 hover:text-white/60 transition-colors">
            ← Feed
          </Link>
          <Link
            href="/explore"
            className="text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            Explore all →
          </Link>
        </div>

        {/* ── Section 1: Cluster reveal ─────────────────────── */}
        <section className="mx-auto max-w-2xl px-5 pt-14 pb-10 text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 8 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/30"
          >
            {!userCluster ? 'Opinion landscape' : isNoise ? "You're an" : 'You are a'}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: revealed ? 1 : 0, scale: revealed ? 1 : 0.8 }}
            transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
            className="font-display mb-4 text-5xl leading-tight sm:text-6xl lg:text-7xl"
            style={{ color: userColor }}
          >
            {!userCluster
              ? 'Collective Views'
              : isNoise
              ? 'Independent Thinker'
              : userCluster.label}
          </motion.h1>

          {userCluster && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: revealed ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="text-base text-white/35"
            >
              alongside{' '}
              <span className="text-white/60 font-medium">
                {Math.round(userCluster.percentage)}%
              </span>{' '}
              of respondents
            </motion.p>
          )}
        </section>

        {/* ── Divider ──────────────────────────────────────────── */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: revealed ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="mx-auto mb-10 h-px max-w-2xl origin-left bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />

        {/* ── Section 2: Distribution chart ────────────────────── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="mx-auto mb-12 max-w-2xl px-5"
        >
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/30">
            Opinion distribution
          </h2>

          <div className="space-y-4">
            {distribution.map((cluster, i) => (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: revealed ? 1 : 0, x: revealed ? 0 : -16 }}
                transition={{ duration: 0.5, delay: 1.2 + i * 0.2, ease: 'easeOut' }}
                className="flex items-center gap-4"
              >
                {/* Label */}
                <div className="w-44 shrink-0 text-right">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: cluster.isUser ? cluster.color : 'rgba(255,255,255,0.45)' }}
                  >
                    {cluster.label}
                    {cluster.isUser && (
                      <span className="ml-1 text-xs opacity-70"> ← you</span>
                    )}
                  </span>
                </div>

                {/* Recharts BarChart per row */}
                <div className="h-8 flex-1">
                  <ResponsiveContainer width="100%" height={32}>
                    <BarChart
                      layout="vertical"
                      data={[{ pct: cluster.percentage }]}
                      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        hide
                      />
                      <Bar
                        dataKey="pct"
                        radius={[0, 4, 4, 0]}
                        animationBegin={0}
                        animationDuration={900}
                        isAnimationActive={revealed}
                      >
                        <Cell fill={cluster.color} opacity={cluster.isUser ? 1 : 0.45} />
                      </Bar>
                      <Tooltip
                        cursor={false}
                        content={() => null}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Percentage */}
                <span className="w-10 text-right text-sm text-white/40">
                  {cluster.percentage}%
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Section 3: Voice cards ────────────────────────────── */}
        <div className="mx-auto max-w-2xl space-y-10 px-5">

          {/* Similar Voices */}
          {voices.similar.length > 0 && (
            <VoiceSection
              title="Similar voices"
              subtitle="Others who see it like you"
              quotes={voices.similar}
              accentColor={userColor}
              revealed={revealed}
              delay={1.8}
            />
          )}

          {/* Opposing Views */}
          {voices.opposing.length > 0 && (
            <VoiceSection
              title="Opposing views"
              subtitle={voices.opposingLabel ?? 'The other side'}
              quotes={voices.opposing}
              accentColor="#ff6b6b"
              revealed={revealed}
              delay={2.1}
            />
          )}

          {/* Middle Ground */}
          {voices.middle.length > 0 && (
            <VoiceSection
              title="The middle ground"
              subtitle={voices.middleLabel ?? 'Nuanced takes'}
              quotes={voices.middle}
              accentColor="rgba(255,255,255,0.2)"
              revealed={revealed}
              delay={2.4}
            />
          )}
        </div>
      </motion.div>

      {/* ── Fixed bottom CTA ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 16 }}
        transition={{ duration: 0.5, delay: 2.0 }}
        className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4"
      >
        <Link
          href="/explore"
          className="flex items-center gap-2 rounded-full bg-[#7c6aff] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(124,106,255,0.4)] transition-all hover:scale-105 hover:shadow-[0_6px_32px_rgba(124,106,255,0.5)]"
        >
          Explore all topics
          <span className="text-base">→</span>
        </Link>
      </motion.div>
    </div>
  );
}

/* ── Voice section component ──────────────────────────────────── */
function VoiceSection({
  title,
  subtitle,
  quotes,
  accentColor,
  revealed,
  delay,
}: {
  title: string;
  subtitle: string;
  quotes: string[];
  accentColor: string;
  revealed: boolean;
  delay: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 20 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-white/20">{subtitle}</p>
      </div>

      <motion.div
        className="space-y-3"
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        animate={revealed ? 'show' : 'hidden'}
      >
        {quotes.map((quote, i) => (
          <motion.blockquote
            key={i}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show:  { opacity: 1, y: 0, transition: { duration: 0.4, delay: delay + i * 0.1 } },
            }}
            className="rounded-xl border bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-white/55"
            style={{ borderColor: `${accentColor}40`, borderLeftWidth: '3px', borderLeftColor: accentColor }}
          >
            "{quote}"
          </motion.blockquote>
        ))}
      </motion.div>
    </motion.section>
  );
}
