'use client';

/**
 * GameSceneView — 游戏类场景渲染器
 *
 * 布局：
 *   - 顶部：游戏标题 + 学习目标词标签
 *   - 中间：iframe 沙箱游戏
 *   - 底部：老师引导语 + "完成后继续"按钮
 *
 * 通信：通过 game-event 协议（validateGameEvent）接收 iframe 事件。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameScene } from '@/lib/engpk/types/scene-v2';
import { validateGameEvent } from '@/lib/engpk/game/event-protocol';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';

interface GameSceneViewProps {
  scene: GameScene;
  onContinue?: () => void;
}

export function GameSceneView({ scene, onContinue }: GameSceneViewProps) {
  const { learningGoals, gameDesign, gameHtml } = scene.payload;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!iframeRef.current) return;
      if (event.source !== iframeRef.current.contentWindow) return;

      const validated = validateGameEvent(event.data, 'game');
      if (!validated) return;

      switch (validated.event) {
        case 'score': {
          const delta =
            typeof validated.payload.delta === 'number'
              ? validated.payload.delta
              : 5;
          setScore((s) => s + delta);
          scoreBus.dispatch(
            makeScoreEvent({
              target: 'user',
              delta,
              reason: '游戏得分',
              source: 'game-event',
              sceneId: scene.id,
            }),
          );
          break;
        }
        case 'combo': {
          bulletBus.dispatch(
            makeBulletEvent({
              text: `Combo! +${validated.payload.delta ?? '?'}`,
              emoji: '🔥',
              from: 'system',
              style: 'highlight',
            }),
          );
          break;
        }
        case 'complete': {
          setCompleted(true);
          const finalScore =
            typeof validated.payload.score === 'number'
              ? validated.payload.score
              : score;
          bulletBus.dispatch(
            makeBulletEvent({
              text: `通关！总分 ${finalScore}`,
              emoji: '🎉',
              from: 'system',
              style: 'highlight',
            }),
          );
          break;
        }
        case 'fail': {
          bulletBus.dispatch(
            makeBulletEvent({
              text: '失败了，再试一次！',
              emoji: '💪',
              from: 'system',
              style: 'normal',
            }),
          );
          break;
        }
        default:
          break;
      }
    },
    [scene.id, score],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const speeches = scene.actions
    .filter(
      (a): a is Extract<typeof a, { type: 'speech' }> => a.type === 'speech',
    )
    .map((a) => a.text);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="game-scene"
    >
      {/* 顶部 */}
      <div className="shrink-0 border-b border-border bg-emerald-50/50 px-6 py-3 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
            🎮 {gameDesign.title}
          </h2>
          <span className="ml-auto tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            得分：{score}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {learningGoals.map((g, i) => (
            <span
              key={i}
              className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              {g}
            </span>
          ))}
        </div>
        {speeches.length > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{speeches[0]}</p>
        ) : null}
      </div>

      {/* 游戏 iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={gameHtml}
          title={gameDesign.title}
          className="h-full w-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* 底部 */}
      <div className="shrink-0 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="text-xs text-muted-foreground">
          {gameDesign.winCondition}
        </span>
        <button
          type="button"
          onClick={onContinue}
          disabled={!completed}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
        >
          {completed ? '下一页 →' : '完成游戏后继续…'}
        </button>
      </div>
    </div>
  );
}
