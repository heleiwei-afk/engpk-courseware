'use client';

/**
 * SpeakButton — 朗读/停止按钮
 *
 * 用于各场景渲染器中，让用户可以手动触发或停止 TTS 朗读。
 * 场景进入时也可以自动朗读（通过 autoPlay prop）。
 */

import { useEffect, useRef } from 'react';
import { useBrowserTTS } from '@/lib/engpk/client/use-browser-tts';
import { cn } from '@/lib/utils';

interface SpeakButtonProps {
  text: string;
  autoPlay?: boolean;
  className?: string;
}

export function SpeakButton({ text, autoPlay, className }: SpeakButtonProps) {
  const { speak, stop, speaking, supported } = useBrowserTTS();
  const autoPlayedRef = useRef(false);

  useEffect(() => {
    if (autoPlay && text && !autoPlayedRef.current && supported) {
      autoPlayedRef.current = true;
      speak(text);
    }
  }, [autoPlay, text, speak, supported]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (speaking) {
          stop();
        } else {
          speak(text);
        }
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition-colors hover:bg-muted',
        speaking && 'border-primary text-primary',
        className,
      )}
      title={speaking ? '停止朗读' : '朗读'}
    >
      {speaking ? '■ 停止' : '▶ 朗读'}
    </button>
  );
}
