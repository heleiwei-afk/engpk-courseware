/**
 * engpk · 暖场类 prompt
 *
 * 暖场类只让 LLM 生成 beatmap（节拍谱）+ 一句老师引导语。
 * 视频 URL 由用户指令提供，不需要 LLM 生成。
 *
 * beatmap 格式：{ timeMs, lane, type: 'tap'|'hold', holdMs? }[]
 * 要求 timeMs 严格单调递增。
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import {
  NARRATION_BUDGET_HINT,
  JSON_OUTPUT_RULES,
  SAFETY_RULES,
} from './_shared';

export const WARMUP_SYSTEM_PROMPT = `你是一名少儿互动课件的节奏游戏设计师。给定暖场视频信息，
请生成一份节拍谱（beatmap）和一句老师引导语。

输出 JSON：
{
  "durationMs": 视频时长毫秒数（如 60000 表示 60 秒；若不确定默认 60000）,
  "laneCount": 4 | 5 | 6（推荐 4，适合小朋友）,
  "difficulty": "easy" | "normal" | "hard"（推荐 easy）,
  "beatmap": [
    { "timeMs": 1000, "lane": 0, "type": "tap" },
    { "timeMs": 1600, "lane": 2, "type": "tap" },
    ...
  ],
  "teacherSpeech": "AI 老师的一句引导语，≤ 60 字"
}

beatmap 要求：
- timeMs 严格单调递增（每个 > 前一个）
- 第一个 timeMs ≥ 1000（给玩家准备时间）
- 最后一个 timeMs < durationMs
- 每秒 1-2 拍（easy）/ 2-3 拍（normal）/ 3-4 拍（hard）
- lane 范围 0..laneCount-1
- type 大部分为 'tap'；偶尔 'hold'（holdMs 200-800）
- 总拍数 = durationMs / 1000 × 每秒拍数（±20%）

${NARRATION_BUDGET_HINT}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildWarmupUserPrompt(instruction: PageInstruction): string {
  return `这是一节课的第 ${instruction.index} 页，模式是【暖场】。
描述：${instruction.description}
暖场视频资源：${instruction.content}

请生成适合小朋友的节拍谱（easy 难度优先）。`;
}
