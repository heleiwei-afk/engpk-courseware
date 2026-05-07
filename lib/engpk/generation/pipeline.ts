/**
 * engpk · 生成管线
 *
 * 流程（决策 #13：边播边生成）：
 *   1. parsed       立刻发（由 route handler 触发）
 *   2. teammates    实 LLM 生成 3 位队友（失败降级 mock）
 *   3. style        先生成封面 → 封面内部产出 styleToken → 发 style-ready
 *      若指令里没有封面页，就生成默认 styleToken 后直接发
 *   4. scene-ready  顺序生成其它场景；完成一页推一页
 *                   失败的页发 scene-error，不阻塞其它
 *   5. done         全部完成后发汇总
 *
 * 真生成器已接入：cover / teammates / article。
 * 其它类型（warmup / video-review / game / discussion / ending）暂仍走 mock。
 */

import type {
  GenerationEvent,
  GenerationParsedPayload,
} from '@/lib/engpk/types/generation-events';
import type { Lesson, Scene, StyleToken } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { AITeammate } from '@/lib/engpk/types/teammate';
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
import { generateArticleScene } from './scenes/generate-article-scene';
import { generateEndingScene } from './scenes/generate-ending-scene';
import { generateDiscussionScene } from './scenes/generate-discussion-scene';
import { generateGameScene } from './scenes/generate-game-scene';
import { generateWarmupScene } from './scenes/generate-warmup-scene';
import { generateVideoReviewScene } from './scenes/generate-video-review-scene';
import { generateTeammates } from './generate-teammates';

export interface RunPipelineInput {
  lessonId: string;
  rawInstructions: string;
  parseResult: GenerationParsedPayload;
  signal?: AbortSignal;
  resolvedModel?: ResolvedModel;
}

export async function* runMockGenerationPipeline(
  input: RunPipelineInput,
): AsyncGenerator<GenerationEvent, void, void> {
  const { lessonId, rawInstructions, parseResult, signal, resolvedModel } = input;
  const instructions = parseResult.batch.validInstructions;

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

  // 从封面推 title（用于 teammate prompt 与 lesson title）
  const firstCover = instructions.find((i) => i.mode === 'cover');
  const title =
    firstCover?.content?.trim() || firstCover?.description?.trim() || '新课堂';

  // ========== 0. 立刻保存 lesson 占位（避免课堂页轮询拿 404） ==========
  // 即使后续 LLM 调用慢，客户端也能立刻在 /api/engpk/lessons/[id] 拿到记录。
  if (signal?.aborted) return;
  const lesson: Lesson = {
    id: lessonId,
    title,
    rawInstructions,
    instructions,
    teammates: [], // 占位，下面生成完会更新
    scenes: [],
    createdAt: new Date(),
    status: 'generating',
  };
  saveLesson(lesson);

  // ========== 1. 生成队友（真 LLM 或 mock） ==========
  let teammates: AITeammate[];
  try {
    teammates = resolvedModel
      ? await generateTeammates({
          lessonTitle: title,
          resolvedModel,
          lessonId,
        })
      : mockGenerateTeammates();
  } catch {
    teammates = mockGenerateTeammates();
  }
  const teammateIds = teammates.map((t) => t.id);

  // 更新 lesson 的 teammates（同一引用，registry 不需要重写）
  lesson.teammates = teammates;

  yield { type: 'teammates-ready', data: { lessonId, teammates } };

  // ========== 2. 先生成封面（或默认 style） ==========
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
        data: { lessonId, scene: coverScene, order: coverScene.order },
      };
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
      yield { type: 'style-ready', data: { lessonId, styleToken } };
      sortedInstructions.splice(coverIdx, 1);
    }
  } else {
    yield { type: 'style-ready', data: { lessonId, styleToken } };
  }

  // ========== 3. 顺序生成剩余场景 ==========
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
        data: { lessonId, scene, order: scene.order },
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
  if (opts.resolvedModel) {
    switch (opts.instruction.mode) {
      case 'cover':
        return generateCoverScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      case 'article':
        return generateArticleScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      case 'ending':
        return generateEndingScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      case 'discussion':
        return generateDiscussionScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      case 'game':
        return generateGameScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      case 'warmup':
        return generateWarmupScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      case 'video-review':
        return generateVideoReviewScene({
          instruction: opts.instruction,
          resolvedModel: opts.resolvedModel,
          teammateIds: opts.teammateIds,
          lessonId: opts.lessonId,
        });
      default:
        return mockGenerateScene(
          opts.instruction,
          opts.styleToken,
          opts.teammateIds,
        );
    }
  }
  return mockGenerateScene(opts.instruction, opts.styleToken, opts.teammateIds);
}

export function makeLessonId(): string {
  return uuid();
}
