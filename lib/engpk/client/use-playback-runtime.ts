'use client';

/**
 * engpk - usePlaybackRuntime hook
 *
 * Wraps EngpkPlaybackEngine for React lifecycle management.
 * Handles:
 *   - Engine instantiation and disposal
 *   - Speech actions via browser TTS
 *   - Scene change notifications to classroom-session store
 *   - Status tracking (idle/playing/paused/awaiting_user/ended)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { EngpkPlaybackEngine, type PlaybackStatus } from '@/lib/engpk/playback/engine';
import type { Scene } from '@/lib/engpk/types/scene-v2';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { useServerTTS } from './use-server-tts';
import { getTeacherVoice } from '@/lib/engpk/audio/voice-config';
import type { RuntimeAction } from '@/lib/engpk/action/runtime';

export interface PlaybackRuntimeState {
  status: PlaybackStatus;
  currentSceneIndex: number;
}

export function usePlaybackRuntime() {
  const [state, setState] = useState<PlaybackRuntimeState>({
    status: 'idle',
    currentSceneIndex: 0,
  });

  const engineRef = useRef<EngpkPlaybackEngine | null>(null);
  const selectScene = useClassroomSession((s) => s.selectScene);
  const { speak, stop: stopTTS } = useServerTTS({
    providerId: 'doubao-tts',
    voice: getTeacherVoice(),
    fallbackToBrowser: true,
  });

  // Speed stored in ref so engine callback can read latest without re-creating
  const speedRef = useRef(1.0);

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = speed;
  }, []);

  // Handle unknown actions (speech, whiteboard, spotlight, etc.)
  const handleUnknownAction = useCallback(
    async (action: RuntimeAction) => {
      if (action.type === 'speech' && 'text' in action) {
        const text = (action as { text: string }).text;
        // Speak using browser TTS with current speed
        await speak(text);
      }
      // Other action types (wb_*, spotlight, laser) — no-op for now
      // P2 will add spotlight handling
      // P3 will add whiteboard handling
    },
    [speak],
  );

  // Initialize engine
  useEffect(() => {
    const engine = new EngpkPlaybackEngine({
      onUnknownAction: handleUnknownAction,
      onStatusChange: (status) => {
        setState((s) => ({ ...s, status }));
      },
      onSceneChange: (index) => {
        setState((s) => ({ ...s, currentSceneIndex: index }));
        selectScene(index);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      stopTTS();
      engineRef.current = null;
    };
  }, [handleUnknownAction, selectScene, stopTTS]);

  // Load scenes into engine
  const loadScenes = useCallback((scenes: Scene[]) => {
    engineRef.current?.setScenes(scenes);
  }, []);

  const start = useCallback(() => {
    engineRef.current?.start();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    stopTTS();
  }, [stopTTS]);

  const resume = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  const goToScene = useCallback((index: number) => {
    stopTTS();
    engineRef.current?.selectScene(index);
  }, [stopTTS]);

  const notifySceneComplete = useCallback((sceneId: string) => {
    engineRef.current?.notifySceneComplete(sceneId);
  }, []);

  return {
    state,
    loadScenes,
    start,
    pause,
    resume,
    goToScene,
    notifySceneComplete,
    setSpeed,
  };
}
