'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding, type OnboardingState, type StringField } from '@/hooks/useOnboarding';

/* ── Animation variants ─────────────────────────────────────────── */
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeIn' as const },
  }),
};

/* ── Data ───────────────────────────────────────────────────────── */
const AGE_BANDS = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'];
const GENDERS = ['Man', 'Woman', 'Non-binary', 'Prefer not to say'];
const PRONOUNS = ['he/him', 'she/her', 'they/them', 'Prefer not to say'];
const OCCUPATIONS = [
  'Student',
  'Early Career (0–3 yrs)',
  'Mid Career (4–10 yrs)',
  'Senior Professional',
  'Manager or Director',
  'Executive',
  'Self-employed',
  'Retired',
  'Other',
];
const EDUCATION_LEVELS = [
  'High School',
  'Some College',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD or Doctoral',
  'Trade or Vocational',
  'Prefer not to say',
];
const LOCATIONS = [
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'San Antonio, TX',
  'San Diego, CA',
  'Dallas, TX',
  'San Jose, CA',
  'Austin, TX',
  'Jacksonville, FL',
  'Fort Worth, TX',
  'Columbus, OH',
  'Charlotte, NC',
  'Indianapolis, IN',
  'San Francisco, CA',
  'Seattle, WA',
  'Denver, CO',
  'Portland, OR',
  'Other',
];
const CATEGORIES = [
  { id: 'technology', label: 'Technology', icon: '🖥' },
  { id: 'climate',    label: 'Climate',    icon: '🌍' },
  { id: 'business',  label: 'Business',   icon: '💼' },
  { id: 'health',    label: 'Health',     icon: '🏥' },
  { id: 'sports',    label: 'Sports',     icon: '⚽' },
];

/* ── canAdvance helper ──────────────────────────────────────────── */
function canAdvance(state: OnboardingState): boolean {
  switch (state.step) {
    case 1: return Boolean(state.ageBand);
    case 2: return Boolean(state.occupation) && Boolean(state.educationLevel);
    case 3: return Boolean(state.location);
    case 4: return state.categories.length > 0;
    default: return true;
  }
}

/* ── Page ───────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const { state, setField, toggleCategory, next, back } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showCatError, setShowCatError] = useState(false);
  // Block render until localStorage is checked — prevents flash before redirect
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pulse_onboarding_complete') === 'true') {
      router.replace('/');
      // Don't set ready — we're navigating away
    } else {
      setReady(true);
    }
  }, [router]);

  async function handleComplete() {
    setSubmitting(true);
    try {
      let sessionId = localStorage.getItem('pulse_session_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('pulse_session_id', sessionId);
      }

      // 1. Save profile + categories
      setLoadingMessage('Saving your profile…');
      const profileRes = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ageBand: state.ageBand,
          gender: state.gender || undefined,
          pronouns: state.pronouns || undefined,
          occupation: state.occupation,
          educationLevel: state.educationLevel,
          location: state.location,
          selectedCategories: state.categories,
        }),
      });
      const { user } = await profileRes.json();

      // 2. Ingest news for the user's chosen categories
      setLoadingMessage('Finding news for your topics…');
      if (user?.id) {
        await fetch('/api/news/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        }).catch(() => {});
      }

      // 3. Generate prompts for any newly ingested articles
      setLoadingMessage('Preparing your prompts…');
      await fetch('/api/prompts/generate', { method: 'POST' }).catch(() => {});

      localStorage.setItem('pulse_onboarding_complete', 'true');
      router.push('/');
    } catch {
      setSubmitting(false);
      setLoadingMessage('');
    }
  }

  function handleContinue() {
    if (state.step === 4 && state.categories.length === 0) {
      setShowCatError(true);
      return;
    }
    setShowCatError(false);
    next();
  }

  if (!ready) return null;

  const showBottomNav = state.step >= 1 && state.step <= 4;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08080f]">
      <AnimatePresence mode="wait" custom={state.direction} initial={false}>
        <motion.div
          key={state.step}
          custom={state.direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="min-h-screen"
        >
          {state.step === 0 && <Step0Welcome onNext={next} />}
          {state.step === 1 && (
            <StepShell>
              <Step1Demographics state={state} setField={setField} />
            </StepShell>
          )}
          {state.step === 2 && (
            <StepShell>
              <Step2Background state={state} setField={setField} />
            </StepShell>
          )}
          {state.step === 3 && (
            <StepShell>
              <Step3Location state={state} setField={setField} />
            </StepShell>
          )}
          {state.step === 4 && (
            <StepShell>
              <Step4Categories
                state={state}
                toggleCategory={toggleCategory}
                showError={showCatError}
              />
            </StepShell>
          )}
          {state.step === 5 && (
            <Step5Done
              onComplete={handleComplete}
              submitting={submitting}
              loadingMessage={loadingMessage}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Persistent bottom nav (steps 1–4) ─────────────────── */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#08080f]/80 px-6 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            {/* Back button — only steps 2–4 */}
            <div className="w-20">
              {state.step >= 2 && (
                <button
                  onClick={back}
                  className="text-sm text-white/40 transition-colors hover:text-white/70"
                >
                  ← Back
                </button>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`rounded-full transition-all duration-300 ${
                    s === state.step
                      ? 'h-2 w-6 bg-[#7c6aff]'
                      : s < state.step
                      ? 'h-2 w-2 bg-[#7c6aff]/40'
                      : 'h-2 w-2 bg-white/15'
                  }`}
                />
              ))}
            </div>

            {/* Continue button */}
            <div className="w-20 text-right">
              <button
                onClick={handleContinue}
                disabled={!canAdvance(state)}
                className="rounded-full bg-[#7c6aff] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#9b8dff] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step shell (content wrapper for steps 1–4) ─────────────────── */
function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-6 pb-28 pt-14">
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STEP 0 — WELCOME
───────────────────────────────────────────────────────────────── */
function Step0Welcome({ onNext }: { onNext: () => void }) {
  const [timerStarted, setTimerStarted] = useState(false);

  useEffect(() => {
    // Small delay so CSS transition fires after mount
    const startDelay = setTimeout(() => setTimerStarted(true), 50);
    const autoAdvance = setTimeout(onNext, 5000);
    return () => {
      clearTimeout(startDelay);
      clearTimeout(autoAdvance);
    };
  }, [onNext]);

  const pills = ['Read a news prompt', 'Share your take', 'See where you stand'];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {/* Orb background */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[-15%] h-[600px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(124,106,255,0.2) 0%, rgba(45,212,191,0.07) 55%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(45,212,191,0.14) 0%, rgba(124,106,255,0.05) 55%, transparent 70%)',
          filter: 'blur(64px)',
        }}
      />

      {/* Skip button */}
      <button
        onClick={onNext}
        className="absolute right-6 top-6 text-sm text-white/30 transition-colors hover:text-white/60"
      >
        Skip
      </button>

      {/* Content */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="font-display mb-4 text-5xl leading-tight text-white sm:text-6xl"
      >
        The world has opinions.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-12 max-w-sm text-lg text-white/40"
      >
        Pulse turns today's news into collective intelligence.
      </motion.p>

      <div className="flex flex-col items-center gap-3">
        {pills.map((text, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 + i * 0.55 }}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/70"
          >
            {text}
          </motion.div>
        ))}
      </div>

      {/* 5s progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/8">
        <div
          className="h-full bg-[#7c6aff] transition-[width] ease-linear"
          style={{
            width: timerStarted ? '100%' : '0%',
            transitionDuration: timerStarted ? '5000ms' : '0ms',
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STEP 1 — AGE + GENDER + PRONOUNS
───────────────────────────────────────────────────────────────── */
function Step1Demographics({
  state,
  setField,
}: {
  state: OnboardingState;
  setField: (f: StringField, v: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display mb-1 text-4xl text-white">A little about you</h1>
        <p className="text-sm text-white/35">Fully anonymous. No name, no account.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Age band <span className="text-[#7c6aff]">*</span>
        </label>
        <PillSelector
          options={AGE_BANDS}
          value={state.ageBand}
          onChange={(v) => setField('ageBand', v)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Gender{' '}
          <span className="normal-case font-normal text-white/25">(optional)</span>
        </label>
        <PillSelector
          options={GENDERS}
          value={state.gender}
          onChange={(v) => setField('gender', v === state.gender ? '' : v)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Pronouns{' '}
          <span className="normal-case font-normal text-white/25">(optional)</span>
        </label>
        <PillSelector
          options={PRONOUNS}
          value={state.pronouns}
          onChange={(v) => setField('pronouns', v === state.pronouns ? '' : v)}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STEP 2 — OCCUPATION + EDUCATION
───────────────────────────────────────────────────────────────── */
function Step2Background({
  state,
  setField,
}: {
  state: OnboardingState;
  setField: (f: StringField, v: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display mb-1 text-4xl text-white">Your background</h1>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Occupation <span className="text-[#7c6aff]">*</span>
        </label>
        <Dropdown
          value={state.occupation}
          onChange={(v) => setField('occupation', v)}
          options={OCCUPATIONS}
          placeholder="Select your occupation"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Education <span className="text-[#7c6aff]">*</span>
        </label>
        <Dropdown
          value={state.educationLevel}
          onChange={(v) => setField('educationLevel', v)}
          options={EDUCATION_LEVELS}
          placeholder="Select your education level"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STEP 3 — LOCATION
───────────────────────────────────────────────────────────────── */
function Step3Location({
  state,
  setField,
}: {
  state: OnboardingState;
  setField: (f: StringField, v: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display mb-1 text-4xl text-white">Where are you based?</h1>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          City <span className="text-[#7c6aff]">*</span>
        </label>
        <Dropdown
          value={state.location}
          onChange={(v) => setField('location', v)}
          options={LOCATIONS}
          placeholder="Select your city"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STEP 4 — NEWS CATEGORIES
───────────────────────────────────────────────────────────────── */
function Step4Categories({
  state,
  toggleCategory,
  showError,
}: {
  state: OnboardingState;
  toggleCategory: (cat: string) => void;
  showError: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display mb-1 text-4xl text-white">What do you care about?</h1>
        <p className="text-sm text-white/35">
          Pick at least one. We'll show you prompts from these topics.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const selected = state.categories.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all duration-200 ${
                selected
                  ? 'border-[#7c6aff]/60 bg-[#7c6aff]/10 shadow-[0_0_20px_rgba(124,106,255,0.15)]'
                  : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
              }`}
            >
              {selected && (
                <span className="absolute right-2 top-2 text-xs text-[#7c6aff]">✓</span>
              )}
              <span className="text-3xl">{cat.icon}</span>
              <span
                className={`text-sm font-medium transition-colors ${
                  selected ? 'text-white' : 'text-white/55'
                }`}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {showError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-[#ff6b6b]"
          >
            At least 1 category required
          </motion.p>
        )}
      </AnimatePresence>

      {!showError && (
        <p className="text-xs text-white/20">At least 1 required</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STEP 5 — DONE
───────────────────────────────────────────────────────────────── */
function Step5Done({
  onComplete,
  submitting,
  loadingMessage,
}: {
  onComplete: () => void;
  submitting: boolean;
  loadingMessage: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {/* Background orb */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(124,106,255,0.15) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <LockAnimation />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h1 className="font-display mb-3 text-6xl text-white sm:text-7xl">You're in.</h1>
          <p className="text-base text-white/40">
            Respond to 2 prompts to unlock the opinion map.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="flex flex-col items-center gap-3"
        >
          <button
            onClick={onComplete}
            disabled={submitting}
            className="mt-4 flex items-center gap-2 rounded-full bg-[#7c6aff] px-8 py-4 text-base font-semibold text-white shadow-[0_4px_24px_rgba(124,106,255,0.4)] transition-all hover:scale-105 hover:shadow-[0_6px_32px_rgba(124,106,255,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <>See today's prompts <span>→</span></>
            )}
          </button>

          <AnimatePresence mode="wait">
            {loadingMessage && (
              <motion.p
                key={loadingMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-xs text-white/35"
              >
                {loadingMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

function LockAnimation() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setUnlocked(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-20 w-20">
      <AnimatePresence mode="wait">
        {!unlocked ? (
          <motion.span
            key="locked"
            className="absolute inset-0 flex items-center justify-center text-5xl"
            exit={{ scale: 0.6, rotate: -20, opacity: 0, transition: { duration: 0.25 } }}
          >
            🔒
          </motion.span>
        ) : (
          <motion.span
            key="unlocked"
            className="absolute inset-0 flex items-center justify-center text-5xl"
            initial={{ scale: 0.5, rotate: 20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          >
            🔓
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Shared UI components
───────────────────────────────────────────────────────────────── */

function PillSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-full border px-4 py-2 text-sm transition-all duration-150 ${
            value === opt
              ? 'border-[#7c6aff]/60 bg-[#7c6aff]/15 text-white'
              : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Dropdown({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-colors focus:border-[#7c6aff]/50 focus:outline-none focus:ring-1 focus:ring-[#7c6aff]/30 [&>option]:bg-[#0d0d1a] [&>option:disabled]:text-white/30"
    >
      <option value="" disabled className="text-white/30">
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
