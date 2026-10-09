import { SMOG } from '../config.js';

// The story arc: petrol to electric. No Phaser here.

/** The smog over the city at a level (0: clear air). Level 11 (free play) and later: clear. */
export function smogAt(level) {
  return SMOG.byLevel[Math.max(0, Math.min(level, SMOG.byLevel.length) - 1)] ?? 0;
}
