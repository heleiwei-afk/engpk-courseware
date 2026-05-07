import { describe, it, expect } from 'vitest';
import {
  makeLessonId,
  runMockGenerationPipeline,
} from '@/lib/engpk/generation/pipeline';
import { parseLocally } from '@/lib/engpk/instruction';
import type { GenerationEvent } from '@/lib/engpk/types/generation-events';
import { clearAll, getLesson } from '@/lib/engpk/generation/lesson-registry';

async function collect(
  gen: AsyncGenerator<GenerationEvent, void, void>,
): Promise<GenerationEvent[]> {
  const events: GenerationEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe('runMockGenerationPipeline', () => {
  it('emits teammates → style → scene-ready(×N) → done for valid input', async () => {
    clearAll();
    const rawInstructions = [
      '第1页：【封面】+奇幻英语冒险+内容：Level 1 启程',
      '第2页：【图文】+语法拆解+内容：this 作主语',
      '第3页：【游戏】+单词闯关+内容：is, you, here, this',
    ].join('\n');

    const batch = parseLocally(rawInstructions);
    const lessonId = makeLessonId();

    const events = await collect(
      runMockGenerationPipeline({
        lessonId,
        rawInstructions,
        parseResult: { lessonId, batch, usedFallback: false },
      }),
    );

    const types = events.map((e) => e.type);
    expect(types[0]).toBe('teammates-ready');
    expect(types).toContain('style-ready');
    expect(types).toContain('scene-ready');
    expect(types[types.length - 1]).toBe('done');

    const done = events.find((e) => e.type === 'done');
    if (done?.type === 'done') {
      expect(done.data.succeeded).toBe(3);
      expect(done.data.failed).toBe(0);
      expect(done.data.total).toBe(3);
      expect(done.data.lesson.status).toBe('ready');
    }

    // lesson 注册到内存
    const lesson = getLesson(lessonId);
    expect(lesson).toBeDefined();
    expect(lesson?.scenes.length).toBe(3);
  });

  it('emits error when no valid instructions', async () => {
    clearAll();
    const rawInstructions = '完全无法解析的一行';
    const batch = parseLocally(rawInstructions);
    const lessonId = makeLessonId();

    const events = await collect(
      runMockGenerationPipeline({
        lessonId,
        rawInstructions,
        parseResult: { lessonId, batch, usedFallback: false },
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    if (events[0].type === 'error') {
      expect(events[0].data.code).toBe('NO_VALID_INSTRUCTIONS');
    }
  });

  it('respects abort signal', async () => {
    clearAll();
    const rawInstructions = [
      '第1页：【封面】+a+内容：x',
      '第2页：【图文】+b+内容：y',
      '第3页：【图文】+c+内容：z',
      '第4页：【图文】+d+内容：w',
    ].join('\n');
    const batch = parseLocally(rawInstructions);
    const lessonId = makeLessonId();

    const controller = new AbortController();
    const events: GenerationEvent[] = [];
    const gen = runMockGenerationPipeline({
      lessonId,
      rawInstructions,
      parseResult: { lessonId, batch, usedFallback: false },
      signal: controller.signal,
    });

    for await (const e of gen) {
      events.push(e);
      if (events.length === 2) controller.abort();
    }

    // 中止后不再继续发 scene-ready，但至少已经发了若干
    expect(events.length).toBeLessThan(6); // 4 scenes + teammates + style + done = 7
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('generates default style when no cover page', async () => {
    clearAll();
    const rawInstructions = '第1页：【图文】+a+内容：x';
    const batch = parseLocally(rawInstructions);
    const lessonId = makeLessonId();

    const events = await collect(
      runMockGenerationPipeline({
        lessonId,
        rawInstructions,
        parseResult: { lessonId, batch, usedFallback: false },
      }),
    );

    // style-ready 事件应该在 teammates-ready 之后出现
    const teammatesIdx = events.findIndex((e) => e.type === 'teammates-ready');
    const styleIdx = events.findIndex((e) => e.type === 'style-ready');
    expect(styleIdx).toBeGreaterThan(teammatesIdx);
  });
});
