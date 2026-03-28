'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

interface BreakdownValue {
  value: string;
  count: number;
  percentage: number;
}
interface BreakdownDimension {
  dimension: string;
  values: BreakdownValue[];
}
interface ClusterBreakdown {
  clusterId: string;
  dimensions: BreakdownDimension[];
}

interface ResultsData {
  clusters: { id: string; label: string; member_count: number; percentage: number; cluster_index: number }[];
  userCluster: { id: string; label: string; percentage: number; cluster_index: number } | null;
  distribution: ClusterDist[];
  breakdowns: ClusterBreakdown[];
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

  const { userCluster, distribution, voices, breakdowns = [], clusters } = data;
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
                      <XAxis type="number" domain={[0, 100]} hide />
                      <Bar
                        dataKey="pct"
                        radius={[0, 4, 4, 0]}
                        animationBegin={0}
                        animationDuration={900}
                        isAnimationActive={revealed}
                      >
                        <Cell fill={cluster.color} opacity={cluster.isUser ? 1 : 0.45} />
                      </Bar>
                      <Tooltip cursor={false} content={() => null} />
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

        {/* ── Section 4: Demographic breakdown ─────────────────── */}
        <DemographicBreakdown
          distribution={distribution}
          breakdowns={breakdowns}
          clusters={clusters}
          revealed={revealed}
        />

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

/* ── Demographic breakdown section ────────────────────────────── */

const DIMENSIONS = [
  { key: 'age_band',   label: 'Age' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'education',  label: 'Education' },
  { key: 'location',   label: 'Location' },
  { key: 'gender',     label: 'Gender' },
] as const;

const AGE_SORT_ORDER = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'];

type ChartPoint = { name: string } & { [key: string]: string | number };

function getBreakdownPct(
  breakdowns: ClusterBreakdown[],
  clusterId: string,
  dimension: string,
  value: string
): number {
  const b = breakdowns.find((bd) => bd.clusterId === clusterId);
  const dim = b?.dimensions.find((d) => d.dimension === dimension);
  return dim?.values.find((v) => v.value === value)?.percentage ?? 0;
}

function buildChartData(
  distribution: ClusterDist[],
  breakdowns: ClusterBreakdown[],
  dimension: string
): ChartPoint[] {
  const allValues = new Set<string>();
  for (const b of breakdowns) {
    const dim = b.dimensions.find((d) => d.dimension === dimension);
    if (dim) dim.values.forEach((v) => allValues.add(v.value));
  }

  let values = [...allValues];

  if (dimension === 'age_band') {
    values.sort((a, b) => {
      const ai = AGE_SORT_ORDER.indexOf(a);
      const bi = AGE_SORT_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  } else {
    values.sort();
  }

  return values
    .map((val) => {
      const point: ChartPoint = { name: val };
      for (const cluster of distribution) {
        point[cluster.label] = parseFloat(
          getBreakdownPct(breakdowns, cluster.id, dimension, val).toFixed(1)
        );
      }
      return point;
    })
    .filter((point) => distribution.some((c) => (point[c.label] as number) > 0));
}

function computeInsight(chartData: ChartPoint[], distribution: ClusterDist[]): string | null {
  if (chartData.length === 0 || distribution.length < 2) return null;

  let maxDiff = 0;
  let best: { name: string; top: string; second: string; diff: number } | null = null;

  for (const point of chartData) {
    const ranked = distribution
      .map((c) => ({ label: c.label, pct: (point[c.label] as number) ?? 0 }))
      .sort((a, b) => b.pct - a.pct);

    if (ranked[0].pct === 0) continue;
    const diff = ranked[0].pct - (ranked[1]?.pct ?? 0);
    if (diff > maxDiff) {
      maxDiff = diff;
      best = { name: point.name, top: ranked[0].label, second: ranked[1]?.label ?? '', diff };
    }
  }

  if (!best || best.diff < 5) return null;
  return `${best.name} respondents lean ${best.top} by ${Math.round(best.diff)}pp vs ${best.second}`;
}

function shouldShowGender(breakdowns: ClusterBreakdown[], totalMembers: number): boolean {
  let genderCount = 0;
  for (const b of breakdowns) {
    const dim = b.dimensions.find((d) => d.dimension === 'gender');
    if (dim) genderCount += dim.values.reduce((s, v) => s + v.count, 0);
  }
  return totalMembers > 0 && genderCount / totalMembers > 0.3;
}

function DemoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const relevant = payload.filter((e) => e.value > 0);
  if (!relevant.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d1a]/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-2 font-medium text-white/50">{label}</p>
      {relevant.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: entry.fill }}
          />
          <span className="text-white/65">
            Cluster: {entry.dataKey} — {entry.value.toFixed(1)}% of this cluster are {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function DemographicBreakdown({
  distribution,
  breakdowns,
  clusters,
  revealed,
}: {
  distribution: ClusterDist[];
  breakdowns: ClusterBreakdown[];
  clusters: { id: string; member_count: number }[];
  revealed: boolean;
}) {
  const [activeDim, setActiveDim] = useState<string>('age_band');

  const totalMembers = useMemo(
    () => clusters.reduce((s, c) => s + c.member_count, 0),
    [clusters]
  );

  const showGender = useMemo(
    () => shouldShowGender(breakdowns, totalMembers),
    [breakdowns, totalMembers]
  );

  const availableDims = DIMENSIONS.filter((d) => d.key !== 'gender' || showGender);

  // Keep activeDim valid if dimensions change
  const currentDim = availableDims.some((d) => d.key === activeDim)
    ? activeDim
    : (availableDims[0]?.key ?? 'age_band');

  const chartData = useMemo(
    () => buildChartData(distribution, breakdowns, currentDim),
    [distribution, breakdowns, currentDim]
  );

  const insight = useMemo(
    () => computeInsight(chartData, distribution),
    [chartData, distribution]
  );

  if (!breakdowns.length || distribution.length === 0) return null;
  if (chartData.length === 0 && availableDims.every(
    (d) => buildChartData(distribution, breakdowns, d.key).length === 0
  )) return null;

  const minChartWidth = Math.max(380, chartData.length * 90);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 20 }}
      transition={{ duration: 0.5, delay: 2.8 }}
      className="mx-auto mb-12 mt-12 max-w-2xl px-5"
    >
      <h2 className="font-display mb-6 text-2xl text-white sm:text-3xl">
        Who thinks this way?
      </h2>

      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">

        {/* Dimension toggle bar */}
        <div className="mb-5 flex flex-wrap gap-2">
          {availableDims.map((d) => (
            <button
              key={d.key}
              onClick={() => setActiveDim(d.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                currentDim === d.key
                  ? 'bg-[#7c6aff] text-white shadow-[0_2px_12px_rgba(124,106,255,0.35)]'
                  : 'border border-white/10 text-white/45 hover:border-white/20 hover:text-white/65'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {chartData.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/25">
            No {availableDims.find((d) => d.key === currentDim)?.label.toLowerCase()} data yet
          </p>
        ) : (
          <>
            {/* Chart — horizontally scrollable on mobile */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: minChartWidth }}>
                <ResponsiveContainer key={currentDim} width="100%" height={220}>
                  <BarChart
                    data={chartData}
                    barGap={2}
                    barCategoryGap="22%"
                    margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                      domain={[0, 'dataMax + 10']}
                    />
                    <Tooltip
                      content={<DemoTooltip />}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    {distribution.map((cluster) => (
                      <Bar
                        key={cluster.id}
                        dataKey={cluster.label}
                        fill={cluster.color}
                        opacity={0.85}
                        radius={[3, 3, 0, 0]}
                        animationBegin={0}
                        animationDuration={600}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Custom legend */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {distribution.map((cluster) => (
                <div key={cluster.id} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: cluster.color }}
                  />
                  <span className="text-xs text-white/40">{cluster.label}</span>
                </div>
              ))}
            </div>

            {/* Insight callout */}
            {insight && (
              <div className="mt-4 rounded-xl border-l-[3px] border-[#7c6aff] bg-[#7c6aff]/5 px-4 py-3">
                <p className="text-sm leading-relaxed text-white/60">{insight}</p>
              </div>
            )}
          </>
        )}
      </div>
    </motion.section>
  );
}
