/**
 * engpk · 游戏类场景生成器
 *
 * 流程：
 *   1. 调 LLM 拿 { gameDesign, gameHtml, teacherSpeech }
 *   2. 用 game-validator 校验 HTML
 *   3. 校验失败 → 重试 1 次（附带失败原因让 LLM 修正）
 *   4. 仍失败 → 降级为 mock 游戏 HTML
 *   5. 注入 CSP meta
 *   6. teacherSpeech 转 SpeechAction
 */

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type { GameScene } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { SpeechAction } from '@/lib/types/action';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { createLogger } from '@/lib/logger';
import { validateGameHtml } from '@/lib/engpk/game/validator';
import { injectCSP } from '@/lib/engpk/game/inject-csp';
import { GAME_SYSTEM_PROMPT, buildGameUserPrompt } from '../prompts/game';

const log = createLogger('engpk:gen:game');

interface LLMOutput {
  gameDesign?: { title?: unknown; mechanics?: unknown; winCondition?: unknown };
  gameHtml?: unknown;
  teacherSpeech?: unknown;
}

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string') return fallback;
  const t = s.trim();
  return t ? (t.length > max ? t.slice(0, max) : t) : fallback;
}

/** 兜底游戏 HTML */
function fallbackGameHtml(goals: string[]): string {
  const wordList = goals.map((w) => `<span class="word">${w}</span>`).join(' ');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; frame-src \'none\';">',
    '<style>body{margin:0;font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#10b981;color:#fff;gap:16px;}',
    '.word{display:inline-block;margin:4px;padding:8px 16px;background:#fff;color:#10b981;border-radius:8px;font-size:20px;font-weight:700;cursor:pointer;transition:transform .1s;}',
    '.word:active{transform:scale(.9);}',
    '.done{font-size:24px;font-weight:700;}</style></head><body>',
    '<h2>点击所有单词完成游戏</h2>',
    `<div id="words">${wordList}</div>`,
    '<div class="done" id="msg"></div>',
    '<script>',
    `var total=${goals.length},clicked=0;`,
    'document.getElementById("words").onclick=function(e){if(e.target.classList.contains("word")){e.target.style.opacity="0.3";e.target.style.pointerEvents="none";clicked++;',
    'parent.postMessage({source:"openmaic-game",gameId:"game",event:"score",payload:{delta:10},timestamp:Date.now()},"*");',
    'if(clicked>=total){document.getElementById("msg").textContent="通关！";',
    'parent.postMessage({source:"openmaic-game",gameId:"game",event:"complete",payload:{score:clicked*10},timestamp:Date.now()},"*");}}};',
    '</script></body></html>',
  ].join('');
}

export interface GenerateGameSceneOptions {
  instruction: PageInstruction;
  resolvedModel: ResolvedModel;
  teammateIds: string[];
  lessonId: string;
  courseContext?: string;
}

export async function generateGameScene(
  opts: GenerateGameSceneOptions,
): Promise<GameScene> {
  const startedAt = Date.now();
  const { instruction, resolvedModel, teammateIds, lessonId, courseContext } = opts;

  const learningGoals = instruction.content
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let gameHtml = '';
  let gameDesign = {
    title: instruction.description.slice(0, 12),
    mechanics: '点击学习目标词完成游戏',
    winCondition: '所有目标词被点击',
  };
  let teacherSpeech = '';
  let validated = false;

  // 最多尝试 2 次
  for (let attempt = 0; attempt < 2 && !validated; attempt++) {
    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: GAME_SYSTEM_PROMPT },
        { role: 'user', content: buildGameUserPrompt(instruction, courseContext) },
      ];

      // 第二次尝试时附带上次失败原因
      if (attempt === 1 && gameHtml) {
        const prevResult = validateGameHtml(gameHtml, learningGoals);
        messages.push({
          role: 'user',
          content: `上一次生成的 HTML 校验失败：\n${prevResult.reasons.join('\n')}\n\n请修正后重新输出完整 JSON。`,
        });
      }

      const res = await callLLM(
        {
          model: resolvedModel.model,
          maxOutputTokens: 3000,
          messages,
        },
        'engpk-game',
      );
      const parsed = parseJsonResponse<LLMOutput>(res.text);

      if (parsed?.gameHtml && typeof parsed.gameHtml === 'string') {
        gameHtml = parsed.gameHtml;
      }
      if (parsed?.gameDesign) {
        gameDesign = {
          title: clamp(parsed.gameDesign.title, 12, gameDesign.title),
          mechanics: clamp(parsed.gameDesign.mechanics, 60, gameDesign.mechanics),
          winCondition: clamp(
            parsed.gameDesign.winCondition,
            40,
            gameDesign.winCondition,
          ),
        };
      }
      if (parsed?.teacherSpeech) {
        teacherSpeech = clamp(parsed.teacherSpeech, 60, '');
      }

      // 校验
      const result = validateGameHtml(gameHtml, learningGoals);
      if (result.valid) {
        validated = true;
      } else {
        log.warn(
          `game HTML validation failed (attempt ${attempt + 1})`,
          result.reasons,
        );
      }
    } catch (err) {
      log.warn(`game LLM call failed (attempt ${attempt + 1})`, err);
    }
  }

  // 校验仍失败 → 降级
  if (!validated) {
    gameHtml = fallbackGameHtml(learningGoals);
    metricBus.dispatch(
      makeMetricEvent({
        name: 'game.validator.fail',
        value: 1,
        tags: { sceneType: 'game' },
        lessonId,
      }),
    );
  }

  // 注入 CSP
  gameHtml = injectCSP(gameHtml);

  const actions: SpeechAction[] = [
    { id: uuid(), type: 'speech', text: teacherSpeech || '来玩个小游戏吧！看看你能得多少分！' },
  ];

  metricBus.dispatch(
    makeMetricEvent({
      name: 'generation.duration',
      value: Date.now() - startedAt,
      tags: { sceneType: 'game' },
      lessonId,
    }),
  );

  return {
    id: uuid(),
    order: instruction.index,
    type: 'game',
    instruction,
    agentIds: teammateIds,
    actions,
    status: 'ready',
    payload: {
      learningGoals,
      gameDesign,
      gameHtml,
    },
  };
}
