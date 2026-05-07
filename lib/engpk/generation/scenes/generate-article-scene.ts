/**
 * engpk · 图文类场景生成器
 *
 * 输入：PageInstruction（mode='article'）+ ResolvedModel + styleToken
 * 输出：ArticleScene
 *
 * 流程：
 *   1. 调 LLM 拿 { heading, blocks[], teacherSpeeches[], focusBlockIndexes[] }
 *   2. 校验：
 *      - block 类型必须合法；非法 block 丢弃
 *      - heading clamp 20 字；paragraph/highlight text / bullet item 各自 clamp
 *      - teacherSpeeches 每条 clamp 90 字（决策 #3 图文例外，允许较长）
 *      - focusBlockIndexes 与 speech 长度不一致时对齐（多删少补 -1）
 *   3. 转换 teacherSpeeches 为 SpeechAction[]（带 speaker 字段为空表示老师）
 *   4. 失败完全降级：生成单段 paragraph + 一句默认老师讲解
 *   5. metricBus 上报：generation.duration / narration.length / narration.count
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type {
  ArticleBlock,
  ArticleScene,
} from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { SpeechAction } from '@/lib/types/action';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import {
  ARTICLE_SYSTEM_PROMPT,
  buildArticleUserPrompt,
} from '../prompts/article';

const log = createLogger('engpk:gen:article');

interface LLMOutput {
  heading?: unknown;
  blocks?: unknown;
  teacherSpeeches?: unknown;
  focusBlockIndexes?: unknown;
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampText(s: unknown, maxLen: number): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function normalizeBlocks(input: unknown): ArticleBlock[] {
  if (!Array.isArray(input)) return [];
  const out: ArticleBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    switch (r.type) {
      case 'paragraph': {
        const text = clampText(r.text, 90);
        if (text) out.push({ type: 'paragraph', text });
        break;
      }
      case 'bullet-list': {
        if (!Array.isArray(r.items)) break;
        const items = r.items
          .map((it) => clampText(it, 24))
          .filter((it): it is string => !!it)
          .slice(0, 5);
        if (items.length >= 2) out.push({ type: 'bullet-list', items });
        break;
      }
      case 'highlight': {
        const text = clampText(r.text, 40);
        if (text) out.push({ type: 'highlight', text });
        break;
      }
      case 'image': {
        const prompt = clampText(r.prompt, 200);
        if (prompt) {
          const block: ArticleBlock = { type: 'image', prompt };
          const caption = clampText(r.caption, 40);
          if (caption) block.caption = caption;
          out.push(block);
        }
        break;
      }
      default:
        // 丢弃非法类型
        break;
    }
  }
  return out;
}

function normalizeSpeeches(input: unknown, perLen = 90): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => clampText(s, perLen))
    .filter((s): s is string => !!s)
    .slice(0, 6);
}

function alignFocusIndexes(input: unknown, speechCount: number, blockCount: number): number[] {
  const raw = Array.isArray(input) ? input : [];
  const out: number[] = [];
  for (let i = 0; i < speechCount; i++) {
    const v = raw[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const n = Math.trunc(v);
      if (n === -1) out.push(-1);
      else if (n >= 0 && n < blockCount) out.push(n);
      else out.push(-1);
    } else {
      out.push(-1);
    }
  }
  return out;
}

export interface GenerateArticleSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
  courseContext?: string;
}

export async function generateArticleScene(
  opts: GenerateArticleSceneOptions,
): Promise<ArticleScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId, courseContext } = opts;

  let parsed: LLMOutput | null = null;
  try {
    const res = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 1200,
        messages: [
          { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
          { role: 'user', content: buildArticleUserPrompt(instruction, courseContext) },
        ],
      },
      'engpk-article',
    );
    parsed = parseJsonResponse<LLMOutput>(res.text);
  } catch (err) {
    log.warn('article LLM call failed; falling back', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { sceneType: 'article' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  const heading = clampText(parsed?.heading, 20) ?? instruction.description.slice(0, 20) ?? '图文讲解';
  let blocks = normalizeBlocks(parsed?.blocks);
  if (blocks.length === 0) {
    blocks = [
      { type: 'paragraph', text: instruction.content.slice(0, 90) || '（内容待补充）' },
    ];
  }

  const speechTexts = normalizeSpeeches(parsed?.teacherSpeeches, 90);
  const speechesFinal = speechTexts.length > 0 ? speechTexts : ['我们一起来看看这一页的内容。'];
  const focus = alignFocusIndexes(parsed?.focusBlockIndexes, speechesFinal.length, blocks.length);

  const actions: SpeechAction[] = speechesFinal.map((text) => ({
    id: uuid(),
    type: 'speech',
    text,
  }));

  // metrics
  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'article' },
      lessonId,
    }),
  );
  metricBus.dispatch(
    makeMetricEvent({
      name: 'narration.count',
      value: speechesFinal.length,
      tags: { sceneType: 'article' },
      lessonId,
    }),
  );
  for (const s of speechesFinal) {
    metricBus.dispatch(
      makeMetricEvent({
        name: 'narration.length',
        value: s.length,
        tags: { sceneType: 'article' },
        lessonId,
      }),
    );
  }

  return {
    id: uuid(),
    order: instruction.index,
    type: 'article',
    instruction,
    agentIds: teammateIds,
    actions,
    status: 'ready',
    payload: {
      heading,
      blocks,
      focusBlockIndexes: focus,
    },
  };
}

export const __test__ = {
  normalizeBlocks,
  normalizeSpeeches,
  alignFocusIndexes,
  clampText,
};
