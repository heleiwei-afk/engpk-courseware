/**
 * engpk · 场景 mock 生成器（PR-08 骨架）
 *
 * 按 SceneMode 返回一个合法的占位 Scene；后续 PR-10/11/12/13/14/15/16 才真正调 LLM。
 *
 * 设计目标：
 *   - 让 SSE 链路能跑通（parsed → teammates → style → scene-ready 多次 → done）
 *   - 每种类型都产出合法 payload，满足 scene-v2 类型约束
 *   - 生成耗时模拟随机 200~600ms（让流式效果可见）
 */

import type { Scene, SceneType, StyleToken } from '@/lib/engpk/types/scene-v2';
import type { PageInstruction } from '@/lib/engpk/instruction/types';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mockStyleToken(): StyleToken {
  return {
    primaryColor: '#7c3aed',
    accentColor: '#22d3ee',
    fontFamily: 'rounded',
    motif: 'fantasy',
  };
}

export async function mockGenerateScene(
  instruction: PageInstruction,
  styleToken: StyleToken,
  teammateIds: string[],
): Promise<Scene> {
  // 模拟生成耗时
  await sleep(200 + Math.floor(Math.random() * 400));

  const id = uuid();
  const base = {
    id,
    order: instruction.index,
    instruction,
    agentIds: teammateIds,
    actions: [],
    status: 'ready' as const,
  };

  const mode: SceneType = instruction.mode;

  switch (mode) {
    case 'cover':
      return {
        ...base,
        type: 'cover',
        payload: {
          title: instruction.content.slice(0, 16) || '新课堂',
          subtitle: instruction.description,
          styleToken,
          coverImagePrompt: `cover of ${instruction.description}`,
        },
      };

    case 'warmup':
      return {
        ...base,
        type: 'warmup',
        payload: {
          warmupVideoUrl: instruction.content,
          rhythmGame: {
            durationMs: 60_000,
            laneCount: 4,
            difficulty: 'easy',
            beatmap: mockBeatmap(60_000, 4),
          },
        },
      };

    case 'video-review':
      return {
        ...base,
        type: 'video-review',
        payload: {
          videoUrl: instruction.content,
          performanceCheckIntervalSec: 10,
          cameraRequired: true,
          performancePrompt:
            '这张图中的人是否在做表演动作（如唱歌、跳舞、模仿口型）？只回答 yes 或 no。',
        },
      };

    case 'game':
      return {
        ...base,
        type: 'game',
        payload: {
          learningGoals: instruction.content
            .split(/[,，、\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
          gameDesign: {
            title: instruction.description,
            mechanics: 'Mock 游戏机制占位',
            winCondition: '完成所有学习目标即可通关',
          },
          gameHtml: mockGameHtml(instruction.description),
        },
      };

    case 'discussion':
      return {
        ...base,
        type: 'discussion',
        payload: {
          topic: instruction.description,
          task: instruction.content,
          rule: '每人依次发言，AI 老师最后总结',
          expectedRounds: 3,
        },
      };

    case 'article':
      return {
        ...base,
        type: 'article',
        payload: {
          blocks: [
            { type: 'text', text: instruction.content },
          ],
        },
      };

    case 'ending':
      return {
        ...base,
        type: 'ending',
        payload: {
          endingGameTemplate: 'redpacket',
          endingGameHtml: mockGameHtml('结尾抽奖'),
          encouragements: [
            {
              templateId: 'hug-1',
              text: '回家给妈妈一个大大的拥抱吧！',
              category: 'physical',
            },
          ],
        },
      };

    default:
      // 编译器兜底；理论上 SceneType 已全覆盖
      throw new Error(`Unknown scene mode: ${mode satisfies never}`);
  }
}

function mockBeatmap(
  durationMs: number,
  laneCount: 4 | 5 | 6,
): Array<{ timeMs: number; lane: number; type: 'tap' | 'hold'; holdMs?: number }> {
  const notes: Array<{
    timeMs: number;
    lane: number;
    type: 'tap' | 'hold';
    holdMs?: number;
  }> = [];
  const intervalMs = 600; // 每 0.6s 一拍
  for (let t = 1000; t < durationMs; t += intervalMs) {
    notes.push({
      timeMs: t,
      lane: Math.floor(Math.random() * laneCount),
      type: 'tap',
    });
  }
  return notes;
}

function mockGameHtml(title: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; frame-src \'none\';">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0ea5e9;color:white;}button{padding:12px 24px;font-size:18px;border:0;border-radius:8px;background:white;color:#0ea5e9;cursor:pointer;}</style>',
    '</head><body>',
    `<div style="text-align:center"><h1>${escapeHtml(title)}（Mock 占位）</h1>`,
    '<button onclick="parent.postMessage({source:\'openmaic-game\',gameId:\'mock\',event:\'complete\',payload:{score:100},timestamp:Date.now()},\'*\')">完成游戏</button></div>',
    '</body></html>',
  ].join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { uuid };
