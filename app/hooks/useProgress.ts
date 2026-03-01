import { useState, useCallback } from 'react';
import { api } from '../lib/api';

interface ProgressResponse {
  totalQuestions: number;
  totalMaterials: number;
  dueNow: number;
  dueUpcoming: number;
  masteredCount: number;
  averageEaseFactor: number;
  questionsByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
}

type ProgressStatus = 'idle' | 'loading' | 'ready' | 'error';

// Ensure all three difficulty keys are always present, even if the DO omits them
function normalizeDifficulties(
  raw: Record<string, number>
): Record<'easy' | 'medium' | 'hard', number> {
  return {
    easy:   raw['easy']   ?? 0,
    medium: raw['medium'] ?? 0,
    hard:   raw['hard']   ?? 0,
  };
}

export function useProgress() {
  const [status, setStatus] = useState<ProgressStatus>('idle');
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const refresh = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const raw = await api.getProgress() as ProgressResponse & {
        questionsByDifficulty: Record<string, number>;
      };

      setData({
        ...raw,
        questionsByDifficulty: normalizeDifficulties(raw.questionsByDifficulty ?? {}),
      });
      setStatus('ready');
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Failed to load progress');
      setStatus('error');
    }
  }, []);

  return { status, data, errorMsg, refresh };
}