export const EMOTION_MAP: Record<string, number> = {
  anger: 0.0, disgust: 0.1, fear: 0.2, sadness: 0.3,
  frustration: 0.4, curiosity: 0.5, surprise: 0.6,
  amusement: 0.7, hope: 0.8, pride: 0.9,
};

export const VALUE_MAP: Record<string, number> = {
  safety: 0.0, stability: 0.1, tradition: 0.2, accountability: 0.3,
  efficiency: 0.4, fairness: 0.5, community: 0.6, equality: 0.7,
  progress: 0.8, freedom: 0.9,
};

export const POLICY_MAP: Record<string, number> = {
  abolish: 0.0, restrict: 0.15, regulate: 0.3, maintain: 0.45,
  none: 0.5, educate: 0.6, reform: 0.7, invest: 0.8, deregulate: 0.9,
};

export function encodeFeatureVector(factors: {
  stance: number;
  sentiment: number;
  emotion: string;
  certainty: number;
  primary_value: string;
  trust_level: number;
  urgency: number;
  policy_preference?: string;
}): number[] {
  return [
    (factors.stance + 1) / 2,                              // [-1,1] → [0,1]
    (factors.sentiment + 1) / 2,                            // [-1,1] → [0,1]
    EMOTION_MAP[factors.emotion] ?? 0.5,
    factors.certainty,
    VALUE_MAP[factors.primary_value] ?? 0.5,
    factors.trust_level,
    factors.urgency,
    POLICY_MAP[factors.policy_preference ?? 'none'] ?? 0.5,
  ];
}
