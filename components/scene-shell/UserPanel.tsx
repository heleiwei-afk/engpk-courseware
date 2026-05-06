'use client';

/**
 * UserPanel — 用户信息区
 *
 * 显示当前用户：头像、昵称、当前积分、当前排名。
 * 数据来自 classroom-session store；积分变化通过 scoreBus 自动驱动 UI。
 */

import { useClassroomSession } from '@/lib/engpk/store/classroom-session';

export function UserPanel() {
  const user = useClassroomSession((s) => s.user);

  if (!user) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground">
        未登录
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
      data-testid="user-panel"
    >
      {/* 头像 + 排名徽章 */}
      <div className="relative">
        <img
          src={user.avatar || '/avatars/default.png'}
          alt={user.nickname}
          className="h-12 w-12 rounded-full object-cover"
        />
        {user.rank ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            #{user.rank}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.nickname}</div>
        <div className="text-xs text-muted-foreground">本课积分</div>
        <div className="text-lg font-bold tabular-nums">{user.score}</div>
      </div>
    </div>
  );
}
