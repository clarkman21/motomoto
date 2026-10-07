import { WORLD, COLOURS } from '../config.js';
import { drawRetroText } from './retro-font.js';
import { PixelCanvas, shadeColour, hash2 } from './pixel-canvas.js';

// Sprites for the moto garage yard: the name sign, mechanics at work, oil stains, tyres and an oil drum.

// A small pixel font (5 rows high, most letters 3 wide; M, N and W are wider) for painted signs.
const FONT = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'], K: ['101', '110', '100', '110', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'], N: ['1001', '1101', '1011', '1001', '1001'], O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '110', '011'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['10001', '10001', '10101', '11011', '10001'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '001', '001'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '-': ['000', '000', '111', '000', '000'], '&': ['010', '101', '010', '101', '011'],
  '.': ['000', '000', '000', '000', '010'], "'": ['010', '010', '000', '000', '000'],
};

const glyphWidth = (ch) => (FONT[ch] ? FONT[ch][0].length : 3);

/** Width in pixels of a text in the pixel font. */
export const textWidth = (text) => [...text.toUpperCase()].reduce((w, ch) => w + glyphWidth(ch) + 1, 0) - 1;

/** True if the pixel (x, y) of a text in the pixel font is set (x, y from the top left). */
export function textBit(text, x, y) {
  if (y < 0 || y > 4 || x < 0) return false;
  for (const ch of text.toUpperCase()) {
    const w = glyphWidth(ch);
    if (x < w) return FONT[ch]?.[y][x] === '1';
    x -= w + 1;
  }
  return false;
}

/** Draw a text in the pixel font, top left at (x, y). */
export function drawText(c, text, x, y, rgb) {
  for (const ch of text.toUpperCase()) {
    const rows = FONT[ch];
    if (rows) rows.forEach((row, ry) => [...row].forEach((bit, rx) => bit === '1' && c.setPixel(x + rx, y + ry, rgb)));
    x += glyphWidth(ch) + 1;
  }
}

/**
 * A painted garage sign on two wooden posts: the name, and a second line under it.
 * The canvas origin is at the foot of the sign (groundX, groundY in the result).
 */
export function drawGarageSign(name, line2 = 'MOTO GARAGE') {
  const w = Math.max(textWidth(name), textWidth(line2)) + 8;
  const h = 19;
  const postH = 30; // tall posts: the board stands above the workshop roof
  const c = new PixelCanvas(w + 2, h + postH + 2);
  const board = 0x2a4f8a, frame = 0xe8e2d0;
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) {
    const edge = y === 1 || y === h || x === 1 || x === w;
    let col = edge ? frame : board;
    if (!edge && hash2(x, y, 41) > 0.93) col = shadeColour(board, 0.8); // worn paint
    c.setPixel(x, y, col);
  }
  drawText(c, name, Math.round((w + 2 - textWidth(name)) / 2), 4, 0xfcfcf0);
  drawText(c, line2, Math.round((w + 2 - textWidth(line2)) / 2), 11, 0xf2c94c);
  for (const px of [4, w - 3]) for (let y = h + 1; y <= h + postH; y++) { c.setPixel(px, y, 0x5a4026); c.setPixel(px + 1, y, 0x3e2a18); }
  c.outline(0x161616);
  return { canvas: c, groundX: (w + 2) / 2, groundY: h + postH + 1 };
}

/** A mechanic in blue overalls who kneels and works with a spanner. frame 0 or 1 (the arm moves). */
export const MECHANIC_CANVAS = { width: 16, height: 22, groundX: 8, groundY: 20 };
export function drawMechanic(frame, flip = false) {
  const c = new PixelCanvas(MECHANIC_CANVAS.width, MECHANIC_CANVAS.height);
  const gx = MECHANIC_CANVAS.groundX, gy = MECHANIC_CANVAS.groundY;
  const d = flip ? -1 : 1;
  const overall = 0x2f4a7a, skin = 0x5a3820;
  c.line(gx - 3 * d, gy - 1, gx - 3 * d, gy - 5, 2.4, overall); // knee on the ground
  c.line(gx - 3 * d, gy - 5, gx + 1 * d, gy - 5, 2.4, overall); // thigh
  c.line(gx + 1 * d, gy - 5, gx + 1 * d, gy - 1, 2.2, overall); // the other leg
  c.line(gx - 2 * d, gy - 6, gx + 1 * d, gy - 12, 4.2, overall); // body, bent forward
  for (let y = gy - 11; y < gy - 7; y++) c.setPixel(gx - 1 * d, y, 0x1a1a1a); // grease on the overalls
  c.fillDisc(gx + 2 * d, gy - 14.5, 2.2, skin); // head
  c.line(gx, gy - 17, gx + 4 * d, gy - 16, 1.6, 0xc0392b); // cap
  const hand = frame ? [gx + 5 * d, gy - 8] : [gx + 6 * d, gy - 5];
  c.line(gx + 1 * d, gy - 11, hand[0], hand[1], 1.6, skin); // arm
  c.line(hand[0], hand[1], hand[0] + 2 * d, hand[1] - 1, 1, 0xb0b0b0); // spanner
  c.outline(0x161616);
  return c;
}

/** A dark oil stain on the ground (flat, with soft edges). Its centre is the canvas centre. */
export function drawOilStain(seed) {
  const T = WORLD.tileMetres;
  const w = 26, h = 14;
  const c = new PixelCanvas(w, h, -w / 2, -h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2 + 0.5) / (w / 2), dy = (y - h / 2 + 0.5) / (h / 2);
    const wobble = 0.25 * Math.sin(Math.atan2(dy, dx) * 3 + seed) + 0.15 * hash2(x >> 1, y >> 1, seed);
    const d = Math.hypot(dx, dy) + wobble;
    if (d < 0.75) c.setPixel(x, y, 0x101010, d < 0.45 ? 200 : 140);
  }
  return c;
}

/** A stack of old tyres. */
export const SMALL_PROP = { width: 14, height: 18, groundX: 7, groundY: 16 };
export function drawTyres() {
  const c = new PixelCanvas(SMALL_PROP.width, SMALL_PROP.height);
  const gx = SMALL_PROP.groundX, gy = SMALL_PROP.groundY;
  for (let i = 0; i < 3; i++) {
    const y = gy - 2 - i * 3;
    for (let x = -4; x <= 4; x++) for (let dy = -1; dy <= 1; dy++) {
      const ring = Math.abs(x) > 1 || dy !== 0;
      c.setPixel(gx + x, y + dy, ring ? (dy === -1 ? 0x3a3a3a : 0x1e1e1e) : 0x0a0a0a);
    }
  }
  c.outline(0x161616);
  return c;
}

/** An oil drum with a drip. */
export function drawOilDrum() {
  const c = new PixelCanvas(SMALL_PROP.width, SMALL_PROP.height);
  const gx = SMALL_PROP.groundX, gy = SMALL_PROP.groundY;
  for (let y = gy - 11; y <= gy; y++) for (let x = gx - 3; x <= gx + 3; x++) {
    let col = x < gx ? 0x2a4f8a : 0x203e6e;
    if (y === gy - 8 || y === gy - 3) col = 0x16305a; // ribs
    if (y === gy - 11) col = 0x3a5f9a;
    c.setPixel(x, y, col);
  }
  c.setPixel(gx + 1, gy - 10, 0x101010);
  c.setPixel(gx + 4, gy, 0x101010);
  c.outline(0x161616);
  return c;
}

/**
 * A sign for a landmark building. kind 'roof': big letters (retro font) on a dark panel, for the roof
 * of a tower. kind 'wall': a blue board with white letters (and a second line), for the front wall
 * of an office, a school or a market. Returns { canvas, groundX, groundY } (the bottom centre).
 */
export function drawBuildingSign(text, line2 = '', kind = 'wall') {
  if (kind === 'roof') {
    const w = retroWidth(text) + 8, h = 13;
    const c = new PixelCanvas(w + 2, h + 6);
    for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) c.setPixel(x, y, y === 1 || y === h ? 0x5a5e62 : 0x14181c);
    drawRetroText(c, text, 5, 4, 0xf6f5ec, 0x2a3a4a);
    for (const px of [3, w - 2]) for (let y = h + 1; y <= h + 5; y++) c.setPixel(px, y, 0x5a5e62); // the frame on the roof
    return { canvas: c, groundX: (w + 2) / 2, groundY: h + 5 };
  }
  if (kind === 'brand') {
    // Ampersand: black board, big Surge Yellow letters (the retro font), white second line.
    const w = Math.max(retroWidth(text), textWidth(line2)) + 10, h = line2 ? 20 : 13;
    const c = new PixelCanvas(w + 2, h + 2);
    for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) c.setPixel(x, y, y === 1 || y === h || x === 1 || x === w ? COLOURS.ampersandYellow : 0x0a0a0a);
    drawRetroText(c, text, Math.round((w + 2 - retroWidth(text)) / 2) + 1, 3, COLOURS.ampersandYellow, 0x3a3200);
    if (line2) drawText(c, line2, Math.round((w + 2 - textWidth(line2)) / 2), 13, 0xffffff);
    c.outline(0x161616);
    return { canvas: c, groundX: (w + 2) / 2, groundY: h + 1 };
  }
  const w = Math.max(textWidth(text), textWidth(line2)) + 8;
  const h = line2 ? 16 : 10;
  const c = new PixelCanvas(w + 2, h + 2);
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) c.setPixel(x, y, y === 1 || y === h || x === 1 || x === w ? 0xe8e8f0 : 0x1f4f9a);
  drawText(c, text, Math.round((w + 2 - textWidth(text)) / 2), 3, 0xffffff);
  if (line2) drawText(c, line2, Math.round((w + 2 - textWidth(line2)) / 2), 9, 0xf2c94c);
  c.outline(0x161616);
  return { canvas: c, groundX: (w + 2) / 2, groundY: h + 1 };
}

const retroWidth = (text) => text.length * 6;

/**
 * The price sign of a fuel station: a blue panel on a tall pole, with the brand name in big yellow
 * letters and two lit price bars (SP colours). The canvas origin is at the foot of the pole.
 */
export function drawFuelSign(brand) {
  const w = Math.max(17, retroWidth(brand) + 6), panel = 24, pole = 30;
  const c = new PixelCanvas(w + 2, panel + pole + 2);
  const cx = Math.floor((w + 2) / 2);
  for (let y = panel; y < panel + pole; y++) for (const dx of [-1, 0]) c.setPixel(cx + dx, y, dx ? 0x8a8a8a : 0x6a6a6a);
  for (let y = 1; y <= panel; y++) {
    for (let x = 1; x <= w; x++) c.setPixel(x, y, y === 1 || y === panel || x === 1 || x === w ? COLOURS.spYellow : COLOURS.spBlue);
  }
  drawRetroText(c, brand, Math.round((w + 2 - retroWidth(brand)) / 2) + 1, 4, COLOURS.spYellow, 0x0f2a5a);
  for (const y of [15, 19]) for (let x = 4; x <= w - 3; x++) c.setPixel(x, y, x < w - 7 ? 0xf2efe6 : 0x202020);
  c.outline(0x161616);
  return { canvas: c, groundX: cx, groundY: panel + pole };
}
