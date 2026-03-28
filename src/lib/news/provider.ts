import { RawGNewsArticle, RawNewsAPIArticle } from '@/types';
import { NewsCategory, GNEWS_CATEGORY_MAP, NEWS_CATEGORIES } from '@/lib/constants';

export interface NormalizedArticle {
  headline: string;
  description: string;
  source: string;
  published_at: string;
  image_url: string;
  article_url: string;
  category: string;
}

function normalizeGNews(raw: RawGNewsArticle, category = 'general'): NormalizedArticle {
  return {
    headline: raw.title,
    description: raw.description || '',
    source: raw.source?.name || '',
    published_at: raw.publishedAt,
    image_url: raw.image || '',
    article_url: raw.url,
    category,
  };
}

function normalizeNewsAPI(raw: RawNewsAPIArticle, category = 'general'): NormalizedArticle {
  return {
    headline: raw.title,
    description: raw.description || '',
    source: raw.source?.name || '',
    published_at: raw.publishedAt,
    image_url: raw.urlToImage || '',
    article_url: raw.url,
    category,
  };
}

/**
 * Fetch articles for the given categories. Makes one API call per category,
 * then merges and deduplicates by article_url.
 * Defaults to all NEWS_CATEGORIES when called without arguments.
 */
export async function fetchArticles(
  categories: NewsCategory[] = [...NEWS_CATEGORIES]
): Promise<NormalizedArticle[]> {
  const provider = process.env.NEWS_PROVIDER || 'gnews';

  const results = await Promise.allSettled(
    categories.map((cat) =>
      provider === 'newsapi'
        ? fetchFromNewsAPI(cat)
        : fetchFromGNews(cat)
    )
  );

  const merged: NormalizedArticle[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('Category fetch failed:', result.reason);
      continue;
    }
    for (const article of result.value) {
      if (!seen.has(article.article_url)) {
        seen.add(article.article_url);
        merged.push(article);
      }
    }
  }

  return merged;
}

async function fetchFromGNews(category: NewsCategory): Promise<NormalizedArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) throw new Error('GNEWS_API_KEY is not set');

  const gnewsCategory = GNEWS_CATEGORY_MAP[category];
  const url = `https://gnews.io/api/v4/top-headlines?category=${gnewsCategory}&lang=en&max=10&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`GNews API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const articles: RawGNewsArticle[] = data.articles || [];
  return articles.map((a) => normalizeGNews(a, category));
}

async function fetchFromNewsAPI(category: NewsCategory): Promise<NormalizedArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) throw new Error('NEWS_API_KEY is not set');

  const url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=10&apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`NewsAPI error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const articles: RawNewsAPIArticle[] = data.articles || [];
  return articles
    .filter((a) => a.url && a.title && a.title !== '[Removed]')
    .map((a) => normalizeNewsAPI(a, category));
}
