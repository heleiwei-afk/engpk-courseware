/**
 * engpk · 生成 SSE 事件协议
 *
 * 服务端 /api/generate-lesson-from-instructions 在 SSE 流中按以下顺序发送：
 *
 *   parsed          解析完成（可能包含 LLM 归一化结果）
 *   teammates-ready 队友 persona 生成完成
 *   style-ready     封面生成后产出风格 token，后续页可复用
 *   scene-ready     单页生成完成（多次，每完成一页推一次）
 *   scene-error     单页生成失败（可重试，失败不阻塞其它页）
 *   done            全部页生成完成（含部分失败信息）
 *   error           整体失败（流终止）
 *
 * 客户端在收到第一个 scene-ready 后立即跳转 /classroom-engpk/[id]，
 * 后续页面在课堂内继续接收 SSE 增量补齐目录（决策 #13：边播边生成）。
 */

import type { AITeammate } from '../types/teammate';
import type { Lesson, Scene, StyleToken } from '../types/scene-v2';
import type {
  InstructionBatchResult,
  InstructionParseError,
  PageInstruction,
} from '../instruction/types';

export type GenerationEvent =
  | { type: 'parsed'; data: GenerationParsedPayload }
  | { type: 'teammates-ready'; data: GenerationTeammatesPayload }
  | { type: 'outline-ready'; data: GenerationOutlinePayload }
  | { type: 'style-ready'; data: GenerationStylePayload }
  | { type: 'scene-ready'; data: GenerationScenePayload }
  | { type: 'scene-error'; data: GenerationSceneErrorPayload }
  | { type: 'done'; data: GenerationDonePayload }
  | { type: 'error'; data: GenerationErrorPayload };

export interface GenerationParsedPayload {
  /** 课程 id（由服务端生成） */
  lessonId: string;
  /** 解析批次结果（含合法 + 错误） */
  batch: InstructionBatchResult;
  /** 是否走了 LLM 归一化兜底 */
  usedFallback: boolean;
}

export interface GenerationTeammatesPayload {
  lessonId: string;
  teammates: AITeammate[];
}

export interface GenerationOutlinePayload {
  lessonId: string;
  /** LLM 提炼的课程标题 */
  lessonTitle: string;
  /** 整课学习目标 */
  learningObjectives: string[];
  /** 大纲覆盖的页数 */
  scenesCount: number;
}

export interface GenerationStylePayload {
  lessonId: string;
  styleToken: StyleToken;
}

export interface GenerationScenePayload {
  lessonId: string;
  /** 已就绪的场景（已校验通过、可立即播放） */
  scene: Scene;
  /** 在 lesson 内的顺序（1-based） */
  order: number;
}

export interface GenerationSceneErrorPayload {
  lessonId: string;
  order: number;
  /** 来源指令（便于客户端高亮目录中失败行） */
  instruction: PageInstruction;
  message: string;
  /** 是否可重试 */
  retryable: boolean;
}

export interface GenerationDonePayload {
  lessonId: string;
  /** 已完成 / 失败 / 总数 */
  succeeded: number;
  failed: number;
  total: number;
  /** 完整 lesson 元数据（不含 scenes 详情，只含 id/title/状态） */
  lesson: Pick<Lesson, 'id' | 'title' | 'status' | 'createdAt'>;
}

export interface GenerationErrorPayload {
  /** 错误码（短名） */
  code: 'INVALID_INPUT' | 'NO_VALID_INSTRUCTIONS' | 'INTERNAL' | 'PARSE_FAILED';
  message: string;
  /** 调试用的解析错误明细 */
  parseErrors?: InstructionParseError[];
}

// ==================== SSE 帧序列化辅助 ====================

/** 把事件序列化为 SSE 帧文本 */
export function formatSSE(event: GenerationEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
