'use client';

/**
 * engpk · 浏览器原生 TTS hook（MVP 版）
 *
 * 使用 Web Speech API (speechSynthesis) 朗读老师讲解词。
 * 零依赖、零成本、立即可用。
 *
 * 后续可升级为调用 /api/generate/tts 接入专业 TTS 供应商。
 *
 * 用法：
 *   const { speak, stop, speaking } = useBrowserTTS();
 *   speak('你好小朋友');
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseBrowserTTSOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  voiceName?: string;
}

export function useBrowserTTS(options?: UseBrowserTTSOptions) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> => {
      if (!supported || !text.trim()) return Promise.resolve();

      return new Promise((resolve) => {
        // 先停止之前的
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options?.lang || 'zh-CN';
        utterance.rate = options?.rate || 1.0;
        utterance.pitch = options?.pitch || 1.0;

        // 尝试找指定声线
        if (options?.voiceName) {
          const voices = window.speechSynthesis.getVoices();
          const match = voices.find((v) => v.name.includes(options.voiceName!));
          if (match) utterance.voice = match;
        }

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setSpeaking(false);
          resolve();
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [supported, options?.lang, options?.rate, options?.pitch, options?.voiceName],
  );

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [supported]);

  // 组件卸载时停止
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { speak, stop, speaking, supported };
}
