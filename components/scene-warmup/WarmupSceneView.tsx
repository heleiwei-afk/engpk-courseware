'use client';

/**
 * WarmupSceneView — 暖场类场景渲染器
 *
 * 布局：
 *   - 左/上：暖场视频播放区（如有 URL）
 *   - 右/下：RhythmGame 节奏游戏
 *   - 底部：老师引导语 + 完成后继续
 *
 * 通信：RhythmGame 的 onScore → scoreBus；onComplete → 解锁"下一页"
 */

import { useState } from 'react';
import type { WarmupScene } from '@/lib/engpk/types/scene-v2';
import { RhythmGame } from './RhythmGame';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';

interface WarmupSceneViewProps {
  scene: WarmupScene;
  onContinue?: () => void;
}

export function WarmupSceneView({ scene, onContinue }: WarmupSceneViewProps) {
  const { warmupVideoUrl, rhythmGame } = scene.payload;
  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const speeches = scene.actions
    .filter(
      (a): a is Extract<typeof a, { type: 'speech' }> => a.type === 'speech',
    )
    .map((a) => a.text);

  function handleScore(delta: number, judgment: 'perfect' | 'good' | 'miss') {
    if (judgment === 'miss') return;
    scoreBus.dispatch(
      makeScoreEvent({
        target: 'user',
        delta,
        reason: judgment === 'perfect' ? 'Perfect!' : 'Good',
        source: 'rhythm-game',
        sceneId: scene.id,
      }),
    );
    if (judgment === 'perfect') {
      bulletBus.dispatch(
        makeBulletEvent({
          text: `Perfect! +${delta}`,
          emoji: '✨',
          from: 'system',
          style: 'highlight',
        }),
      );
    }
  }

  function handleComplete(score: number) {
    setCompleted(true);
    setFinalScore(score);
    bulletBus.dispatch(
      makeBulletEvent({
        text: `节奏热身完成！总分 ${score}`,
        emoji: '🎶',
        from: 'system',
        style: 'highlight',
      }),
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden lg:flex-row"
      data-testid="warmup-scene"
    >
      {/* 左：视频区（如有 URL） */}
      {warmupVideoUrl ? (
        <div className="flex h-1/3 items-center justify-center border-b border-border bg-black lg:h-full lg:w-1/3 lg:border-b-0 lg:border-r">
          <video
            src={warmupVideoUrl}
            controls
            autoPlay
            muted
            className="max-h-full max-w-full"
          />
        </div>
      ) : null}

      {/* 右：节奏游戏 */}
      <div className="flex min-h-0 flex-1 flex-col">
        {speeches.length > 0 ? (
          <div className="shrink-0 border-b border-border bg-pink-50/50 px-4 py-2 text-sm dark:bg-pink-950/20">
            <span className="mr-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] text-white">
              老师
            </span>
            {speeches[0]}
          </div>
        ) : null}

        <div className="flex-1 overflow-hidden">
          <RhythmGame
            beatmap={rhythmGame.beatmap}
            laneCount={rhythmGame.laneCount}
            durationMs={rhythmGame.durationMs}
            onScore={handleScore}
            onComplete={handleComplete}
          />
        </div>

        {completed ? (
          <div className="shrink-0 flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-sm font-semibold text-emerald-600">
              总分：{finalScore}
            </span>
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
            >
              下一页 →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
