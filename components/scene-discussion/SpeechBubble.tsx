'use client';

/**
 * SpeechBubble - Animated speech bubble with typewriter effect
 *
 * Shows the current speaker's text with:
 * - Framer Motion entrance/exit animations
 * - Typewriter cursor when streaming
 * - Speaker name badge
 */

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface SpeechBubbleProps {
  text: string;
  speakerName: string;
  isStreaming: boolean;
  variant: 'teacher' | 'agent' | 'user';
}

export function SpeechBubble({
  text,
  speakerName,
  isStreaming,
  variant,
}: SpeechBubbleProps) {
  const bgClass =
    variant === 'teacher'
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
      : variant === 'user'
        ? 'bg-primary/10 border-primary/30'
        : 'bg-card border-border';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'w-full max-w-md rounded-2xl border px-5 py-4 shadow-sm',
        bgClass,
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            variant === 'teacher'
              ? 'bg-amber-500 text-white'
              : variant === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-sky-500 text-white',
          )}
        >
          {speakerName}
        </span>
        {isStreaming ? (
          <span className="flex items-center gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
          </span>
        ) : null}
      </div>

      <div className="text-sm leading-relaxed">
        {text || '\u00A0'}
        {isStreaming ? (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary/60 align-middle" />
        ) : null}
      </div>
    </motion.div>
  );
}
