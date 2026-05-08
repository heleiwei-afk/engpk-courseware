'use client';

/**
 * AgentSpeechBubble - Shows agent speech with typewriter reveal effect
 *
 * When an agent is speaking (streaming text), the text reveals character
 * by character. When done, it stays visible briefly then fades.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AgentSpeechBubbleProps {
  text: string;
  isStreaming: boolean;
  agentName: string;
  className?: string;
}

export function AgentSpeechBubble({
  text,
  isStreaming,
  agentName,
  className,
}: AgentSpeechBubbleProps) {
  const [visibleChars, setVisibleChars] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isStreaming) {
      // Reset and start typewriter
      setVisibleChars(0);
      intervalRef.current = setInterval(() => {
        setVisibleChars((prev) => {
          if (prev >= text.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, 40);
    } else {
      // Show all immediately when not streaming
      setVisibleChars(text.length);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, isStreaming]);

  if (!text) return null;

  const displayText = text.slice(0, visibleChars);
  const isTyping = isStreaming && visibleChars < text.length;

  return (
    <div
      className={cn(
        'rounded-xl bg-card border border-border px-3 py-2 text-sm shadow-sm',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className,
      )}
    >
      <div className="mb-1 text-[10px] font-medium text-muted-foreground">
        {agentName}
      </div>
      <div className="leading-relaxed">
        {displayText}
        {isTyping ? (
          <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle" />
        ) : null}
      </div>
    </div>
  );
}
