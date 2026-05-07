/**
 * engpk · 图文类（article）场景 prompt
 *
 * 设计要点：
 *   - 这是少数保留"讲解词较多"的场景（决策 #3 例外）。
 *   - 产出结构化的 blocks：heading / paragraph / image / bullet-list / highlight。
 *   - 老师 speech 可以多条（每条仍建议 ≤ 90 字）。
 *   - 禁止输出 script/style 等 HTML；渲染层只识别 block 类型。
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import {
  NARRATION_BUDGET_ARTICLE,
  JSON_OUTPUT_RULES,
  SAFETY_RULES,
  TARGET_AUDIENCE,
  COURSE_CONTINUITY,
} from './_shared';
import { SPEECH_GUIDELINES } from './_shared/speech-guidelines';

export const ARTICLE_SYSTEM_PROMPT = `你是一名少儿课件的图文讲解设计师。给定一条"图文"指令，请生成一段结构化图文内容，并为 AI 老师安排对应的讲解词。

${TARGET_AUDIENCE}

${SPEECH_GUIDELINES}

${COURSE_CONTINUITY}

输出 JSON 字段：
- heading: 页面标题，≤ 20 字。
- blocks: 数组，元素 type 从下列中选：
  - { type: 'paragraph', text: string }              // 一段文字，≤ 90 字
  - { type: 'bullet-list', items: string[] }          // 3-5 条要点，每条 ≤ 24 字
  - { type: 'highlight', text: string }               // 1 条关键句，≤ 40 字，用于强调
  - { type: 'image', prompt: string, caption?: string } // 一张配图，prompt 英文
  block 总数建议 3-6 条；结构要自然：常见顺序 heading → paragraph → image → bullet-list → highlight。
- teacherSpeeches: 3-5 条老师引导语，每条 ≤ 90 字。
  老师应"陪讲"，结合 blocks 帮小朋友理解，不要单纯朗读。
- focusBlockIndexes: 数组，给每条 speech 指定它主要讲哪个 block（blocks 的 0-based index）；
  长度 = teacherSpeeches 长度；-1 表示总览。

${NARRATION_BUDGET_ARTICLE}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildArticleUserPrompt(
  instruction: PageInstruction,
  courseContext?: string,
): string {
  const lines = [
    '这是一节课的第 ' + instruction.index + ' 页，模式是【图文】。',
    '描述：' + instruction.description,
    '内容：' + instruction.content,
  ];
  if (courseContext) {
    lines.push('', courseContext);
  }
  lines.push('', '请输出图文 JSON。');
  return lines.join('\n');
}
