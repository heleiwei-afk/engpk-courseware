/**
 * engpk · 结尾类场景生成器
 *
 * 流程：
 *   1. 调 LLM 拿结尾小游戏 HTML
 *   2. 用 pickEncouragements 从模板池挑 3 条鼓励语（不走 LLM，决策 #11）
 *   3. LLM 失败时降级为一个最简 HTML（"抽奖即获得 N 分"按钮）
 *
 * 金额护栏：
 *   - 鼓励语中的 {amount} 由 picker 替换为白名单数字（≤ 5）
 *   - generator 本身不接触金额生成
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { EndingScene } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import { pickEncouragements } from '@/lib/engpk/encouragement/picker';
import {
  ENDING_GAME_SYSTEM_PROMPT,
  buildEndingUserPrompt,
} from '../prompts/ending';

const log = createLogger('engpk:gen:ending');

const VALID_TEMPLATES = ['redpacket', 'blindbox', 'duck', 'balloon'] as const;
type EndingTemplate = (typeof VALID_TEMPLATES)[number];

interface LLMOutput {
  gameTemplate?: unknown;
  gameHtml?: unknown;
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `end-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidTemplate(x: unknown): x is EndingTemplate {
  return typeof x === 'string' && (VALID_TEMPLATES as readonly string[]).includes(x);
}

/** 兜底：一个最简结尾小游戏（抽奖按钮），符合 game-event 协议 */
function fallbackEndingHtml(): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; frame-src \'none\';">',
    '<title>庆功</title>',
    '<style>body{margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#fbbf24,#f472b6);color:#fff;}',
    '.box{text-align:center;padding:24px;}',
    '.btn{margin-top:16px;padding:12px 28px;font-size:18px;border:0;border-radius:999px;background:#fff;color:#ef4444;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.15);}',
    '.score{margin-top:16px;font-size:28px;font-weight:700;}',
    '</style></head><body>',
    '<div class="box"><h1>🎉 恭喜完成本课！</h1><button class="btn" id="draw">点击领取奖励</button><div class="score" id="score"></div></div>',
    '<script>',
    'var btn=document.getElementById("draw"),sc=document.getElementById("score");',
    'btn.onclick=function(){var n=20+Math.floor(Math.random()*30);sc.textContent="+"+n+" 分";btn.disabled=true;btn.textContent="已领取";',
    'parent.postMessage({source:"openmaic-game",gameId:"ending",event:"complete",payload:{score:n},timestamp:Date.now()},"*");};',
    '</script></body></html>',
  ].join('');
}

export interface GenerateEndingSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
  /** 本课得分率（用于选鼓励语 mood） */
  scoreRate?: number;
  courseContext?: string;
}

export async function generateEndingScene(
  opts: GenerateEndingSceneOptions,
): Promise<EndingScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId, courseContext } = opts;

  let parsed: LLMOutput | null = null;
  try {
    const res = await callLLM(
      {
        model: resolvedModel.model,
        maxOutputTokens: 1800,
        messages: [
          { role: 'system', content: ENDING_GAME_SYSTEM_PROMPT },
          { role: 'user', content: buildEndingUserPrompt(instruction, courseContext) },
        ],
      },
      'engpk-ending',
    );
    parsed = parseJsonResponse<LLMOutput>(res.text);
  } catch (err) {
    log.warn('ending LLM call failed; falling back', err);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'generation.failure',
        value: 1,
        tags: { sceneType: 'ending' },
        payload: { reason: err instanceof Error ? err.message : String(err) },
        lessonId,
      }),
    );
  }

  const gameTemplate: EndingTemplate = isValidTemplate(parsed?.gameTemplate)
    ? parsed!.gameTemplate
    : 'redpacket';

  const gameHtmlRaw = typeof parsed?.gameHtml === 'string' ? parsed!.gameHtml.trim() : '';

  // 简单安全检查：禁用 API 命中就降级
  const hasForbiddenApi =
    /\bfetch\b|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bimportScripts\b|document\.write/.test(
      gameHtmlRaw,
    );
  const hasPostMessage = /parent\.postMessage\s*\(/.test(gameHtmlRaw);
  const sizeOk = gameHtmlRaw.length > 0 && gameHtmlRaw.length <= 200_000;

  const gameHtml =
    sizeOk && !hasForbiddenApi && hasPostMessage ? gameHtmlRaw : fallbackEndingHtml();

  if (gameHtml === fallbackEndingHtml() && gameHtmlRaw) {
    metricBus.dispatch(
      makeMetricEvent({
        name: 'game.validator.fail',
        value: 1,
        tags: { sceneType: 'ending' },
        payload: {
          hasForbiddenApi,
          hasPostMessage,
          sizeOk,
        },
        lessonId,
      }),
    );
  }

  // 鼓励语（模板池 + 占位符替换；不走 LLM）
  const scoreRate = opts.scoreRate ?? 0.7;
  const encouragements = pickEncouragements({ scoreRate, count: 3 });

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'ending' },
      lessonId,
    }),
  );

  return {
    id: uuid(),
    order: instruction.index,
    type: 'ending',
    instruction,
    agentIds: teammateIds,
    actions: [{ id: uuid(), type: 'speech' as const, text: '恭喜你完成了本节课！来看看你的成绩吧。' }],
    status: 'ready',
    payload: {
      endingGameTemplate: gameTemplate,
      endingGameHtml: gameHtml,
      encouragements,
    },
  };
}

export const __test__ = {
  isValidTemplate,
  fallbackEndingHtml,
};
