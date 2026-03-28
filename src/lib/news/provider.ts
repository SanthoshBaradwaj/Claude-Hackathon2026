import { Article, RawGNewsArticle, RawNewsAPIArticle } from '@/types';

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

export async function fetchTopHeadlines(category = 'general'): Promise<NormalizedArticle[]> {
  const provider = process.env.NEWS_PROVIDER || 'gnews';

  if (provider === 'newsapi') {
    return fetchFromNewsAPI(category);
  }
  return fetchFromGNews(category);
}

async function fetchFromGNews(category: string): Promise<NormalizedArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) throw new Error('GNEWS_API_KEY is not set');

  const url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&max=10&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`GNews API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const articles: RawGNewsArticle[] = data.articles || [];
  return articles.map((a) => normalizeGNews(a, category));
}

async function fetchFromNewsAPI(category: string): Promise<NormalizedArticle[]> {
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
