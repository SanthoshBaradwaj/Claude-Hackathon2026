// ── News categories ───────────────────────────────────────────────
export const NEWS_CATEGORIES = [
  'technology', 'climate', 'business', 'health', 'sports',
] as const;

export type NewsCategory = typeof NEWS_CATEGORIES[number];

export const CATEGORY_ADJACENCY: Record<NewsCategory, NewsCategory[]> = {
  technology: ['business'],
  climate:    ['health'],
  business:   ['technology'],
  health:     ['climate'],
  sports:     ['health'],
};

export const MIN_PROMPTS_FLOOR = 10;

export const GNEWS_CATEGORY_MAP: Record<NewsCategory, string> = {
  technology: 'technology',
  climate:    'science',   // GNews uses 'science' for climate content
  business:   'business',
  health:     'health',
  sports:     'sports',
};

// ── DBSCAN clustering parameters ─────────────────────────────────
// Tune epsilon: higher = fewer larger clusters, lower = more smaller clusters / more noise
export const DBSCAN_EPSILON = 0.35;
export const DBSCAN_MIN_POINTS = 2;
export const DBSCAN_FALLBACK_THRESHOLD = 8; // use stance binning below this count

// ── Noise cluster constants ───────────────────────────────────────
export const NOISE_CLUSTER_INDEX = -1;
export const NOISE_CLUSTER_LABEL = 'Independent Thinkers';
export const NOISE_CLUSTER_SUMMARY = "Responses that don't fit neatly into any group";

// ── Unlock gate ───────────────────────────────────────────────────
export const UNLOCK_THRESHOLD = 2;

// ── Chart colour palette (indexed by cluster_index) ──────────────
export const CLUSTER_PALETTE = [
  '#7c6aff', // violet
  '#2dd4bf', // teal
  '#ff6b6b', // coral
  '#fbbf24', // amber
  '#4ade80', // green
  '#f472b6', // pink
] as const;
