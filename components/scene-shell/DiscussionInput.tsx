'use client';

/**
 * DiscussionInput — 用户互动讨论区 + 输入框 + 举手按钮
 *
 * - 输入文本即视为弹幕（普通样式）
 * - 举手按钮：在讨论场景下触发 PlaybackEngine.handleUserInterrupt（这一步在 PR-13 接入）
 * - 收起/展开支持
 */

import { useState } from 'react';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';

interface DiscussionInputProps {
  /** 举手按钮回调（讨论场景才接入） */
  onRaiseHand?: () => void;
  /** 是否禁用举手（非讨论场景） */
  raiseHandDisabled?: boolean;
}

export function DiscussionInput({
  onRaiseHand,
  raiseHandDisabled,
}: DiscussionInputProps) {
  const user = useClassroomSession((s) => s.user);
  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    bulletBus.dispatch(
      makeBulletEvent({
        text: trimmed,
        from: 'user',
        agentId: user?.id,
        style: 'normal',
      }),
    );
    setText('');
  }

  return (
    <div
      className="flex flex-col rounded-lg border border-border bg-card shadow-sm"
      data-testid="discussion-input"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium">互动</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>

      {!collapsed ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="说点什么…"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim()}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            发送
          </button>
          <button
            type="button"
            onClick={onRaiseHand}
            disabled={raiseHandDisabled}
            title={raiseHandDisabled ? '当前不可举手' : '举手发言'}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-accent disabled:opacity-40"
          >
            ✋ 举手
          </button>
        </div>
      ) : null}
    </div>
  );
}
