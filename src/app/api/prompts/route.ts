import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  NewsCategory,
  NEWS_CATEGORIES,
  CATEGORY_ADJACENCY,
  MIN_PROMPTS_FLOOR,
} from '@/lib/constants';

type PromptRow = {
  id: string;
  article_id: string;
  balanced_prompt: string;
  specific_prompt: string | null;
  emotional_prompt: string | null;
  factual_prompt: string | null;
  safety_category: string;
  neutral_summary: string;
  active_prompt_type: string;
  created_at: string;
  article: { id: string; category: string | null } | null;
};

type PromptWithFill = PromptRow & { is_adjacent_fill: boolean };

async function fetchPromptsByCategories(
  cats: string[],
  excludeIds: string[] = []
): Promise<PromptRow[]> {
  let query = supabaseAdmin
    .from('prompts')
    .select('*, article:articles(id, category, headline, description, source, published_at, image_url, article_url, ingested_at)')
    .in('safety_category', ['safe', 'sensitive'])
    .order('created_at', { ascending: false });

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.map((id) => `"${id}"`).join(',')})`);
  }

  const { data } = await query;
  if (!data) return [];

  // Filter by article category in JS (join filter).
  // Articles with unrecognized/legacy categories (e.g. 'general') match any query.
  const knownCategories = new Set(NEWS_CATEGORIES as readonly string[]);
  return (data as PromptRow[]).filter((p) => {
    const cat = p.article?.category;
    if (!cat || !knownCategories.has(cat)) return true; // legacy article — always include
    return cats.includes(cat);
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const categoriesParam = searchParams.get('categories');

    // Parse requested categories; fall back to all if none provided
    let selectedCategories: NewsCategory[];
    if (categoriesParam) {
      selectedCategories = categoriesParam
        .split(',')
        .map((c) => c.trim())
        .filter((c): c is NewsCategory =>
          (NEWS_CATEGORIES as readonly string[]).includes(c)
        );
    } else {
      selectedCategories = [...NEWS_CATEGORIES];
    }

    if (selectedCategories.length === 0) {
      selectedCategories = [...NEWS_CATEGORIES];
    }

    // ── 1. Fetch prompts matching selected categories ─────────────────────
    const primaryPrompts = await fetchPromptsByCategories(selectedCategories);

    if (primaryPrompts.length >= MIN_PROMPTS_FLOOR) {
      // Enough — shuffle and return
      const shuffled = shuffle(primaryPrompts);
      return NextResponse.json(
        shuffled.map((p) => ({ ...p, is_adjacent_fill: false }))
      );
    }

    // ── 2. Below floor — fill from adjacent categories ────────────────────
    const deficit = MIN_PROMPTS_FLOOR - primaryPrompts.length;
    const existingIds = primaryPrompts.map((p) => p.id);

    // Collect unique adjacent categories not already in selected set
    const adjacentSet = new Set<NewsCategory>();
    for (const cat of selectedCategories) {
      for (const adj of CATEGORY_ADJACENCY[cat]) {
        if (!selectedCategories.includes(adj)) {
          adjacentSet.add(adj);
        }
      }
    }

    let fillPrompts: PromptWithFill[] = [];

    if (adjacentSet.size > 0) {
      const adjacentCategories = [...adjacentSet];
      const candidates = await fetchPromptsByCategories(adjacentCategories, existingIds);
      // Take only enough to meet the floor
      fillPrompts = shuffle(candidates)
        .slice(0, deficit)
        .map((p) => ({ ...p, is_adjacent_fill: true }));
    }

    // ── 3. Merge: primary first (shuffled), then fill ─────────────────────
    const merged: PromptWithFill[] = [
      ...shuffle(primaryPrompts).map((p) => ({ ...p, is_adjacent_fill: false })),
      ...fillPrompts,
    ];

    return NextResponse.json(merged);
  } catch (err) {
    console.error('Prompts fetch error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
