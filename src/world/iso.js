import { WORLD } from '../config.js';

// World axes: x goes to the lower right of the screen, y goes to the lower left,
// z goes up. World positions are in metres. Screen positions are internal pixels
// (before the camera zoom).

const HALF_W = WORLD.tileWidthPx / 2;
const HALF_H = WORLD.tileHeightPx / 2;

/** Project a world point (metres) to screen pixels. */
export function toScreen(x, y, z = 0) {
  const tx = x / WORLD.tileMetres;
  const ty = y / WORLD.tileMetres;
  return {
    x: (tx - ty) * HALF_W,
    y: (tx + ty) * HALF_H - (z / WORLD.levelMetres) * WORLD.levelPx,
  };
}

/** Inverse of toScreen for a known height z. */
export function toWorld(sx, sy, z = 0) {
  const syFlat = sy + (z / WORLD.levelMetres) * WORLD.levelPx;
  const a = sx / HALF_W; // tx - ty
  const b = syFlat / HALF_H; // tx + ty
  return {
    x: ((a + b) / 2) * WORLD.tileMetres,
    y: ((b - a) / 2) * WORLD.tileMetres,
  };
}

/**
 * Convert a direction on the screen (sx right, sy down) to a world heading
 * in radians (0 = +x, PI/2 = +y). Used by the screen relative steering model.
 */
export function screenDirToHeading(sx, sy) {
  // A world unit step dx, dy moves the screen by (dx - dy) * HALF_W, (dx + dy) * HALF_H.
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  const dx = (a + b) / 2;
  const dy = (b - a) / 2;
  return Math.atan2(dy, dx);
}

/** Screen direction (unit vector) of a world heading. */
export function headingToScreenDir(heading) {
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  const sx = (dx - dy) * HALF_W;
  const sy = (dx + dy) * HALF_H;
  const len = Math.hypot(sx, sy) || 1;
  return { x: sx / len, y: sy / len };
}

/** Wrap an angle to the range -PI..PI. */
export function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}
