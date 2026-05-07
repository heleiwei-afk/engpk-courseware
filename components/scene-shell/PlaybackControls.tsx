'use client';

/**
 * PlaybackControls - Bottom control bar for the classroom
 *
 * Features:
 *   - Play/Pause button
 *   - Speed selector (1x / 1.25x / 1.5x / 2x)
 *   - Fullscreen toggle
 *   - Current page indicator
 */

import { useState } from 'react';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import type { PlaybackStatus } from '@/lib/engpk/playback/engine';
import { cn } from '@/lib/utils';

const SPEEDS = [1, 1.25, 1.5, 2] as const;

interface PlaybackControlsProps {
  status: PlaybackStatus;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

export function PlaybackControls({
  status,
  onPlay,
  onPause,
  onResume,
  speed,
  onSpeedChange,
  onFullscreen,
  isFullscreen,
}: PlaybackControlsProps) {
  const scenes = useClassroomSession((s) => s.scenes);
  const currentIndex = useClassroomSession((s) => s.currentSceneIndex);
  const total = scenes.length;

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  return (
    <div className="flex items-center gap-3 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-2">
      {/* Play/Pause */}
      <button
        type="button"
        onClick={() => {
          if (isPlaying) onPause();
          else if (isPaused) onResume();
          else if (isIdle) onPlay();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90"
        title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Speed */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeedChange(s)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              speed === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground">
        {total > 0 ? (currentIndex + 1) + ' / ' + total : '—'}
      </span>

      {/* Status indicator */}
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {status === 'playing' ? '播放中' :
         status === 'paused' ? '已暂停' :
         status === 'awaiting_user' ? '等待互动' :
         status === 'ended' ? '已结束' : '就绪'}
      </span>

      {/* Fullscreen */}
      <button
        type="button"
        onClick={onFullscreen}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
        title="全屏 (F11)"
      >
        {isFullscreen ? '退出全屏' : '全屏'}
      </button>
    </div>
  );
}
