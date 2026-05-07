/**
 * engpk · 生成管线
 *
 * 输入：原始指令文本 + 解析批次结果 + ResolvedModel（可选）
 * 输出：异步 generator，逐步 yield SSE 事件
 *
 * 流程（决策 #13：边播边生成）：
 *   1. parsed       立刻发（由 route handler 触发）
 *   2. teammates    mock 生成 3 位队友（PR-11 接真生成器）
 *   3. style        先生成封面 → 封面内部产出 styleToken → 发 style-ready
 *      若指令里没有封面页，就生成默认 styleToken 后直接发
 *   4. scene-ready  并发生成其它场景；完成一页推一页
 *                   失败的页发 scene-error，不阻塞其它
 *   5. done         全部完成后发汇总
 *
 * PR-10：封面类已切到真 LLM 生成（generateCoverScene）；其它类型仍走 mock。
 */

import type {
  GenerationEvent,
  GenerationParsedPayload,
} from '@/lib/engpk/types/generation-events';
import type { Lesson, Scene, StyleToken } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import {
  mockGenerateScene,
  mockStyleToken,
  uuid,
} from './mock/mock-scene-generator';
import { mockGenerateTeammates } from './mock/mock-teammate-generator';
import {
  saveLesson,
  setLessonStatus,
  upsertScene,
} from './lesson-registry';
import { generateCoverScene } from './scenes/generate-cover-scene';

export interface RunPipelineInput {
  lessonId: string;
  rawInstructions: string;
  parseResult: GenerationParsedPayload;
  /** 外部中断信号 */
  signal?: AbortSignal;
  /**
   * 已解析的模型；为空表示路由未传入（当前的 mock 链路也支持，封面会降级为 mock）
   */
  resolvedModel?: ResolvedModel;
}

export async function* runMockGenerationPipeline(
  input: RunPipelineInput,
): AsyncGenerator<GenerationEvent, void, void> {
  const { lessonId, rawInstructions, parseResult, signal, resolvedModel } = input;
  const instructions = parseResult.batch.validInstructions;

  // 没有合法指令 → 整体失败
  if (instructions.length === 0) {
    yield {
      type: 'error',
      data: {
        code: 'NO_VALID_INSTRUCTIONS',
        message: '没有解析到任何合法指令',
        parseErrors: parseResult.batch.lines
          .filter((l) => !l.ok)
          .map((l) => (l.ok ? null : l.error))
          .filter((e): e is NonNullable<typeof e> => Boolean(e)),
      },
    };
    return;
  }

  // ========== 1. 生成队友 ==========
  if (signal?.aborted) return;
  const teammates = mockGenerateTeammates();
  const teammateIds = teammates.map((t) => t.id);

  // 先占位写入 lesson（空 scenes）
  const firstCover = instructions.find((i) => i.mode === 'cover');
  const title =
    firstCover?.content?.trim() || firstCover?.description?.trim() || '新课堂';

  const lesson: Lesson = {
    id: lessonId,
    title,
    rawInstructions,
    instructions,
    teammates,
    scenes: [],
    createdAt: new Date(),
    status: 'generating',
  };
  saveLesson(lesson);

  yield { type: 'teammates-ready', data: { lessonId, teammates } };

  // ========== 2. 先生成封面（或默认 style）==========
  if (signal?.aborted) return;
  let styleToken: StyleToken = mockStyleToken();

  const sortedInstructions = [...instructions].sort((a, b) => a.index - b.index);
  const coverIdx = sortedInstructions.findIndex((i) => i.mode === 'cover');

  if (coverIdx >= 0) {
    const coverInstruction = sortedInstructions[coverIdx];
    try {
      const coverScene = resolvedModel
        ? await generateCoverScene({
            instruction: coverInstruction,
            resolvedModel,
            teammateIds,
            lessonId,
          })
        : await mockGenerateScene(coverInstruction, styleToken, teammateIds);
      if (coverScene.type === 'cover') {
        styleToken = coverScene.payload.styleToken;
      }
      upsertScene(lessonId, coverScene);
      yield { type: 'style-ready', data: { lessonId, styleToken } };
      yield {
        type: 'scene-ready',
        data: {
          lessonId,
          scene: coverScene,
          order: coverScene.order,
        },
      };
      // 已生成的封面从剩余列表剔除
      sortedInstructions.splice(coverIdx, 1);
    } catch (err) {
      yield {
        type: 'scene-error',
        data: {
          lessonId,
          order: coverInstruction.index,
          instruction: coverInstruction,
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        },
      };
      // 封面失败仍然发一个默认 style，让其它页可以继续
      yield { type: 'style-ready', data: { lessonId, styleToken } };
      sortedInstructions.splice(coverIdx, 1);
    }
  } else {
    // 没有封面页，发默认 style
    yield { type: 'style-ready', data: { lessonId, styleToken } };
  }

  // ========== 3. 顺序生成剩余场景（其它类型仍走 mock）==========
  let succeeded = coverIdx >= 0 ? 1 : 0;
  let failed = 0;

  for (const instruction of sortedInstructions) {
    if (signal?.aborted) return;
    try {
      const scene = await generateOneScene({
        instruction,
        styleToken,
        teammateIds,
        lessonId,
        resolvedModel,
      });
      upsertScene(lessonId, scene);
      yield {
        type: 'scene-ready',
        data: {
          lessonId,
          scene,
          order: scene.order,
        },
      };
      succeeded += 1;
    } catch (err) {
      yield {
        type: 'scene-error',
        data: {
          lessonId,
          order: instruction.index,
          instruction,
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        },
      };
      failed += 1;
    }
  }

  // ========== 4. 收尾 ==========
  const finalStatus: Lesson['status'] =
    failed === 0 ? 'ready' : 'partial-failure';
  setLessonStatus(lessonId, finalStatus);

  yield {
    type: 'done',
    data: {
      lessonId,
      succeeded,
      failed,
      total: instructions.length,
      lesson: {
        id: lessonId,
        title,
        status: finalStatus,
        createdAt: lesson.createdAt,
      },
    },
  };
}

interface GenerateOneOptions {
  instruction: PageInstruction;
  styleToken: StyleToken;
  teammateIds: string[];
  lessonId: string;
  resolvedModel?: ResolvedModel;
}

async function generateOneScene(opts: GenerateOneOptions): Promise<Scene> {
  // 每个 mode 的真实生成器在后续 PR 接入；
  // 这里 cover 已切真 LLM，其它仍走 mock。
  if (opts.instruction.mode === 'cover' && opts.resolvedModel) {
    return generateCoverScene({
      instruction: opts.instruction,
      resolvedModel: opts.resolvedModel,
      teammateIds: opts.teammateIds,
      lessonId: opts.lessonId,
    });
  }
  return mockGenerateScene(opts.instruction, opts.styleToken, opts.teammateIds);
}

/** 便于测试：生成一个 lessonId。 */
export function makeLessonId(): string {
  return uuid();
}
