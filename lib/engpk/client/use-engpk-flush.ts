'use client';

/**
 * engpk · scoreBus + metricBus 批量 flush
 *
 * 订阅 scoreBus / metricBus，把事件批量 POST 到后端。
 * 节流：每 3 秒或每 20 条事件 flush 一次。
 *
 * 决策 #12：MVP 不做校验，仅落库；上线前需补服务端速率限制。
 */

import { useEffect, useRef } from 'react';
import { scoreBus, type ScoreEvent } from '@/lib/engpk/score/bus';
import { metricBus, type MetricEvent } from '@/lib/engpk/metric/bus';

const FLUSH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 20;

interface UseEngpkFlushOptions {
  userId: string;
  /** 禁用（如开发/测试） */
  disabled?: boolean;
}

export function useEngpkFlush({ userId, disabled }: UseEngpkFlushOptions) {
  const scoreQueueRef = useRef<ScoreEvent[]>([]);
  const metricQueueRef = useRef<MetricEvent[]>([]);

  useEffect(() => {
    if (disabled) return;

    const unsubScore = scoreBus.subscribe((e) => {
      scoreQueueRef.current.push(e);
      if (scoreQueueRef.current.length >= MAX_BATCH_SIZE) {
        flushScores(userId);
      }
    });

    const unsubMetric = metricBus.subscribe((e) => {
      metricQueueRef.current.push(e);
      if (metricQueueRef.current.length >= MAX_BATCH_SIZE) {
        flushMetrics();
      }
    });

    const timer = setInterval(() => {
      flushScores(userId);
      flushMetrics();
    }, FLUSH_INTERVAL_MS);

    // 页面关闭时尝试 flush（不等响应）
    const onUnload = () => {
      flushScores(userId, true);
      flushMetrics(true);
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      unsubScore();
      unsubMetric();
      clearInterval(timer);
      window.removeEventListener('beforeunload', onUnload);
      flushScores(userId);
      flushMetrics();
    };
  }, [userId, disabled]);

  function flushScores(uid: string, useBeacon = false) {
    const batch = scoreQueueRef.current.splice(0, scoreQueueRef.current.length);
    if (batch.length === 0) return;

    const body = JSON.stringify({
      userId: uid,
      events: batch.map((e) => ({
        target: e.target,
        delta: e.delta,
        reason: e.reason,
        source: e.source,
        sceneId: e.sceneId,
        lessonId: e.lessonId,
        clientReportedAt: e.clientReportedAt,
      })),
    });

    if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(
        '/api/engpk/score/submit',
        new Blob([body], { type: 'application/json' }),
      );
    } else {
      fetch('/api/engpk/score/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: useBeacon,
      }).catch(() => {
        // 失败丢弃（MVP 不重试，避免前端复杂度）
      });
    }
  }

  function flushMetrics(useBeacon = false) {
    const batch = metricQueueRef.current.splice(0, metricQueueRef.current.length);
    if (batch.length === 0) return;

    const body = JSON.stringify({
      events: batch.map((e) => ({
        name: e.name,
        value: e.value,
        tags: e.tags,
        payload: e.payload,
        lessonId: e.lessonId,
        sceneId: e.sceneId,
        clientReportedAt: e.clientReportedAt,
      })),
    });

    if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(
        '/api/engpk/metrics/ingest',
        new Blob([body], { type: 'application/json' }),
      );
    } else {
      fetch('/api/engpk/metrics/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: useBeacon,
      }).catch(() => {
        // 丢弃
      });
    }
  }
}
