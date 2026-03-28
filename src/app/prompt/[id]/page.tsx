'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import type { Prompt, Article } from '@/types';

type PromptWithArticle = Prompt & { article: Article | null };

const MAX_CHARS = 500;

export default function PromptPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { userId, loading: sessionLoading } = useSession();

  const [prompt, setPrompt] = useState<PromptWithArticle | null>(null);
  const [fetching, setFetching] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase
      .from('prompts')
      .select('*, article:articles(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setPrompt(data as PromptWithArticle | null);
        setFetching(false);
      });
  }, [id]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return;
    setText(val);
    // Auto-expand height
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }

  async function handleSubmit() {
    if (!text.trim() || !userId || !prompt || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/responses/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          promptId: prompt.id,
          rawText: text.trim(),
          inputMethod: 'text',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      router.push(`/analyzing?promptId=${prompt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  /* ── Loading state ───────────────────────────────────── */
  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7c6aff] border-t-transparent" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080f]">
        <div className="text-center">
          <p className="text-white/30">Prompt not found.</p>
          <Link href="/" className="mt-4 block text-sm text-[#7c6aff] hover:underline">
            ← Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const article = prompt.article;
  const charPct = text.length / MAX_CHARS;

  return (
    <div className="min-h-screen bg-[#08080f]">

      {/* ── Blurred image header (top 40%) ───────────────── */}
      <div className="relative h-[40vh] w-full overflow-hidden">
        {article?.image_url ? (
          <>
            {/* Blurred background fill */}
            <Image
              src={article.image_url}
              alt=""
              fill
              className="scale-110 object-cover blur-sm"
              priority
              unoptimized
              aria-hidden
            />
            {/* Crisp centred image on top */}
            <Image
              src={article.image_url}
              alt={article.headline || ''}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#7c6aff]/35 to-[#2dd4bf]/15" />
        )}

        {/* Bottom gradient fade into page bg */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-[#08080f]" />

        {/* Back button */}
        <Link
          href="/"
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-sm font-medium text-white/70 backdrop-blur-sm transition-colors hover:text-white"
        >
          ← Back
        </Link>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-2xl -mt-6 px-4 pb-20 sm:px-6">

        {/* Source chip */}
        {article?.source && (
          <span className="inline-block rounded-full bg-[#7c6aff]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#7c6aff]">
            {article.source}
          </span>
        )}

        {/* Article headline (context line) */}
        {article?.headline && (
          <p className="mt-3 text-sm leading-relaxed text-white/40">
            {article.headline}
          </p>
        )}

        {/* Prompt question */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display mt-6 mb-8 text-3xl leading-tight text-white sm:text-4xl"
        >
          {prompt.balanced_prompt}
        </motion.h1>

        {/* Neutral summary (faint context) */}
        {prompt.neutral_summary && (
          <p className="mb-6 text-sm text-white/25 leading-relaxed border-l-2 border-white/10 pl-3">
            {prompt.neutral_summary}
          </p>
        )}

        {/* ── Textarea ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative mb-4"
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder="What do you think?"
            rows={4}
            disabled={submitting || sessionLoading}
            className="glow-focus w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-white/20 transition-all duration-200 disabled:opacity-50"
            style={{ overflow: 'hidden', minHeight: '120px' }}
          />

          {/* Char counter */}
          <div
            className="absolute bottom-3 right-3 text-xs font-mono transition-colors"
            style={{
              color:
                charPct > 0.9
                  ? '#7c6aff'
                  : charPct > 0.75
                  ? 'rgba(255,255,255,0.4)'
                  : 'rgba(255,255,255,0.18)',
            }}
          >
            {text.length}/{MAX_CHARS}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* ── Submit button ─────────────────────────────── */}
        <motion.button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting || !userId || sessionLoading}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="w-full rounded-xl py-4 text-base font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 btn-gradient"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Submitting...
            </span>
          ) : (
            'Submit your take'
          )}
        </motion.button>

        {/* Session loading hint */}
        {sessionLoading && (
          <p className="mt-3 text-center text-xs text-white/25">Setting up your session…</p>
        )}
      </div>
    </div>
  );
}
