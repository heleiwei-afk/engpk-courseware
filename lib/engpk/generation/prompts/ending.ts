/**
 * engpk · 结尾类 prompt
 *
 * 结尾类只让 LLM 生成一个"结尾小游戏"的 HTML（类似游戏类但更简单：
 * 红包 / 盲盒 / 打鸭子 / 射气球 四选一）。
 *
 * 鼓励语由模板池生成（不走 LLM），所以 prompt 只负责小游戏。
 */

import type { PageInstruction } from '@/lib/engpk/instruction/types';
import {
  NARRATION_BUDGET_HINT,
  JSON_OUTPUT_RULES,
  SAFETY_RULES,
} from './_shared';

export const ENDING_GAME_SYSTEM_PROMPT = `你是一名少儿互动课件的结尾小游戏设计师。给定课程主题和结尾描述，
请生成一个简单有趣的结尾小游戏 HTML。

游戏类型从以下四种中选一个最适合的：
- redpacket：抢红包（点击屏幕上飘落的红包，每个红包有随机积分）
- blindbox：抽盲盒（点击盲盒打开，显示随机奖励文字）
- duck：打鸭子（点击飞过的鸭子得分）
- balloon：射气球（点击气球使其爆炸得分）

输出 JSON：
{
  "gameTemplate": "redpacket" | "blindbox" | "duck" | "balloon",
  "gameHtml": "完整可运行的 HTML 字符串"
}

gameHtml 要求：
- 完整 HTML（含 <!doctype html>）
- 内联 CSS + JS，不引用外部资源
- 游戏时长 15-30 秒
- 结束时调用 parent.postMessage({source:'openmaic-game', gameId:'ending', event:'complete', payload:{score:最终得分}, timestamp:Date.now()}, '*')
- 不使用 fetch / XMLHttpRequest / WebSocket / importScripts / document.write
- 视觉风格：明亮、童趣、圆角、大按钮

${NARRATION_BUDGET_HINT}
${JSON_OUTPUT_RULES}
${SAFETY_RULES}`;

export function buildEndingUserPrompt(instruction: PageInstruction): string {
  return `这节课的结尾页。
描述：${instruction.description}
内容：${instruction.content}

请选择一种游戏类型并生成完整 HTML。`;
}
