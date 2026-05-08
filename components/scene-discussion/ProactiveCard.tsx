'use client';

/**
 * ProactiveCard - Discussion invitation card with countdown
 *
 * Appears when entering a discussion scene. User can:
 * - "Join" to start the discussion
 * - "Skip" to move to next page
 * - Auto-skips after 5 seconds if no action
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface ProactiveCardProps {
  topic: string;
  onJoin: () => void;
  onSkip: () => void;
}

export function ProactiveCard({ topic, onJoin, onSkip }: ProactiveCardProps) {
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onSkip();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onSkip]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="mx-auto max-w-sm rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-xl dark:border-amber-800 dark:from-amber-950/60 dark:to-orange-950/60"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
          Discussion
        </span>
        <span className="text-xs text-muted-foreground">
          {countdown}s
        </span>
      </div>

      <h3 className="mb-2 text-base font-bold text-amber-900 dark:text-amber-100">
        {topic}
      </h3>

      <p className="mb-4 text-xs text-amber-700 dark:text-amber-300">
        AI 同学想和你讨论这个话题，要加入吗？
      </p>

      {/* Countdown progress bar */}
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-800">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            onJoin();
          }}
          className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          加入讨论
        </button>
        <button
          type="button"
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            onSkip();
          }}
          className="rounded-lg border border-amber-300 bg-white/50 px-3 py-2 text-sm text-amber-700 hover:bg-white dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
        >
          跳过
        </button>
      </div>
    </motion.div>
  );
}
