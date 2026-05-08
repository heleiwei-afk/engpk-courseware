'use client';

/**
 * SpotlightOverlay - Dims all blocks except the active one
 *
 * When a spotlight action fires, the target block gets full opacity
 * while others fade to 30%. Smooth CSS transition.
 *
 * Usage: wrap article blocks, pass activeIndex from playback state.
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SpotlightOverlayProps {
  children: ReactNode;
  /** Index of the currently spotlighted block (-1 = no spotlight, all visible) */
  activeIndex: number;
  /** Total number of blocks (for validation) */
  totalBlocks: number;
  /** This block's index */
  blockIndex: number;
}

export function SpotlightBlock({
  children,
  activeIndex,
  blockIndex,
}: SpotlightOverlayProps) {
  const isSpotlightActive = activeIndex >= 0;
  const isThisBlockActive = activeIndex === blockIndex;

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-in-out',
        isSpotlightActive && !isThisBlockActive && 'opacity-25 scale-[0.98]',
        isSpotlightActive && isThisBlockActive && 'opacity-100 scale-100 ring-2 ring-primary/30 ring-offset-2 rounded-lg',
      )}
    >
      {children}
    </div>
  );
}
