/**
 * engpk - MAIC ActionEngine bridge
 *
 * Creates and manages a MAIC ActionEngine instance for handling
 * whiteboard and spotlight actions in engpk scenes.
 *
 * Usage:
 *   const bridge = createActionEngineBridge();
 *   await bridge.execute(action); // handles wb_*, spotlight, laser
 *   bridge.dispose();
 */

import { ActionEngine } from '@/lib/action/engine';
import { getEngpkStageStore } from './stage-store';
import type { Action } from '@/lib/types/action';

let engineInstance: ActionEngine | null = null;

/**
 * Get or create the singleton ActionEngine instance.
 * Uses the engpk lightweight stage store (no AudioPlayer).
 */
export function getActionEngine(): ActionEngine {
  if (!engineInstance) {
    const stageStore = getEngpkStageStore();
    engineInstance = new ActionEngine(stageStore, null, null);
  }
  return engineInstance;
}

/**
 * Execute a MAIC action (wb_*, spotlight, laser) via the bridge.
 * Returns immediately for fire-and-forget actions.
 * Awaits completion for synchronous actions.
 */
export async function executeMaicAction(action: Action): Promise<void> {
  const engine = getActionEngine();
  await engine.execute(action);
}

/**
 * Dispose the engine (cleanup timers).
 */
export function disposeActionEngine(): void {
  if (engineInstance) {
    engineInstance.dispose();
    engineInstance = null;
  }
}
