/**
 * engpk · Teammate 生成器（真 LLM 版）
 *
 * 输入：课程主题（通常取封面 title 或第一页 description）+ ResolvedModel
 * 输出：AITeammate[]（长度固定 3，任何失败都降级到 mock）
 *
 * 流程：
 *   1. 调 LLM 拿 {teammates:[{nickname,bio,archetype,avatarHint}]}
 *   2. 校验每项字段；不合法字段用 mock 池补齐
 *   3. avatarHint → 预设头像 URL（先 emoji 占位，后续换真头像池）
 *   4. 3 人 archetype 去重；不足从池子补
 *
 * 不抛错：任何异常都退回到 mockGenerateTeammates。
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { AITeammate, TeammateArchetype } from '@/lib/engpk/types/teammate';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import {
  TEAMMATES_SYSTEM_PROMPT,
  buildTeammatesUserPrompt,
} from './prompts/teammates';
import { mockGenerateTeammates } from './mock/mock-teammate-generator';

const log = createLogger('engpk:gen:teammates');

const VALID_ARCHETYPES: TeammateArchetype[] = [
  'scholar',
  'energetic',
  'creative',
  'rookie',
  'veteran',
];

/** avatarHint → 头像 URL（暂先用 emoji data-url；PR 后续换真头像池） */
const AVATAR_EMOJI: Record<string, string> = {
  fox: '🦊',
  owl: '🦉',
  rabbit: '🐰',
  panda: '🐼',
  cat: '🐱',
  dog: '🐶',
  koala: '🐨',
  bear: '🐻',
  penguin: '🐧',
  tiger: '🐯',
  monkey: '🐵',
  frog: '🐸',
};

/** 简易 emoji → data-url，不依赖网络 */
function emojiAvatarDataUrl(emoji: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    `<rect width="64" height="64" rx="16" fill="%23f5f5f5"/>` +
    `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="40">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${svg}`;
}

function resolveAvatar(hint?: unknown): string {
  const key = typeof hint === 'string' ? hint.toLowerCase() : '';
  const emoji = AVATAR_EMOJI[key] ?? '🦊';
  return emojiAvatarDataUrl(emoji);
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(s: unknown, maxLen: number, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  const t = s.trim();
  if (!t) return fallback;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function isValidArchetype(x: unknown): x is TeammateArchetype {
  return typeof x === 'string' && (VALID_ARCHETYPES as string[]).includes(x);
}

interface LLMTeammate {
  nickname?: unknown;
  bio?: unknown;
  archetype?: unknown;
  avatarHint?: unknown;
}

interface LLMOutput {
  teammates?: LLMTeammate[];
}

export interface GenerateTeammatesOptions {
  lessonTitle: string;
  subjectHint?: string;
  resolvedModel: ResolvedModel;
  lessonId?: string;
}

export async function generateTeammates(
  opts: GenerateTeammatesOptions,
): Promise<AITeammate[]> {
  const startedAt = Date.now();
  let parsed: LLMOutput | null = null;

  try {
    const res = await callLLM(
      {
        model: opts.resolvedModel.model,
        maxOutputTokens: 600,
        messages: [
          { role: 'system', content: TEAMMATES_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildTeammatesUserPrompt({
              lessonTitle: opts.lessonTitle,
              subjectHint: opts.subjectHint,
            }),
          },
        ],
      },
      'engpk-teammates',
    );
    parsed = parseJsonResponse<LLMOutput>(res.text);
  } catch (err) {
    log.warn('teammate LLM call failed; using mock', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { stage: 'teammates' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId: opts.lessonId,
      }),
    );
  }

  const candidates = Array.isArray(parsed?.teammates) ? parsed!.teammates! : [];
  const usedArchetypes = new Set<TeammateArchetype>();
  const result: AITeammate[] = [];

  for (const raw of candidates.slice(0, 3)) {
    const nickname = clamp(raw.nickname, 6, '');
    if (!nickname) continue;
    let archetype: TeammateArchetype = isValidArchetype(raw.archetype)
      ? raw.archetype
      : pickFreshArchetype(usedArchetypes);
    if (usedArchetypes.has(archetype)) {
      archetype = pickFreshArchetype(usedArchetypes);
    }
    usedArchetypes.add(archetype);
    result.push({
      id: uuid(),
      nickname,
      bio: clamp(raw.bio, 30, `${archetype} 型学习伙伴`),
      archetype,
      avatar: resolveAvatar(raw.avatarHint),
      score: 0,
    });
  }

  // 不够 3 人：用 mock 池补
  if (result.length < 3) {
    const fallback = mockGenerateTeammates().filter(
      (m) => !usedArchetypes.has(m.archetype),
    );
    while (result.length < 3 && fallback.length > 0) {
      const t = fallback.shift()!;
      usedArchetypes.add(t.archetype);
      result.push(t);
    }
  }

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { stage: 'teammates' },
      lessonId: opts.lessonId,
    }),
  );

  return result.slice(0, 3);
}

function pickFreshArchetype(used: Set<TeammateArchetype>): TeammateArchetype {
  for (const a of VALID_ARCHETYPES) if (!used.has(a)) return a;
  return 'scholar';
}

export const __test__ = {
  resolveAvatar,
  isValidArchetype,
  clamp,
  AVATAR_EMOJI,
};
