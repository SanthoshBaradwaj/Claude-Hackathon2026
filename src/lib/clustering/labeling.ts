import { NOISE_CLUSTER_INDEX, NOISE_CLUSTER_LABEL } from '@/lib/constants';

/**
 * Generate a human-readable label for a cluster.
 *
 * @param centroid     - Mean feature vector for the cluster (8-dim, all [0,1])
 * @param clusterIndex - Pass NOISE_CLUSTER_INDEX (-1) to get the noise label
 *                       without computing from centroid values.
 */
export function labelCluster(centroid: number[], clusterIndex?: number): string {
  if (clusterIndex === NOISE_CLUSTER_INDEX) {
    return NOISE_CLUSTER_LABEL;
  }

  const stance  = centroid[0]; // 0 = against, 0.5 = neutral, 1 = for
  const emotion = centroid[2]; // from EMOTION_MAP
  const urgency = centroid[6]; // [0, 1]

  const stanceWord  = stance  < 0.35 ? 'Skeptical'  : stance  > 0.65 ? 'Supportive' : 'Measured';
  const emotionWord = emotion < 0.3  ? 'Concerned'  : emotion > 0.7  ? 'Optimistic' : 'Pragmatic';
  const urgencyWord = urgency > 0.7  ? 'Urgent'     : urgency < 0.3  ? 'Patient'    : '';

  return [urgencyWord, emotionWord, stanceWord + 's'].filter(Boolean).join(' ');
}
