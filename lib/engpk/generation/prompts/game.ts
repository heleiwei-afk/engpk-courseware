/**
 * engpk · 游戏类 prompt
 *
 * 两阶段：
 *   Stage A（设计）：LLM 输出 gameDesign { title, mechanics, winCondition }
 *   Stage B（实现）：LLM 输出完整 HTML
 *
 * 为减少 token 消耗，PR-14 合并为单次调用（设计 + 实现一起输出）。
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

export const GAME_SYSTEM_PROMPT = `你是一名少儿互动课件的创意游戏设计师。给定学习目标词和描述，
请设计并实现一个寓教于乐的 HTML 小游戏。

${TARGET_AUDIENCE}

${SPEECH_GUIDELINES_LITE}

${COURSE_CONTINUITY}

输出 JSON：
{
  "gameDesign": {
    "title": "游戏标题，≤ 12 字",
    "mechanics": "游戏机制描述，≤ 60 字",
    "winCondition": "通关条件，≤ 40 字"
  },
  "gameHtml": "完整可运行的 HTML 字符串",
  "teacherSpeech": "AI 老师的一句引导语，≤ 60 字"
}

gameHtml 要求：
- 完整 HTML（含 <!doctype html>）
- 内联 CSS + JS，不引用外部资源（CDN / 图片 URL 等）
- 图片用 CSS 形状或 emoji 代替
- 游戏中必须包含所有学习目标词（让学生在玩的过程中接触到这些词）
- 游戏时长 30-60 秒
- 通关时调用：parent.postMessage({source:'openmaic-game', gameId:'game', event:'complete', payload:{score:最终得分}, timestamp:Date.now()}, '*')
- 得分时调用：parent.postMessage({source:'openmaic-game', gameId:'game', event:'score', payload:{delta:增量分}, timestamp:Date.now()}, '*')
- 禁止使用：fetch / XMLHttpRequest / WebSocket / importScripts / document.write
- 视觉风格：明亮、童趣、圆角、大按钮、大字体

游戏创意方向（可选但不限于）：
- 单词配对连线
- 打地鼠（地鼠上写单词，打对的加分）
- 拼图（把字母拼成单词）
- 接水果（水果上写单词，接对的加分）
- 记忆翻牌

${NARRATION_BUDGET_HINT}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildGameUserPrompt(
  instruction: PageInstruction,
  courseContext?: string,
): string {
  const goals = instruction.content
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = [
    '这是一节课的第 ' + instruction.index + ' 页，模式是【游戏】。',
    '描述：' + instruction.description,
    '学习目标词：' + goals.join('、'),
  ];
  if (courseContext) {
    lines.push('', courseContext);
  }
  lines.push('', '请设计一个包含以上所有学习目标词的小游戏，并输出完整 HTML。');
  return lines.join('\n');
}
