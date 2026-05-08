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
import { executeMaicAction, disposeActionEngine } from '@/lib/engpk/whiteboard/action-bridge';
import { clearWhiteboard } from '@/lib/engpk/whiteboard/stage-store';
import type { Action } from '@/lib/types/action';
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
  // Read voice dynamically on each speak call (not cached at hook init)
  const { speak, stop: stopTTS } = useServerTTS({
    providerId: 'doubao-tts',
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
        await speak(text);
        return;
      }

      // Bridge wb_* and spotlight/laser actions to MAIC ActionEngine
      const actionType = action.type as string;
      if (
        actionType.startsWith('wb_') ||
        actionType === 'spotlight' ||
        actionType === 'laser'
      ) {
        try {
          await executeMaicAction(action as unknown as Action);
        } catch {
          // Silently ignore MAIC action errors
        }
        return;
      }
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
        clearWhiteboard(); // Clear whiteboard on scene change
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      disposeActionEngine();
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
