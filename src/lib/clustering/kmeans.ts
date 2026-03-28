import { kmeans } from 'ml-kmeans';
import { labelCluster } from './labeling';

export interface ClusterResult {
  index: number;
  label: string;
  centroid: number[];
  memberIndices: number[]; // indices into the input vectors/factors arrays
}

const K = 3;
const MIN_FOR_KMEANS = 10;

/**
 * Run K-Means (k=3) on feature vectors, falling back to stance binning
 * when fewer than 10 responses exist.
 *
 * @param vectors  - Encoded feature vectors (8-dim, all [0,1])
 * @param rawStances - Raw stance values [-1,1], parallel to vectors — used for fallback binning
 */
export function runClustering(
  vectors: number[][],
  rawStances: number[]
): ClusterResult[] {
  if (vectors.length === 0) return [];

  if (vectors.length < MIN_FOR_KMEANS) {
    return binByStance(rawStances);
  }

  const k = Math.min(K, vectors.length);
  const result = kmeans(vectors, k, {
    initialization: 'kmeans++',
    maxIterations: 100,
    tolerance: 1e-6,
  });

  return result.centroids.map((centroid, clusterIdx) => {
    const memberIndices = result.clusters
      .map((c, i) => (c === clusterIdx ? i : -1))
      .filter((i): i is number => i !== -1);

    return {
      index: clusterIdx,
      label: labelCluster(centroid),
      centroid,
      memberIndices,
    };
  });
}

/**
 * Stance-binning fallback for small sample sizes (<10 responses).
 * From CLAUDE.md: Critics (stance < -0.3), Moderates (-0.3..0.3), Supporters (>0.3)
 */
function binByStance(stances: number[]): ClusterResult[] {
  const critics    = stances.map((s, i) => (s < -0.3 ? i : -1)).filter((i): i is number => i !== -1);
  const moderates  = stances.map((s, i) => (s >= -0.3 && s <= 0.3 ? i : -1)).filter((i): i is number => i !== -1);
  const supporters = stances.map((s, i) => (s > 0.3 ? i : -1)).filter((i): i is number => i !== -1);

  function stanceCentroid(indices: number[]): number[] {
    const avgStance =
      indices.length > 0
        ? indices.reduce((sum, i) => sum + stances[i], 0) / indices.length
        : 0;
    const c = Array(8).fill(0.5) as number[];
    c[0] = (avgStance + 1) / 2; // normalized to [0,1]
    return c;
  }

  return [
    { index: 0, label: 'Critics',    centroid: stanceCentroid(critics),    memberIndices: critics    },
    { index: 1, label: 'Moderates',  centroid: stanceCentroid(moderates),  memberIndices: moderates  },
    { index: 2, label: 'Supporters', centroid: stanceCentroid(supporters), memberIndices: supporters },
  ];
}

/** Euclidean distance between two equal-length vectors */
export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, ai, i) => sum + (ai - (b[i] ?? 0)) ** 2, 0));
}
