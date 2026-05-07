'use client';

/**
 * useKeyboardShortcuts - Classroom keyboard shortcuts
 *
 * Space = play/pause
 * Left/Right = prev/next scene
 * F11 = fullscreen toggle
 * Escape = exit fullscreen
 *
 * Disabled when focus is in input/textarea/contenteditable.
 */

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onPlayPause: () => void;
  onPrevScene: () => void;
  onNextScene: () => void;
  onFullscreenToggle: () => void;
  enabled?: boolean;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { onPlayPause, onPrevScene, onNextScene, onFullscreenToggle, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPrevScene();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNextScene();
          break;
        case 'F11':
          e.preventDefault();
          onFullscreenToggle();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onPlayPause, onPrevScene, onNextScene, onFullscreenToggle]);
}
