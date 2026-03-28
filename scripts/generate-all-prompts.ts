/**
 * Run with: npx ts-node -r tsconfig-paths/register scripts/generate-all-prompts.ts
 * Or: npx tsx scripts/generate-all-prompts.ts
 *
 * Triggers a single batch POST to /api/prompts/generate which handles
 * all unprompted articles in one (or more, if >50) Claude API call(s).
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('Generating prompts for all unprompted articles...');

  const res = await fetch(`${BASE_URL}/api/prompts/generate`, {
    method: 'POST',
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Error:', data.error);
    process.exit(1);
  }

  if (data.message) {
    console.log(data.message);
  } else {
    console.log(`Generated ${data.count} prompt(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
