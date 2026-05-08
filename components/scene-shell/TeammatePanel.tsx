'use client';

/**
 * TeammatePanel — 队友信息区（P4 升级版）
 *
 * 显示 3 位 AI 队友：头像 + 昵称 + 积分 + 排名。
 * 正在说话的队友展开显示 speech bubble + thinking 动画。
 * 其余队友紧凑显示。
 */

import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { cn } from '@/lib/utils';
import { ThinkingDots } from './ThinkingDots';

export function TeammatePanel() {
  const teammates = useClassroomSession((s) => s.teammates);
  const speakingAgentId = useClassroomSession((s) => s.speakingAgentId);
  const bullets = useClassroomSession((s) => s.bullets);

  if (teammates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground">
        队友载入中…
      </div>
    );
  }

  // 按排名升序展示（rank 1 在前）
  const sorted = [...teammates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // Find the latest bullet from the speaking agent (for speech bubble)
  const speakingBullet = speakingAgentId
    ? bullets.filter((b) => b.agentId === speakingAgentId).slice(-1)[0]
    : null;

  return (
    <div className="space-y-2" data-testid="teammate-panel">
      {sorted.map((t) => {
        const isSpeaking = speakingAgentId === t.id;
        return (
          <div key={t.id} className="space-y-1">
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-card p-2 shadow-sm transition-all duration-300',
                isSpeaking && 'ring-2 ring-primary border-primary/40 bg-primary/5',
              )}
            >
              <div className="relative">
                <img
                  src={t.avatar}
                  alt={t.nickname}
                  className={cn(
                    'h-10 w-10 rounded-full object-cover transition-transform duration-300',
                    isSpeaking && 'scale-110',
                  )}
                />
                {t.rank ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
                    #{t.rank}
                  </span>
                ) : null}
                {isSpeaking ? (
                  <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  </span>
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

            {/* Speech bubble / thinking indicator for speaking agent */}
            {isSpeaking ? (
              <div className="ml-6 animate-in fade-in slide-in-from-top-1 duration-200">
                {speakingBullet ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs leading-relaxed">
                    {speakingBullet.text}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
                    <ThinkingDots />
                    <span className="text-[10px] text-muted-foreground">思考中…</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
