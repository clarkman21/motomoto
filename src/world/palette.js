import { PALETTE, LIGHT, COLOURS } from '../config.js';
import { shadeColour } from './pixel-canvas.js';

// Helpers for the visual design system (the palette and the light rule in config.js). No Phaser here.

/** The tone of a base colour on a face: 'top' (lit), 'left' (mid) or 'right' (dark). */
export function tone(base, face = 'top') {
  return shadeColour(base, LIGHT[face] ?? 1);
}

/**
 * The tone for a face from its normal in the world (nx, ny). The camera looks from +x +y. A face that
 * looks more to +y shows on the left of the screen (mid tone); more to +x, on the right (dark tone).
 */
export function faceTone(nx, ny) {
  return ny >= nx ? 'left' : 'right';
}

/** All colours that the palette allows: each base colour (palette and brand) in its 3 tones. */
export function paletteColours() {
  const set = new Set();
  for (const base of [...Object.values(PALETTE), ...Object.values(COLOURS)]) {
    for (const face of Object.keys(LIGHT)) set.add(tone(base, face));
  }
  return set;
}

/** Colours in a canvas that are not in the palette (for tests). Transparent pixels do not count. */
export function offPalette(canvas, allowed = paletteColours()) {
  const out = new Set();
  const d = canvas.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const rgb = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    if (!allowed.has(rgb)) out.add(rgb);
  }
  return [...out];
}

/** Turn the canvas from left to right. */
export function mirror(c) {
  const w = c.width, d = c.data;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < w >> 1; x++) {
      const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) [d[a + k], d[b + k]] = [d[b + k], d[a + k]];
    }
  }
  return c;
}

/**
 * Finish a small figure (a person) with the light rule: turn it to the left if `left`, give the
 * right edge of the body the dark tone (the light comes from the top left), then the ink outline.
 * Draw the figure to look to the right; the light stays on the same side when it looks to the left.
 */
export function finishFigure(c, left = false) {
  if (left) mirror(c);
  const marks = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) if (c.alphaAt(x, y) && !c.alphaAt(x + 1, y)) marks.push(x, y);
  }
  for (let i = 0; i < marks.length; i += 2) {
    const j = (marks[i + 1] * c.width + marks[i]) * 4, d = c.data;
    c.setPixel(marks[i], marks[i + 1], tone((d[j] << 16) | (d[j + 1] << 8) | d[j + 2], 'right'));
  }
  c.outline(PALETTE.ink);
  return c;
}
