import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

type ProcessingStatus = 'pending' | 'ready' | 'timeout' | 'error';

interface UseProcessingStatusOptions {
  materialId: string | null;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onReady?: () => void;
}

export function useProcessingStatus({
  materialId,
  pollIntervalMs = 2000,
  timeoutMs = 60000,
  onReady,
}: UseProcessingStatusOptions) {
  const [status, setStatus] = useState<ProcessingStatus>('pending');
  const [questionCount, setQuestionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const onReadyRef = useRef(onReady); // stable ref so effect doesn't re-run on every render
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!materialId) return;

    startTimeRef.current = Date.now();
    setStatus('pending');
    setError(null);

    const poll = async () => {
      try {
        const data = await api.getStatus(materialId);
        setQuestionCount(data.questionCount);

        if (data.status === 'ready') {
          setStatus('ready');
          onReadyRef.current?.();
          return; // stop polling
        }

        if (Date.now() - startTimeRef.current >= timeoutMs) {
          setStatus('timeout');
          return;
        }

        pollRef.current = setTimeout(poll, pollIntervalMs);
      } catch (err) {
        setError((err as Error).message ?? 'Status check failed');
        setStatus('error');
      }
    };

    poll();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [materialId, pollIntervalMs, timeoutMs]);

  return { status, questionCount, error };
}