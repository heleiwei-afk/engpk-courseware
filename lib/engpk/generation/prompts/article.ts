/**
 * engpk - Article scene prompt (Stage 1: Content only)
 *
 * Stage 1 produces ONLY visual blocks (no narration).
 * Stage 2 (article-actions.ts) produces the narration separately.
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import {
  JSON_OUTPUT_RULES,
  SAFETY_RULES,
  TARGET_AUDIENCE,
  COURSE_CONTINUITY,
} from './_shared';

export const ARTICLE_SYSTEM_PROMPT = `你是一名少儿课件的图文内容设计师。给定一条"图文"指令，请生成结构化的视觉展示内容。

注意：你只负责生成"展示在屏幕上的内容"（blocks），不需要生成讲解词（讲解由后续步骤单独生成）。

${TARGET_AUDIENCE}

${COURSE_CONTINUITY}

输出 JSON 字段：
- heading: 页面标题，≤ 20 字。
- blocks: 数组，元素 type 从下列中选：
  - { type: 'paragraph', text: string }              // 一段文字，≤ 60 字（简洁！关键信息）
  - { type: 'bullet-list', items: string[] }          // 3-5 条要点，每条 ≤ 20 字
  - { type: 'highlight', text: string }               // 1 条关键句/公式/例句，≤ 40 字
  - { type: 'image', prompt: string, caption?: string } // 一张配图，prompt 英文
  block 总数建议 4-7 条；结构要丰富多样（不要全是 paragraph）。

【重要原则】
- blocks 是"视觉辅助"，不是"讲稿"。
- 放在 block 里的文字要简洁、可扫描（关键词、短句、列表）。
- 如果一段话读起来像"老师在说的话"，就不应该放在 block 里。
- 多用 bullet-list 和 highlight，少用长 paragraph。
- 每个 keyPoint 至少对应一个 block。

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
