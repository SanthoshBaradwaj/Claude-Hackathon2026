'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SessionState {
  sessionId: string | null;
  userId: string | null;
  isUnlocked: boolean;
  responsesCount: number;
  loading: boolean;
}

const STORAGE_KEY = 'pulse_session_id';

export function useSession(): SessionState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    userId: null,
    isUnlocked: false,
    responsesCount: 0,
    loading: true,
  });

  const fetchOrCreate = useCallback(async (sessionId: string) => {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    const user = data.user;
    setState({
      sessionId,
      userId: user?.id ?? null,
      isUnlocked: user?.is_unlocked ?? false,
      responsesCount: user?.responses_count ?? 0,
      loading: false,
    });
  }, []);

  useEffect(() => {
    let sessionId = localStorage.getItem(STORAGE_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, sessionId);
    }
    fetchOrCreate(sessionId);
  }, [fetchOrCreate]);

  const refresh = useCallback(async () => {
    const sessionId = localStorage.getItem(STORAGE_KEY);
    if (sessionId) await fetchOrCreate(sessionId);
  }, [fetchOrCreate]);

  return { ...state, refresh };
}
