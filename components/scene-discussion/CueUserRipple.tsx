'use client';

/**
 * CueUserRipple - Amber ripple animation on user avatar when it's their turn
 */

import { motion } from 'motion/react';

interface CueUserRippleProps {
  active: boolean;
}

export function CueUserRipple({ active }: CueUserRippleProps) {
  if (!active) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="absolute h-full w-full rounded-full border-2 border-amber-400"
        animate={{ scale: [1, 1.8, 2.2], opacity: [0.8, 0.3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute h-full w-full rounded-full border-2 border-amber-400"
        animate={{ scale: [1, 1.5, 1.8], opacity: [0.6, 0.2, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-amber-400/20"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  );
}
