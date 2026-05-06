'use client';

/**
 * TeammatePanel — 队友信息区
 *
 * 显示 3 位 AI 队友：头像 + 昵称 + 当前积分 + 排名。
 * - 排名由 scoreBoard 派生，分数变化时实时调换位置（CSS transform 动画）
 * - 正在说话的队友（speakingAgentId）有发光描边
 *
 * 决策 #4.1：persona 由课程主题随机生成（生成在服务端 teammate-generator 完成）
 * 决策 #7：积分与用户共振，由 teammate-engine 在客户端注入到 scoreBus
 */

import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { cn } from '@/lib/utils';

export function TeammatePanel() {
  const teammates = useClassroomSession((s) => s.teammates);
  const speakingAgentId = useClassroomSession((s) => s.speakingAgentId);

  if (teammates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground">
        队友载入中…
      </div>
    );
  }

  // 按排名升序展示（rank 1 在前）
  const sorted = [...teammates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div className="space-y-2" data-testid="teammate-panel">
      {sorted.map((t) => {
        const isSpeaking = speakingAgentId === t.id;
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border border-border bg-card p-2 shadow-sm transition-all',
              isSpeaking && 'ring-2 ring-primary',
            )}
          >
            <div className="relative">
              <img
                src={t.avatar}
                alt={t.nickname}
                className="h-10 w-10 rounded-full object-cover"
              />
              {t.rank ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
                  #{t.rank}
                </span>
              ) : null}
              {isSpeaking ? (
                <span className="absolute -bottom-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-emerald-500 ring-2 ring-card" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{t.nickname}</div>
              <div className="text-[10px] text-muted-foreground">{t.archetype}</div>
            </div>

            <div className="text-right tabular-nums">
              <div className="text-base font-semibold">{t.score}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
