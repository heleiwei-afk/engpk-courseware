'use client';

/**
 * engpk · SSE 接收 hook
 *
 * 负责：
 *   - 发起 POST /api/engpk/generate-lesson-from-instructions
 *   - 按 SSE 格式解析事件流
 *   - 返回状态 + 累积事件
 *   - 支持 AbortController 取消（用户点"停止"或路由切换时）
 *
 * 简单自研解析器：
 *   - 每帧以空行（\n\n）分隔
 *   - 忽略 ":heartbeat" 这种 comment 帧
 *   - 仅消费 "data:" 行
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GenerationEvent,
  GenerationDonePayload,
  GenerationScenePayload,
  GenerationSceneErrorPayload,
  GenerationStylePayload,
  GenerationTeammatesPayload,
  GenerationParsedPayload,
  GenerationErrorPayload,
} from '@/lib/engpk/types/generation-events';

export type GenerationStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'done'
  | 'error'
  | 'aborted';

export interface GenerationState {
  status: GenerationStatus;
  lessonId?: string;
  parsed?: GenerationParsedPayload;
  teammates?: GenerationTeammatesPayload;
  style?: GenerationStylePayload;
  scenes: Record<number, GenerationScenePayload>;
  sceneErrors: Record<number, GenerationSceneErrorPayload>;
  done?: GenerationDonePayload;
  error?: GenerationErrorPayload;
  /** 最近一次事件（便于做反馈/音效等） */
  lastEvent?: GenerationEvent;
}

const INITIAL_STATE: GenerationState = {
  status: 'idle',
  scenes: {},
  sceneErrors: {},
};

export function useGenerationSSE() {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const start = useCallback(async (rawInstructions: string) => {
    // 复位
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ ...INITIAL_STATE, status: 'connecting' });

    let res: Response;
    try {
      res = await fetch('/api/engpk/generate-lesson-from-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInstructions }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        setState((s) => ({ ...s, status: 'aborted' }));
        return;
      }
      setState((s) => ({
        ...s,
        status: 'error',
        error: {
          code: 'INTERNAL',
          message: err instanceof Error ? err.message : String(err),
        },
      }));
      return;
    }

    if (!res.ok || !res.body) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body?.error?.message ?? message;
      } catch {
        // ignore
      }
      setState((s) => ({
        ...s,
        status: 'error',
        error: { code: 'INTERNAL', message },
      }));
      return;
    }

    setState((s) => ({ ...s, status: 'streaming' }));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 帧以 \n\n 分隔
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          processFrame(frame, (event) => applyEvent(setState, event));
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setState((s) => ({ ...s, status: 'aborted' }));
      } else {
        setState((s) => ({
          ...s,
          status: 'error',
          error: {
            code: 'INTERNAL',
            message: err instanceof Error ? err.message : String(err),
          },
        }));
      }
      return;
    }

    // 末尾残余（正常结束通常没有）
    if (buffer.trim()) {
      processFrame(buffer, (event) => applyEvent(setState, event));
    }

    setState((s) =>
      s.status === 'streaming' ? { ...s, status: 'done' } : s,
    );
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setState((s) => ({ ...s, status: 'aborted' }));
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  return { state, start, abort, reset };
}

// ========== helpers ==========

/**
 * 从单个 SSE 帧中抽取 data 负载并解析为 JSON。
 * 返回 null 表示该帧是注释/心跳 / data 缺失 / JSON 非法，调用方应忽略。
 *
 * 导出以便单测覆盖。
 */
export function parseSSEFrame(frame: string): GenerationEvent | null {
  const trimmed = frame.trim();
  if (!trimmed) return null;
  const lines = trimmed.split('\n');
  const dataLines: string[] = [];
  for (const ln of lines) {
    if (ln.startsWith(':')) continue;
    if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  try {
    return JSON.parse(dataLines.join('\n')) as GenerationEvent;
  } catch {
    return null;
  }
}

function processFrame(
  frame: string,
  onEvent: (event: GenerationEvent) => void,
): void {
  const event = parseSSEFrame(frame);
  if (event) onEvent(event);
}

function applyEvent(
  setState: React.Dispatch<React.SetStateAction<GenerationState>>,
  event: GenerationEvent,
): void {
  setState((s) => {
    const next: GenerationState = { ...s, lastEvent: event };
    switch (event.type) {
      case 'parsed':
        next.parsed = event.data;
        next.lessonId = event.data.lessonId;
        break;
      case 'teammates-ready':
        next.teammates = event.data;
        break;
      case 'style-ready':
        next.style = event.data;
        break;
      case 'scene-ready':
        next.scenes = { ...s.scenes, [event.data.order]: event.data };
        break;
      case 'scene-error':
        next.sceneErrors = { ...s.sceneErrors, [event.data.order]: event.data };
        break;
      case 'done':
        next.done = event.data;
        next.status = 'done';
        break;
      case 'error':
        next.error = event.data;
        next.status = 'error';
        break;
    }
    return next;
  });
}
