/**
 * engpk · 封面类 prompt
 *
 * 输入：PageInstruction（mode='cover'）
 * 输出（JSON）：
 *   {
 *     title: string,           // ≤ 16 字
 *     subtitle?: string,
 *     styleToken: { primaryColor, accentColor, fontFamily, motif },
 *     coverImagePrompt: string,
 *     teacherSpeech?: string   // ≤ 60 字老师开场白
 *   }
 *
 * 决策 #3：软约束（speech ≤ 60 字）。
 * 决策 #14：旧 slide/quiz/interactive/pbl 不兼容；产出物全新。
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import {
  NARRATION_BUDGET_HINT,
  JSON_OUTPUT_RULES,
  SAFETY_RULES,
  TARGET_AUDIENCE,
  COURSE_CONTINUITY,
} from './_shared';

export const COVER_SYSTEM_PROMPT = `你是一名互动课件的封面设计师。给定一条用户的封面指令（描述 + 内容），
你需要产出一份"封面信息"JSON。

${TARGET_AUDIENCE}

${COURSE_CONTINUITY}

要求：
- title：从描述/内容里提炼的醒目课件标题，≤ 16 字，避免完全照抄。
- subtitle：可选，一句更具体的副标题，≤ 24 字。
- styleToken：固定字段，按下表挑选：
  - primaryColor / accentColor: 7 位 hex 颜色（含 #）
  - fontFamily: 'rounded' | 'serif' | 'mono' | 'sans'
  - motif: 'fantasy' | 'tech' | 'nature' | 'ocean' | 'space' | 'classroom' | 'storybook'
- coverImagePrompt: 一句英文 prompt，给图像模型用，描述封面应该画什么；
  禁止出现真实人名、商业 IP、品牌名。
- teacherSpeech: AI 老师的开场白，亲切自然，≤ 60 字。

${NARRATION_BUDGET_HINT}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildCoverUserPrompt(
  instruction: PageInstruction,
  courseContext?: string,
): string {
  const lines = [
    '这是一节课的第 ' + instruction.index + ' 页，模式是【封面】。',
    '描述：' + instruction.description,
    '内容：' + instruction.content,
  ];
  if (courseContext) {
    lines.push('', courseContext);
  }
  lines.push('', '请按 system 中说明输出 JSON。');
  return lines.join('\n');
}
