import { NextResponse } from 'next/server';
import { generatePromptsForArticles } from '@/lib/claude/prompt-generation';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST() {
  try {
    // Find all articles that don't yet have prompts
    const { data: allArticles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('id, headline, description, source, category');

    if (articlesError) {
      return NextResponse.json({ error: articlesError.message }, { status: 500 });
    }
    if (!allArticles || allArticles.length === 0) {
      return NextResponse.json({ prompts: [], count: 0, message: 'No articles found' });
    }

    // Find article_ids that already have prompts
    const { data: existingPrompts } = await supabaseAdmin
      .from('prompts')
      .select('article_id');

    const coveredIds = new Set(
      (existingPrompts || []).map((p: { article_id: string }) => p.article_id)
    );

    const unprompted = allArticles.filter((a: { id: string }) => !coveredIds.has(a.id));

    if (unprompted.length === 0) {
      return NextResponse.json({
        prompts: [],
        count: 0,
        message: 'All articles already have prompts',
      });
    }

    // Batch-generate via Claude (chunks of 50 internally)
    const generated = await generatePromptsForArticles(unprompted);

    // Store all returned prompts
    const toInsert = generated.map((g) => ({
      article_id: g.article_id,
      balanced_prompt: g.balanced_prompt,
      specific_prompt: g.specific_prompt,
      emotional_prompt: g.emotional_prompt,
      factual_prompt: g.factual_prompt,
      safety_category: g.safety_category,
      neutral_summary: g.neutral_summary,
      active_prompt_type: 'balanced',
    }));

    const { data: prompts, error: insertError } = await supabaseAdmin
      .from('prompts')
      .insert(toInsert)
      .select();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ prompts: prompts ?? [], count: prompts?.length ?? 0 });
  } catch (err) {
    console.error('Prompt generation error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
