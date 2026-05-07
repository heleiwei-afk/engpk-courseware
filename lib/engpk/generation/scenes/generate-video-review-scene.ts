/**
 * engpk · 视频赏析类场景生成器
 *
 * 流程：
 *   1. 调 LLM 拿 { teacherSpeech, performancePrompt }
 *   2. 校验字段；失败降级为默认值
 *   3. 视频 URL 从指令 content 取
 *   4. performanceCheckIntervalSec 固定 10（决策 #9）
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { VideoReviewScene } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { SpeechAction } from '@/lib/types/action';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import {
  VIDEO_REVIEW_SYSTEM_PROMPT,
  buildVideoReviewUserPrompt,
} from '../prompts/video-review';

const log = createLogger('engpk:gen:video-review');

interface LLMOutput {
  teacherSpeech?: unknown;
  performancePrompt?: unknown;
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `vr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  const t = s.trim();
  return t ? (t.length > max ? t.slice(0, max) : t) : fallback;
}

export interface GenerateVideoReviewSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
}

export async function generateVideoReviewScene(
  opts: GenerateVideoReviewSceneOptions,
): Promise<VideoReviewScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId } = opts;

  let parsed: LLMOutput | null = null;
  try {
    const res = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 300,
        messages: [
          { role: 'system', content: VIDEO_REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: buildVideoReviewUserPrompt(instruction) },
        ],
      },
      'engpk-video-review',
    );
    parsed = parseJsonResponse<LLMOutput>(res.text);
  } catch (err) {
    log.warn('video-review LLM call failed; falling back', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { sceneType: 'video-review' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  const teacherSpeech = clamp(
    parsed?.teacherSpeech,
    60,
    '跟着视频一起动起来吧！表演的同学会获得加分哦。',
  );
  const performancePrompt = clamp(
    parsed?.performancePrompt,
    80,
    '图中的人是否在做表演动作（如唱歌、跳舞、模仿口型）？只回答 yes 或 no。',
  );

  const actions: SpeechAction[] = [
    { id: uuid(), type: 'speech', text: teacherSpeech },
  ];

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'video-review' },
      lessonId,
    }),
  );

  return {
    id: uuid(),
    order: instruction.index,
    type: 'video-review',
    instruction,
    agentIds: teammateIds,
    actions,
    status: 'ready',
    payload: {
      videoUrl: instruction.content,
      performanceCheckIntervalSec: 10,
      cameraRequired: true,
      performancePrompt,
    },
  };
}
