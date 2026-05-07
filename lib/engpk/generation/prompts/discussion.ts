/**
 * engpk · 讨论类 prompt
 *
 * 讨论类的生成阶段只产出：topic / task / rule / 老师开场白。
 * 实际多 agent 发言由运行时 LangGraph 实时驱动（决策 #5：完全 LLM 决策）。
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import {
  NARRATION_BUDGET_HINT,
  JSON_OUTPUT_RULES,
  SAFETY_RULES,
  TARGET_AUDIENCE,
  COURSE_CONTINUITY,
} from './_shared';
import { SPEECH_GUIDELINES_LITE } from './_shared/speech-guidelines';

export const DISCUSSION_SYSTEM_PROMPT = `你是一名少儿互动课件的讨论环节设计师。给定一条"讨论"指令，
请设计一个适合小朋友参与的讨论任务。

${TARGET_AUDIENCE}

${SPEECH_GUIDELINES_LITE}

${COURSE_CONTINUITY}

输出 JSON：
{
  "topic": "讨论话题标题，≤ 20 字",
  "task": "学生需要完成的具体任务描述，≤ 60 字",
  "rule": "讨论规则说明（如何发言、轮次等），≤ 60 字",
  "expectedRounds": 3-5 之间的整数,
  "teacherOpening": "AI 老师的开场白，介绍规则并抛出话题，≤ 60 字"
}

设计要点：
- topic 要有趣、有争议性或探索性，激发小朋友思考
- task 要具体可操作（如"说出你的理由"、"举一个例子"）
- rule 简洁明了，小朋友能听懂
- teacherOpening 亲切自然，像真老师一样引导

${NARRATION_BUDGET_HINT}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildDiscussionUserPrompt(
  instruction: PageInstruction,
  courseContext?: string,
): string {
  const lines = [
    '这是一节课的第 ' + instruction.index + ' 页，模式是【讨论】。',
    '描述：' + instruction.description,
    '内容：' + instruction.content,
  ];
  if (courseContext) {
    lines.push('', courseContext);
  }
  lines.push('', '请设计讨论任务并输出 JSON。');
  return lines.join('\n');
}
