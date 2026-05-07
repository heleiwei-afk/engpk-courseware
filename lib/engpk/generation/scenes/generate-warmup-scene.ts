/**
 * engpk · 暖场类场景生成器
 *
 * 流程：
 *   1. 调 LLM 拿 { durationMs, laneCount, difficulty, beatmap[], teacherSpeech }
 *   2. 校验 beatmap：timeMs 单调递增、lane 合法、type 合法
 *   3. 失败降级为 mock beatmap（每 600ms 一拍）
 *   4. teacherSpeech 转 SpeechAction
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { BeatmapNote, WarmupScene } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { SpeechAction } from '@/lib/types/action';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import { WARMUP_SYSTEM_PROMPT, buildWarmupUserPrompt } from '../prompts/warmup';

const log = createLogger('engpk:gen:warmup');

interface LLMOutput {
  durationMs?: unknown;
  laneCount?: unknown;
  difficulty?: unknown;
  beatmap?: unknown;
  teacherSpeech?: unknown;
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `warm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  const t = s.trim();
  return t ? (t.length > max ? t.slice(0, max) : t) : fallback;
}

function normalizeLaneCount(x: unknown): 4 | 5 | 6 {
  if (x === 5) return 5;
  if (x === 6) return 6;
  return 4;
}

function normalizeDifficulty(x: unknown): 'easy' | 'normal' | 'hard' {
  if (x === 'normal') return 'normal';
  if (x === 'hard') return 'hard';
  return 'easy';
}

function normalizeBeatmap(
  raw: unknown,
  durationMs: number,
  laneCount: number,
): BeatmapNote[] {
  if (!Array.isArray(raw)) return [];
  const out: BeatmapNote[] = [];
  let lastTime = 0;

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const timeMs = typeof r.timeMs === 'number' ? Math.floor(r.timeMs) : -1;
    if (timeMs <= lastTime || timeMs >= durationMs) continue;
    const lane = typeof r.lane === 'number' ? Math.floor(r.lane) : 0;
    if (lane < 0 || lane >= laneCount) continue;
    const type = r.type === 'hold' ? 'hold' : 'tap';
    const holdMs =
      type === 'hold' && typeof r.holdMs === 'number'
        ? Math.min(Math.max(Math.floor(r.holdMs), 100), 1000)
        : undefined;
    out.push({ timeMs, lane, type, holdMs });
    lastTime = timeMs;
  }
  return out;
}

function mockBeatmap(durationMs: number, laneCount: number): BeatmapNote[] {
  const notes: BeatmapNote[] = [];
  for (let t = 1000; t < durationMs; t += 600) {
    notes.push({
      timeMs: t,
      lane: Math.floor(Math.random() * laneCount),
      type: 'tap',
    });
  }
  return notes;
}

export interface GenerateWarmupSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
  courseContext?: string;
}

export async function generateWarmupScene(
  opts: GenerateWarmupSceneOptions,
): Promise<WarmupScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId, courseContext } = opts;

  let parsed: LLMOutput | null = null;
  try {
    const res = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 2000,
        messages: [
          { role: 'system', content: WARMUP_SYSTEM_PROMPT },
          { role: 'user', content: buildWarmupUserPrompt(instruction, courseContext) },
        ],
      },
      'engpk-warmup',
    );
    parsed = parseJsonResponse<LLMOutput>(res.text);
  } catch (err) {
    log.warn('warmup LLM call failed; falling back', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { sceneType: 'warmup' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  const durationMs =
    typeof parsed?.durationMs === 'number' && parsed.durationMs > 0
      ? Math.floor(parsed.durationMs)
      : 60_000;
  const laneCount = normalizeLaneCount(parsed?.laneCount);
  const difficulty = normalizeDifficulty(parsed?.difficulty);

  let beatmap = normalizeBeatmap(parsed?.beatmap, durationMs, laneCount);
  if (beatmap.length < 10) {
    // 太少拍 → 降级为 mock
    beatmap = mockBeatmap(durationMs, laneCount);
  }

  const teacherSpeech = clamp(
    parsed?.teacherSpeech,
    60,
    '准备好了吗？跟着节奏动起来！',
  );

  const actions: SpeechAction[] = [
    { id: uuid(), type: 'speech', text: teacherSpeech },
  ];

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'warmup' },
      lessonId,
    }),
  );

  return {
    id: uuid(),
    order: instruction.index,
    type: 'warmup',
    instruction,
    agentIds: teammateIds,
    actions,
    status: 'ready',
    payload: {
      warmupVideoUrl: instruction.content,
      rhythmGame: {
        durationMs,
        laneCount,
        difficulty,
        beatmap,
      },
    },
  };
}

export const __test__ = { normalizeBeatmap, mockBeatmap };
