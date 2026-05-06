'use client';

/**
 * BulletChat — 弹幕区
 *
 * 显示弹幕流（来自 bulletBus，由 store 维护近 50 条）。
 * - 高光弹幕（style='highlight'）有醒目背景
 * - 自动滚动到底部
 * - 用户可以点"展开"查看历史
 */

import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export function BulletChat() {
  const bullets = useClassroomSession((s) => s.bullets);
  const teammates = useClassroomSession((s) => s.teammates);
  const user = useClassroomSession((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚到底
  useEffect(() => {
    if (!collapsed && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [bullets, collapsed]);

  function getNickname(id?: string): string {
    if (!id) return '';
    if (id === user?.id) return user.nickname;
    const t = teammates.find((x) => x.id === id);
    return t?.nickname ?? '';
  }

  return (
    <div
      className="flex flex-col rounded-lg border border-border bg-card shadow-sm"
      data-testid="bullet-chat"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium">弹幕</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>

      {!collapsed ? (
        <div
          ref={containerRef}
          className="max-h-48 min-h-24 overflow-y-auto px-3 py-2 text-xs"
        >
          {bullets.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground/60">
              这里会显示精彩操作的高光时刻
            </div>
          ) : (
            <ul className="space-y-1">
              {bullets.map((b) => (
                <li
                  key={b.id}
                  className={cn(
                    'flex items-baseline gap-1 rounded px-1 py-0.5',
                    b.style === 'highlight' &&
                      'bg-amber-100 dark:bg-amber-950/40',
                  )}
                >
                  {b.emoji ? <span>{b.emoji}</span> : null}
                  {b.from === 'system' ? (
                    <span className="text-muted-foreground">系统</span>
                  ) : (
                    <span className="font-medium">
                      {b.from === 'ai-teacher' ? 'AI 老师' : getNickname(b.agentId)}
                    </span>
                  )}
                  <span className="text-muted-foreground">：</span>
                  <span className="truncate">{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
