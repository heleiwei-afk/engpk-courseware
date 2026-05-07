'use client';

/**
 * EndingSceneView — 结尾类场景渲染器
 *
 * 布局：
 *   - 上半：iframe 小游戏（红包/盲盒/打鸭子/射气球）
 *   - 下半：鼓励语卡片列表
 *   - 底部："完成本课"按钮
 *
 * iframe 通过 game-event 协议通信（PR-14 的 GameIframeAdapter 可复用；
 * 这里先做简版：监听 postMessage 的 complete 事件触发 onContinue）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndingScene } from '@/lib/engpk/types/scene-v2';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';

interface EndingSceneViewProps {
  scene: EndingScene;
  onContinue?: () => void;
}

export function EndingSceneView({ scene, onContinue }: EndingSceneViewProps) {
  const { endingGameHtml, encouragements } = scene.payload;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [gameCompleted, setGameCompleted] = useState(false);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!iframeRef.current) return;
      if (event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (
        data &&
        typeof data === 'object' &&
        data.source === 'openmaic-game' &&
        data.event === 'complete'
      ) {
        setGameCompleted(true);
        const score =
          typeof data.payload?.score === 'number' ? data.payload.score : 10;
        scoreBus.dispatch(
          makeScoreEvent({
            target: 'user',
            delta: score,
            reason: '结尾小游戏',
            source: 'encouragement',
            sceneId: scene.id,
          }),
        );
        bulletBus.dispatch(
          makeBulletEvent({
            text: `恭喜完成！+${score} 分`,
            emoji: '🎉',
            from: 'system',
            style: 'highlight',
          }),
        );
      }
    },
    [scene.id],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="ending-scene"
    >
      {/* 游戏区 */}
      <div className="flex-1 overflow-hidden border-b border-border">
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={endingGameHtml}
          title="结尾小游戏"
          className="h-full w-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* 鼓励语 + 完成按钮 */}
      <div className="shrink-0 space-y-3 bg-gradient-to-t from-amber-50/80 to-transparent p-4 dark:from-amber-950/30">
        {encouragements.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {encouragements.map((e, i) => (
              <div
                key={i}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {e.text}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onContinue}
            disabled={!gameCompleted}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {gameCompleted ? '完成本课 🎊' : '完成小游戏后继续…'}
          </button>
        </div>
      </div>
    </div>
  );
}
