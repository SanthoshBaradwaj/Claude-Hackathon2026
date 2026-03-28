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
