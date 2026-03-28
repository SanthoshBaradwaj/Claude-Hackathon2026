'use client';

const UNLOCK_THRESHOLD = 2;

export interface UnlockStatus {
  isUnlocked: boolean;
  responsesCount: number;
  remaining: number;
  threshold: number;
}

export function useUnlockStatus(
  responsesCount: number,
  isUnlocked: boolean
): UnlockStatus {
  const remaining = Math.max(0, UNLOCK_THRESHOLD - responsesCount);
  return { isUnlocked, responsesCount, remaining, threshold: UNLOCK_THRESHOLD };
}
