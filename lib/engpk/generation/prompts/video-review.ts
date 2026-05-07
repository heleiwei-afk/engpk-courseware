/**
 * engpk · 视频赏析类 prompt
 *
 * 视频赏析类只让 LLM 生成一句老师引导语 + performancePrompt（给视觉模型的判定 prompt）。
 * 视频 URL 由用户指令提供。
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import { NARRATION_BUDGET_HINT, JSON_OUTPUT_RULES, SAFETY_RULES } from './_shared';

export const VIDEO_REVIEW_SYSTEM_PROMPT = `你是一名少儿互动课件的视频赏析环节设计师。给定视频描述，
请生成一句老师引导语和一个"表演检测 prompt"。

输出 JSON：
{
  "teacherSpeech": "AI 老师的引导语，≤ 60 字，鼓励学生边看边表演",
  "performancePrompt": "给视觉模型的判定 prompt，≤ 80 字，描述什么算'在表演'"
}

performancePrompt 示例：
- "图中的人是否在做口型模仿动作？"
- "图中的人是否在跟着跳舞或做手势？"
- "图中的人是否有明显的表情变化或肢体动作？"

${NARRATION_BUDGET_HINT}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildVideoReviewUserPrompt(instruction: PageInstruction): string {
  return `这是一节课的第 ${instruction.index} 页，模式是【视频赏析】。
描述：${instruction.description}
视频资源：${instruction.content}

请输出 JSON。`;
}
