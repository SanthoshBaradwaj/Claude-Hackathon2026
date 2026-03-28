/**
 * Seed synthetic responses for all prompts in the DB.
 *
 * Prerequisites:
 *   1. Run `npm run dev` in another terminal (or set BASE_URL to a deployed URL)
 *   2. Ensure .env.local has ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *      and SUPABASE_SERVICE_ROLE_KEY filled in
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/seed.ts
 *
 * Or add to package.json: "seed": "tsx --env-file=.env.local scripts/seed.ts"
 */

import Anthropic from '@anthropic-ai/sdk';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

const RESPONSES_PER_PROMPT = 30;
const SEED_USERS = 30;     // reuse same 30 users across all prompts
const CONCURRENCY = 4;     // parallel response submissions per prompt

// ── Supabase REST helpers ────────────────────────────────────────
async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path} → ${res.status}`);
  return res.json();
}

// ── API helpers ──────────────────────────────────────────────────
async function createUser(sessionId: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!data.user) throw new Error(`createUser failed: ${JSON.stringify(data)}`);
  return data.user;
}

async function submitResponse(
  userId: string,
  promptId: string,
  text: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/responses/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, promptId, rawText: text, inputMethod: 'text' }),
  });
  const data = await res.json();
  // 409 = already responded — not an error in a re-run scenario
  if (!res.ok && res.status !== 409) {
    console.warn(`  ⚠ submit failed (${res.status}): ${data.error}`);
  }
}

// ── Claude opinion generation ────────────────────────────────────
async function generateOpinions(promptText: string): Promise<string[]> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content:
          `Generate ${RESPONSES_PER_PROMPT} realistic, diverse opinions responding to this prompt:\n` +
          `"${promptText}"\n\n` +
          `Return a JSON array of strings. Make them feel like real people wrote them — ` +
          `varied length, tone, vocabulary. Distribute stances: roughly 10 critical/skeptical, ` +
          `10 neutral/nuanced, 10 supportive/optimistic.\n\n` +
          `Return ONLY the JSON array, no markdown, no explanation.`,
      },
    ],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const arr = JSON.parse(cleaned);

  if (!Array.isArray(arr)) throw new Error('Claude returned non-array for opinions');
  return arr.map(String).slice(0, RESPONSES_PER_PROMPT);
}

// ── Concurrency limiter ──────────────────────────────────────────
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    console.error('Missing env vars. Ensure .env.local is loaded with --env-file flag.');
    process.exit(1);
  }

  console.log(`\n🌱  Pulse seed script`);
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log(`   Responses per prompt: ${RESPONSES_PER_PROMPT}`);
  console.log(`   Seed users: ${SEED_USERS}\n`);

  // ── 1. Fetch all prompts ───────────────────────────────────────
  console.log('Fetching prompts from DB…');
  const prompts: { id: string; balanced_prompt: string }[] =
    await supabaseGet('prompts?select=id,balanced_prompt&order=created_at.asc');

  if (prompts.length === 0) {
    console.log('No prompts found. Run /api/news/ingest and /api/prompts/generate first.');
    return;
  }
  console.log(`Found ${prompts.length} prompt(s).\n`);

  // ── 2. Create / reuse 30 seed users ───────────────────────────
  console.log(`Creating ${SEED_USERS} seed users…`);
  const seedUsers: { id: string }[] = [];

  for (let u = 0; u < SEED_USERS; u++) {
    const sessionId = `seed_user_${u}_v1`;
    const user = await createUser(sessionId);
    seedUsers.push(user);
  }
  console.log(`✓ ${seedUsers.length} seed users ready.\n`);

  // ── 3. For each prompt, generate + submit opinions ─────────────
  for (const prompt of prompts) {
    console.log(`\n─── Prompt: "${prompt.balanced_prompt.slice(0, 70)}…"`);

    let opinions: string[];
    try {
      process.stdout.write('  Generating 30 opinions via Claude… ');
      opinions = await generateOpinions(prompt.balanced_prompt);
      console.log(`✓ Got ${opinions.length} opinions.`);
    } catch (err) {
      console.error(`  ✗ Failed to generate opinions: ${err}`);
      continue;
    }

    // Pair each opinion with a seed user
    const tasks = opinions.slice(0, SEED_USERS).map((text, i) => async () => {
      await submitResponse(seedUsers[i].id, prompt.id, text);
      process.stdout.write('.');
    });

    process.stdout.write('  Submitting responses ');
    await runWithConcurrency(tasks, CONCURRENCY);
    console.log(` ✓ ${tasks.length} responses submitted.`);

    // Trigger cluster computation
    try {
      process.stdout.write('  Computing clusters… ');
      const res = await fetch(`${BASE_URL}/api/clusters/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: prompt.id }),
      });
      const d = await res.json();
      console.log(`✓ ${d.count ?? 0} cluster(s) computed.`);
    } catch {
      console.log('⚠ Cluster compute failed (continuing).');
    }
  }

  console.log('\n✅  Seed complete.\n');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
