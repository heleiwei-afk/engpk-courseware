'use client';

/**
 * LessonToc — 课件目录区（可展开/收起）
 *
 * 列出所有页（场景）的 order + 类型徽章 + 状态。
 * 点击切换 currentSceneIndex；生成中的页显示 spinner；失败页有重试按钮。
 * 支持展开/收起：收起时只显示当前页码 + 进度摘要。
 */

import { useState } from 'react';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { cn } from '@/lib/utils';
import type { SceneType } from '@/lib/engpk/types/scene-v2';

const TYPE_LABELS: Record<SceneType, string> = {
  cover: '封面',
  warmup: '暖场',
  'video-review': '视频赏析',
  game: '游戏',
  discussion: '讨论',
  article: '图文',
  ending: '结尾',
};

const TYPE_COLORS: Record<SceneType, string> = {
  cover: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  warmup: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
  'video-review': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  game: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  discussion: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  article: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  ending: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

export function LessonToc() {
  const scenes = useClassroomSession((s) => s.scenes);
  const currentIndex = useClassroomSession((s) => s.currentSceneIndex);
  const select = useClassroomSession((s) => s.selectScene);
  const [collapsed, setCollapsed] = useState(false);

  const currentScene = scenes[currentIndex];
  const total = scenes.length;

  return (
    <div
      className="flex flex-col rounded-lg border border-border bg-card shadow-sm"
      data-testid="lesson-toc"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
      >
        <span>课件目录</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {total > 0 ? (
            <span className="tabular-nums">{currentIndex + 1}/{total}</span>
          ) : null}
          <span className="transition-transform" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
        </span>
      </button>

      {collapsed ? (
        /* 收起态：只显示当前页信息 */
        currentScene ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <span className={cn('mr-1.5 rounded px-1 py-0.5 text-[10px] font-medium', TYPE_COLORS[currentScene.type])}>
              {TYPE_LABELS[currentScene.type]}
            </span>
            {currentScene.instruction.description || '—'}
          </div>
        ) : null
      ) : (
        /* 展开态：完整列表 */
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {scenes.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground/60">
              暂无内容
            </li>
          ) : (
            scenes.map((s, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => select(idx)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      isCurrent ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                      {s.order}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        TYPE_COLORS[s.type],
                      )}
                    >
                      {TYPE_LABELS[s.type]}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {s.instruction.description || '—'}
                    </span>
                    {s.status === 'generating' ? (
                      <span className="shrink-0 animate-pulse text-muted-foreground">
                        ⏳
                      </span>
                    ) : s.status === 'failed' ? (
                      <span className="shrink-0 text-destructive">⚠</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
