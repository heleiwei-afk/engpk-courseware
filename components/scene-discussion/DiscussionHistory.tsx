'use client';

/**
 * DiscussionHistory - Collapsible history of past messages
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface HistoryMessage {
  id: string;
  role: 'teacher' | 'teammate' | 'user' | 'system';
  agentName?: string;
  text: string;
}

interface DiscussionHistoryProps {
  messages: HistoryMessage[];
}

export function DiscussionHistory({ messages }: DiscussionHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50"
      >
        <span className="transition-transform" style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          ▾
        </span>
        历史消息 ({messages.length})
      </button>

      {expanded ? (
        <div className="max-h-40 overflow-y-auto px-4 pb-2">
          <div className="space-y-1.5">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-baseline gap-2 text-xs">
                <span
                  className={cn(
                    'shrink-0 font-medium',
                    msg.role === 'teacher' ? 'text-amber-600' :
                    msg.role === 'user' ? 'text-primary' :
                    msg.role === 'system' ? 'text-muted-foreground' :
                    'text-sky-600',
                  )}
                >
                  {msg.role === 'system' ? '系统' : msg.agentName || '?'}:
                </span>
                <span className="text-muted-foreground">{msg.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
