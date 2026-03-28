export {}; // make this file a module

/**
 * Compute clusters for every prompt that has responses.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/compute-all-clusters.ts
 *   — or —
 *   npm run compute-clusters
 *
 * Requires: dev server running at BASE_URL (default: http://localhost:3000)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function computeClusters(promptId: string): Promise<{ count: number; message?: string }> {
  const res = await fetch(`${BASE_URL}/api/clusters/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('\n🔢  compute-all-clusters');
  console.log(`   BASE_URL: ${BASE_URL}\n`);

  // Only process prompts that actually have responses
  const promptsWithResponses: { prompt_id: string }[] = await supabaseGet(
    'responses?select=prompt_id&limit=1000'
  );

  const uniquePromptIds = [...new Set(promptsWithResponses.map((r) => r.prompt_id))];

  if (uniquePromptIds.length === 0) {
    console.log('No prompts with responses found. Run the seed script first.');
    return;
  }

  console.log(`Found ${uniquePromptIds.length} prompt(s) with responses.\n`);

  let succeeded = 0;
  let failed = 0;

  for (const promptId of uniquePromptIds) {
    process.stdout.write(`  → ${promptId.slice(0, 8)}… `);
    try {
      const result = await computeClusters(promptId);
      if (result.message) {
        console.log(`⚠  ${result.message}`);
      } else {
        console.log(`✓  ${result.count} cluster(s)`);
        succeeded++;
      }
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n✅  Done: ${succeeded} computed, ${failed} failed.\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
