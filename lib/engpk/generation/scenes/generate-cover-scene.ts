/**
 * engpk · 封面场景生成器
 *
 * 输入：PageInstruction（mode='cover'）+ ResolvedModel
 * 输出：CoverScene（含 styleToken；teacher speech 转成 SpeechAction）
 *
 * 流程：
 *   1. 调 LLM 拿封面 JSON
 *   2. 校验 styleToken 字段；不合法时降级为默认值
 *   3. 老师开场白转 SpeechAction（截到 60 字）
 *   4. 暂不调用图像生成（PR-10 仅返回 prompt；图片生成将在后续 PR 接 lib/media）
 *
 * 注意：
 *   - 不抛错；任何 LLM 异常都回退到 mock 默认值，让边播边生成不阻塞
 *   - 失败信息通过 metricBus 上报（决策 #19）
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { CoverScene, StyleToken } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { SpeechAction } from '@/lib/types/action';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import {
  COVER_SYSTEM_PROMPT,
  buildCoverUserPrompt,
} from '../prompts/cover';

const log = createLogger('engpk:gen:cover');

interface CoverLLMOutput {
  title?: unknown;
  subtitle?: unknown;
  styleToken?: unknown;
  coverImagePrompt?: unknown;
  teacherSpeech?: unknown;
}

const DEFAULT_STYLE: StyleToken = {
  primaryColor: '#7c3aed',
  accentColor: '#22d3ee',
  fontFamily: 'rounded',
  motif: 'fantasy',
};

const FONT_FAMILIES = ['rounded', 'serif', 'mono', 'sans'] as const;
const MOTIFS = [
  'fantasy',
  'tech',
  'nature',
  'ocean',
  'space',
  'classroom',
  'storybook',
] as const;

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampString(s: unknown, maxLen: number, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  const trimmed = s.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function isHex(s: unknown): boolean {
  return typeof s === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(s);
}

function normalizeStyleToken(input: unknown): StyleToken {
  if (!input || typeof input !== 'object') return DEFAULT_STYLE;
  const r = input as Record<string, unknown>;
  return {
    primaryColor: isHex(r.primaryColor) ? (r.primaryColor as string) : DEFAULT_STYLE.primaryColor,
    accentColor: isHex(r.accentColor) ? (r.accentColor as string) : DEFAULT_STYLE.accentColor,
    fontFamily:
      typeof r.fontFamily === 'string' &&
      (FONT_FAMILIES as readonly string[]).includes(r.fontFamily)
        ? (r.fontFamily as StyleToken['fontFamily'])
        : DEFAULT_STYLE.fontFamily,
    motif:
      typeof r.motif === 'string' && (MOTIFS as readonly string[]).includes(r.motif)
        ? (r.motif as StyleToken['motif'])
        : DEFAULT_STYLE.motif,
  };
}

export interface GenerateCoverSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
  courseContext?: string;
}

export async function generateCoverScene(
  opts: GenerateCoverSceneOptions,
): Promise<CoverScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId, courseContext } = opts;

  let parsed: CoverLLMOutput | null = null;
  try {
    const result = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 600,
        messages: [
          { role: 'system', content: COVER_SYSTEM_PROMPT },
          { role: 'user', content: buildCoverUserPrompt(instruction, courseContext) },
        ],
      },
      'engpk-cover',
    );
    parsed = parseJsonResponse<CoverLLMOutput>(result.text);
  } catch (err) {
    log.warn('cover LLM call failed; falling back to defaults', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { sceneType: 'cover' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  // 字段校验 + 降级
  const title = clampString(
    parsed?.title,
    16,
    instruction.content.slice(0, 16) || '新课堂',
  );
  const subtitle = clampString(parsed?.subtitle, 24, '');
  const styleToken = normalizeStyleToken(parsed?.styleToken);
  const coverImagePrompt = clampString(
    parsed?.coverImagePrompt,
    240,
    `cover illustration of "${title}", educational, no text`,
  );
  const teacherSpeechText = clampString(parsed?.teacherSpeech, 60, '');

  const actions: SpeechAction[] = teacherSpeechText
    ? [
        {
          id: uuid(),
          type: 'speech',
          text: teacherSpeechText,
        },
      ]
    : [];

  // metric: 生成耗时 + 叙述长度
  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'cover' },
      lessonId,
    }),
  );
  if (teacherSpeechText) {
    metricBus.dispatch(
      makeMetricEvent({
        name: 'narration.length',
        value: teacherSpeechText.length,
        tags: { sceneType: 'cover' },
        lessonId,
      }),
    );
    metricBus.dispatch(
      makeMetricEvent({
        name: 'narration.count',
        value: 1,
        tags: { sceneType: 'cover' },
        lessonId,
      }),
    );
  }

  const sceneId = uuid();
  return {
    id: sceneId,
    order: instruction.index,
    type: 'cover',
    instruction,
    agentIds: teammateIds,
    actions,
    status: 'ready',
    payload: {
      title,
      subtitle: subtitle || undefined,
      styleToken,
      coverImagePrompt,
      // coverImageUrl: 由后续图像生成 PR 填充
    },
  };
}

export const __test__ = {
  normalizeStyleToken,
  clampString,
  DEFAULT_STYLE,
};
