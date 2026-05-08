'use client';

/**
 * engpk - useServerTTS hook
 *
 * Calls /api/generate/tts to get professional TTS audio from server-side providers.
 * Falls back to browser native TTS if server call fails.
 *
 * Supported providers (configured via .env.local):
 *   - doubao-tts (configured in current env)
 *   - openai-tts, azure-tts, glm-tts, qwen-tts, minimax-tts, elevenlabs-tts
 *
 * Usage:
 *   const { speak, stop, speaking } = useServerTTS({ providerId: 'doubao-tts' });
 *   await speak('Hello world');
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrowserTTS } from './use-browser-tts';

export interface UseServerTTSOptions {
  providerId?: string;
  voice?: string;
  speed?: number;
  /** Fall back to browser TTS on server failure (default: true) */
  fallbackToBrowser?: boolean;
}

export function useServerTTS(options?: UseServerTTSOptions) {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const browserTTS = useBrowserTTS({ rate: options?.speed });

  const providerId = options?.providerId || 'doubao-tts';
  const defaultVoice = options?.voice || '';
  const speed = options?.speed || 1.0;
  const fallbackToBrowser = options?.fallbackToBrowser !== false;

  const speak = useCallback(
    async (text: string, voiceOverride?: string): Promise<void> => {
      if (!text.trim()) return;
      // Use override > options.voice > localStorage teacher voice > hardcoded default
      const resolvedVoice = voiceOverride || defaultVoice ||
        (typeof window !== 'undefined' ? localStorage.getItem('engpk:teacherVoice') : null) ||
        'zh_female_vv_uranus_bigtts';

      // Abort previous
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setSpeaking(true);

      try {
        const res = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            audioId: 'engpk-' + Date.now(),
            ttsProviderId: providerId,
            ttsVoice: resolvedVoice,
            ttsSpeed: speed,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error('TTS API returned ' + res.status);
        }

        const data = await res.json();
        if (!data.data?.base64) {
          throw new Error('No audio data in response');
        }

        // Play the audio
        const format = data.data.format || 'mp3';
        const audioUrl = 'data:audio/' + format + ';base64,' + data.data.base64;

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.playbackRate = speed;
          audio.onended = () => {
            setSpeaking(false);
            resolve();
          };
          audio.onerror = () => {
            setSpeaking(false);
            reject(new Error('Audio playback failed'));
          };
          audio.play().catch(reject);
        });
      } catch (err) {
        setSpeaking(false);
        if (controller.signal.aborted) return;

        // Fallback to browser TTS
        if (fallbackToBrowser) {
          await browserTTS.speak(text);
        }
      }
    },
    [providerId, defaultVoice, speed, fallbackToBrowser, browserTTS],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    browserTTS.stop();
    setSpeaking(false);
  }, [browserTTS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return { speak, stop, speaking };
}
