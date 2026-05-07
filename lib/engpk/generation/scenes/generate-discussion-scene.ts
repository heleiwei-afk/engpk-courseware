/**
 * engpk · 讨论类场景生成器
 *
 * 生成阶段只产出静态内容（topic / task / rule / 老师开场白）。
 * 实际多 agent 讨论由运行时 LangGraph 驱动（决策 #5）。
 *
 * 流程：
 *   1. 调 LLM 拿 { topic, task, rule, expectedRounds, teacherOpening }
 *   2. 校验字段；不合法时用指令内容降级
 *   3. teacherOpening 转为 SpeechAction
 *   4. 失败完全降级为从指令直接提取
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { DiscussionScene } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { SpeechAction } from '@/lib/types/action';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import {
  DISCUSSION_SYSTEM_PROMPT,
  buildDiscussionUserPrompt,
} from '../prompts/discussion';

const log = createLogger('engpk:gen:discussion');

interface LLMOutput {
  topic?: unknown;
  task?: unknown;
  rule?: unknown;
  expectedRounds?: unknown;
  teacherOpening?: unknown;
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  const t = s.trim();
  if (!t) return fallback;
  return t.length > max ? t.slice(0, max) : t;
}

export interface GenerateDiscussionSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
}

export async function generateDiscussionScene(
  opts: GenerateDiscussionSceneOptions,
): Promise<DiscussionScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId } = opts;

  let parsed: LLMOutput | null = null;
  try {
    const res = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 500,
        messages: [
          { role: 'system', content: DISCUSSION_SYSTEM_PROMPT },
          { role: 'user', content: buildDiscussionUserPrompt(instruction) },
        ],
      },
      'engpk-discussion',
    );
    parsed = parseJsonResponse<LLMOutput>(res.text);
  } catch (err) {
    log.warn('discussion LLM call failed; falling back', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { sceneType: 'discussion' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  const topic = clamp(parsed?.topic, 20, instruction.description.slice(0, 20));
  const task = clamp(parsed?.task, 60, instruction.content.slice(0, 60));
  const rule = clamp(
    parsed?.rule,
    60,
    '每人依次发言，AI 老师最后总结。可以随时举手插话。',
  );
  const expectedRounds =
    typeof parsed?.expectedRounds === 'number' &&
    parsed.expectedRounds >= 2 &&
    parsed.expectedRounds <= 8
      ? Math.floor(parsed.expectedRounds)
      : 3;
  const teacherOpening = clamp(
    parsed?.teacherOpening,
    60,
    `好，我们来讨论一下：${topic}`,
  );

  const actions: SpeechAction[] = [
    { id: uuid(), type: 'speech', text: teacherOpening },
  ];

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'discussion' },
      lessonId,
    }),
  );

  return {
    id: uuid(),
    order: instruction.index,
    type: 'discussion',
    instruction,
    agentIds: teammateIds,
    actions,
    status: 'ready',
    payload: {
      topic,
      task,
      rule,
      expectedRounds,
    },
  };
}
