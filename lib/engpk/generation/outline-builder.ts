/**
 * engpk - Outline builder
 *
 * Takes all PageInstructions and produces a CourseOutline via LLM.
 * This is the "expansion" step that MAIC has but engpk was missing.
 *
 * The outline gives each downstream scene generator rich context:
 * keyPoints, concepts, examples, transitions.
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { PageInstruction } from '../instruction/types';
import type { CourseOutline, SceneOutline } from '../types/course-outline';
import { metricBus, makeMetricEvent } from '../metric/bus';
import { createLogger } from '@/lib/logger';
import { OUTLINE_SYSTEM_PROMPT, buildOutlineUserPrompt } from './outline-prompt';

const log = createLogger('engpk:gen:outline');

export interface BuildOutlineOptions {
  instructions: PageInstruction[];
  resolvedModel: ResolvedModel;
  lessonId: string;
}

export async function buildCourseOutline(
  opts: BuildOutlineOptions,
): Promise<CourseOutline> {
  const startedAt = Date.now();
  const { instructions, resolvedModel, lessonId } = opts;

  let parsed: Record<string, unknown> | null = null;
  try {
    const res = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 2500,
        messages: [
          { role: 'system', content: OUTLINE_SYSTEM_PROMPT },
          { role: 'user', content: buildOutlineUserPrompt(instructions) },
        ],
      },
      'engpk-outline',
    );
    parsed = parseJsonResponse<Record<string, unknown>>(res.text);
  } catch (err) {
    log.warn('outline LLM call failed; using fallback outline', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { stage: 'outline' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { stage: 'outline' },
      lessonId,
    }),
  );

  if (parsed) {
    return normalizeOutline(parsed, instructions);
  }

  // Fallback: generate a minimal outline from instructions alone
  return fallbackOutline(instructions);
}

function normalizeOutline(
  raw: Record<string, unknown>,
  instructions: PageInstruction[],
): CourseOutline {
  const lessonTitle = typeof raw.lessonTitle === 'string'
    ? raw.lessonTitle.slice(0, 30)
    : instructions[0]?.description || 'Untitled';

  const learningObjectives = Array.isArray(raw.learningObjectives)
    ? (raw.learningObjectives as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .slice(0, 5)
    : ['Complete this lesson'];

  const subject = typeof raw.subject === 'string' ? raw.subject : '';
  const difficulty = (['beginner', 'intermediate', 'advanced'] as const).includes(
    raw.difficulty as 'beginner',
  )
    ? (raw.difficulty as 'beginner' | 'intermediate' | 'advanced')
    : 'beginner';

  const rawScenes = Array.isArray(raw.scenes) ? (raw.scenes as Record<string, unknown>[]) : [];

  const scenes: SceneOutline[] = instructions.map((inst) => {
    const match = rawScenes.find(
      (s) => s.index === inst.index || s.index === String(inst.index),
    );
    if (match) {
      return normalizeSceneOutline(match, inst);
    }
    return fallbackSceneOutline(inst);
  });

  return { lessonTitle, learningObjectives, subject, difficulty, scenes };
}

function normalizeSceneOutline(
  raw: Record<string, unknown>,
  inst: PageInstruction,
): SceneOutline {
  return {
    index: inst.index,
    mode: inst.mode,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 30) : inst.description,
    keyPoints: normalizeStringArray(raw.keyPoints, 5, [inst.content]),
    concepts: normalizeStringArray(raw.concepts, 4, []),
    examples: normalizeStringArray(raw.examples, 4, []),
    transitionIn: typeof raw.transitionIn === 'string' ? raw.transitionIn.slice(0, 50) : undefined,
    transitionOut: typeof raw.transitionOut === 'string' ? raw.transitionOut.slice(0, 50) : undefined,
    objectives: normalizeStringArray(raw.objectives, 3, []),
  };
}

function normalizeStringArray(
  input: unknown,
  maxLen: number,
  fallback: string[],
): string[] {
  if (!Array.isArray(input)) return fallback;
  return input
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 60))
    .slice(0, maxLen);
}

function fallbackSceneOutline(inst: PageInstruction): SceneOutline {
  // Generate minimal outline from instruction content
  const contentParts = inst.content
    .split(/[,，、/／\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    index: inst.index,
    mode: inst.mode,
    title: inst.description,
    keyPoints: contentParts.length > 0
      ? contentParts.map((p) => '讲解：' + p)
      : [inst.content || inst.description],
    concepts: [],
    examples: [],
    objectives: ['掌握本页内容'],
  };
}

function fallbackOutline(instructions: PageInstruction[]): CourseOutline {
  return {
    lessonTitle: instructions[0]?.description || 'Untitled',
    learningObjectives: ['完成本节课学习'],
    subject: '',
    difficulty: 'beginner',
    scenes: instructions.map(fallbackSceneOutline),
  };
}
