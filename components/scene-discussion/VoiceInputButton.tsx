'use client';

/**
 * VoiceInputButton - Press-and-hold to record, release to send
 *
 * Uses browser native Web Speech API (SpeechRecognition).
 * Falls back to text input if not supported.
 */

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const recognitionRef = useRef<unknown>(null);

  const startRecording = useCallback(() => {
    if (!supported || disabled) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setRecording(false);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [supported, disabled, onTranscript]);

  const stopRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop();
    setRecording(false);
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={disabled}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
        recording
          ? 'border-red-400 bg-red-50 text-red-600 scale-105 dark:bg-red-950/40'
          : 'border-border bg-background text-muted-foreground hover:bg-muted',
        'disabled:opacity-40',
      )}
      title={recording ? '松开发送' : '按住说话'}
    >
      {recording ? '🔴 松开发送' : '🎤'}
    </button>
  );
}
