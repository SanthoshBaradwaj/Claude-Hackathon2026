import { DBSCAN } from 'density-clustering';
import {
  DBSCAN_EPSILON,
  DBSCAN_MIN_POINTS,
  DBSCAN_FALLBACK_THRESHOLD,
} from '@/lib/constants';

/**
 * Run DBSCAN on an array of 8-dimensional feature vectors.
 *
 * Returns a per-response assignment array of the same length as `vectors`.
 * Each value is a cluster index (0-based) or -1 for noise / outlier.
 *
 * Falls back to stance binning when the sample is too small for DBSCAN
 * to produce meaningful results (< DBSCAN_FALLBACK_THRESHOLD).
 */
export function clusterResponses(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];

  if (vectors.length < DBSCAN_FALLBACK_THRESHOLD) {
    return stanceBinFallback(vectors);
  }

  const dbscan = new DBSCAN();
  // clusters: number[][] — each inner array is the point indices for one cluster
  const clusters = dbscan.run(vectors, DBSCAN_EPSILON, DBSCAN_MIN_POINTS);

  // Convert cluster-of-indices format to per-point assignment array
  const assignments = new Array<number>(vectors.length).fill(-1);
  clusters.forEach((cluster, clusterIndex) => {
    cluster.forEach((pointIndex) => {
      assignments[pointIndex] = clusterIndex;
    });
  });

  // If DBSCAN found nothing (all noise — data too sparse), fall back
  if (clusters.length === 0) {
    return stanceBinFallback(vectors);
  }

  return assignments;
}

/**
 * Stance-binning fallback for small sample sizes.
 * vectors[i][0] is stance normalised to [0,1]: 0 = against, 1 = for.
 */
function stanceBinFallback(vectors: number[][]): number[] {
  return vectors.map((v) => {
    const stance = v[0];
    if (stance < 0.35) return 0; // Critics
    if (stance > 0.65) return 2; // Supporters
    return 1;                    // Moderates
  });
}

/** Euclidean distance between two equal-length vectors */
export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    a.reduce((sum, ai, i) => sum + (ai - (b[i] ?? 0)) ** 2, 0)
  );
}

/** Mean vector of a set of indexed points */
export function computeCentroid(vectors: number[][], indices: number[]): number[] {
  const dim = vectors[0]?.length ?? 8;
  if (indices.length === 0) return Array(dim).fill(0.5) as number[];

  const sum = Array(dim).fill(0) as number[];
  for (const idx of indices) {
    for (let d = 0; d < dim; d++) {
      sum[d] += vectors[idx][d];
    }
  }
  return sum.map((v) => v / indices.length);
}
