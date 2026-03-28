import { NextRequest, NextResponse } from 'next/server';
import { fetchArticles } from '@/lib/news/provider';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NEWS_CATEGORIES, NewsCategory } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    let categories: NewsCategory[] = [...NEWS_CATEGORIES];

    // If userId provided, restrict to the user's selected categories
    const body = await req.json().catch(() => ({})) as { userId?: string };
    if (body.userId) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('selected_categories')
        .eq('id', body.userId)
        .single();

      const userCats = (user?.selected_categories ?? []) as NewsCategory[];
      if (userCats.length > 0) {
        categories = userCats.filter((c) => (NEWS_CATEGORIES as readonly string[]).includes(c));
      }
    }

    const articles = await fetchArticles(categories);

    if (articles.length === 0) {
      return NextResponse.json({ articles: [], count: 0 });
    }

    // Deduplicate: check which article_urls already exist
    const urls = articles.map((a) => a.article_url);
    const { data: existing } = await supabaseAdmin
      .from('articles')
      .select('article_url')
      .in('article_url', urls);

    const existingUrls = new Set((existing || []).map((e: { article_url: string }) => e.article_url));
    const newArticles = articles.filter((a) => !existingUrls.has(a.article_url));

    if (newArticles.length === 0) {
      return NextResponse.json({ articles: [], count: 0, message: 'All articles already ingested' });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('articles')
      .insert(newArticles)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ articles: inserted, count: inserted?.length ?? 0 });
  } catch (err) {
    console.error('News ingest error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
