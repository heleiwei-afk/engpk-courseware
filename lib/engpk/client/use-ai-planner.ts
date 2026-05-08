'use client';

/**
 * useAIPlanner - Hook for the "AI 帮我规划" button
 *
 * Calls /api/engpk/plan-lesson with a topic string,
 * returns the generated instructions text.
 */

import { useCallback, useRef, useState } from 'react';

export type PlannerStatus = 'idle' | 'loading' | 'done' | 'error';

export function useAIPlanner() {
  const [status, setStatus] = useState<PlannerStatus>('idle');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const controllerRef = useRef<AbortController | null>(null);

  const plan = useCallback(async (topic: string): Promise<string> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setError('');
    setResult('');

    try {
      const res = await fetch('/api/engpk/plan-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.error || 'HTTP ' + res.status;
        setError(msg);
        setStatus('error');
        return '';
      }

      const data = await res.json();
      const instructions = data.instructions || '';
      setResult(instructions);
      setStatus('done');
      return instructions;
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle');
        return '';
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus('error');
      return '';
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setStatus('idle');
    setResult('');
    setError('');
  }, []);

  return { status, result, error, plan, abort, reset };
}
