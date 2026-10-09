import { PixelCanvas } from './pixel-canvas.js';

// A brown kite seen from below, in three frames: gliding (the wings flat), wings up and wings down.
// A forked tail (black kites have one). 13 × 7 pixels. Letters: d dark brown, b brown, h the pale head,
// k the dark tail. '.' is clear.

export const KITE_CANVAS = { width: 13, height: 7 };
const C = { d: 0x3e2814, b: 0x7a5230, h: 0xc8a878, k: 0x2a1a0c };
const FRAMES = {
  glide: ['.............', 'dd.........dd', '.dbb.....bbd.', '..bbbbhbbbb..', '....dbbbd....', '.....dkd.....', '....d...d....'],
  up: ['d...........d', '.d.........d.', '..bb.....bb..', '...bbbhbbb...', '....dbbbd....', '.....dkd.....', '....d...d....'],
  down: ['.............', '.............', '....bbhbb....', '..bbbbbbbbb..', '.bb..dbd..bb.', 'dd...dkd...dd', '....d...d....'],
};

export function drawKite(frame) {
  const c = new PixelCanvas(KITE_CANVAS.width, KITE_CANVAS.height);
  FRAMES[frame].forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && c.setPixel(x, y, C[ch])));
  return c;
}

/** The kite's shadow on the ground: a small soft dark blob. */
export function drawKiteShadow() {
  const c = new PixelCanvas(7, 2);
  for (let x = 0; x < 7; x++) c.setPixel(x, 0, 0x000000, x === 0 || x === 6 ? 40 : 70);
  for (let x = 2; x < 5; x++) c.setPixel(x, 1, 0x000000, 60);
  return c;
}
