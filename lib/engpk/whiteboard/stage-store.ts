/**
 * engpk - Lightweight StageStore for MAIC ActionEngine bridge
 *
 * Implements the minimal StageStore interface required by MAIC's ActionEngine.
 * Only tracks whiteboard state (elements). Does not manage slides/canvas.
 *
 * This allows engpk to use MAIC's ActionEngine for whiteboard actions
 * (wb_draw_text, wb_draw_latex, wb_draw_chart, etc.) without importing
 * the full MAIC stage/canvas infrastructure.
 */

import type { StageStore } from '@/lib/api/stage-api-types';
import { create } from 'zustand';

interface WhiteboardElement {
  id: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface EngpkStageState {
  stage: {
    whiteboard: Array<{
      id: string;
      viewportSize: number;
      viewportRatio: number;
      elements: WhiteboardElement[];
      background: { type: string; color: string };
      animations: unknown[];
    }>;
  } | null;
  scenes: unknown[];
  currentSceneId: string | null;
  mode: 'autonomous' | 'playback';
}

const initialState: EngpkStageState = {
  stage: {
    whiteboard: [],
  },
  scenes: [],
  currentSceneId: null,
  mode: 'playback',
};

/**
 * Create a Zustand store that satisfies the StageStore interface.
 * Used to bridge MAIC's ActionEngine for whiteboard rendering.
 */
export const useEngpkStageStore = create<EngpkStageState>(() => initialState);

/**
 * Get a StageStore-compatible object for passing to ActionEngine constructor.
 */
export function getEngpkStageStore(): StageStore {
  return {
    getState: () => useEngpkStageStore.getState() as ReturnType<StageStore['getState']>,
    setState: (partial: unknown) => useEngpkStageStore.setState(partial as Partial<EngpkStageState>),
    subscribe: (listener: (state: unknown, prevState: unknown) => void) =>
      useEngpkStageStore.subscribe(listener as (state: EngpkStageState, prevState: EngpkStageState) => void),
  };
}

/**
 * Get current whiteboard elements (for rendering).
 */
export function getWhiteboardElements(): WhiteboardElement[] {
  const state = useEngpkStageStore.getState();
  const wb = state.stage?.whiteboard;
  if (!wb || wb.length === 0) return [];
  // Return elements from the most recent whiteboard
  return wb[wb.length - 1].elements || [];
}

/**
 * Clear all whiteboard elements (called on scene change).
 */
export function clearWhiteboard(): void {
  const state = useEngpkStageStore.getState();
  if (state.stage?.whiteboard) {
    useEngpkStageStore.setState({
      stage: {
        ...state.stage,
        whiteboard: state.stage.whiteboard.map((wb) => ({
          ...wb,
          elements: [],
        })),
      },
    });
  }
}
