'use client';

/**
 * ProgressBar — 整体进度区
 *
 * 显示已完成场景数 / 总场景数；带百分比条。
 */

import { useClassroomSession } from '@/lib/engpk/store/classroom-session';

export function ProgressBar() {
  const scenes = useClassroomSession((s) => s.scenes);
  const currentIndex = useClassroomSession((s) => s.currentSceneIndex);

  const total = scenes.length;
  const completed = Math.min(currentIndex + 1, total);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm"
      data-testid="progress-bar"
    >
      <div className="shrink-0 text-muted-foreground">进度</div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="shrink-0 tabular-nums">
        {completed} / {total || '—'}
      </div>
    </div>
  );
}
