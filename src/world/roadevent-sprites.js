import { PALETTE } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';
import { tone } from './palette.js';
import { drawText, textWidth } from './garage-sprites.js';
import { toScreen } from './iso.js';
import { drawPerson } from './vehicle-sprites.js';

// Sprites for the street events (sim/roadevents.js): road works (cones, a sign, a dug-up strip,
// workers in orange vests) and the car free morning (a barrier and a banner). No Phaser here.

const C = PALETTE;

/** A traffic cone: orange with a white band. 6 × 9; origin at the bottom middle. */
export const CONE_CANVAS = { width: 6, height: 9, groundX: 3, groundY: 8 };
export function drawCone() {
  const c = new PixelCanvas(CONE_CANVAS.width, CONE_CANVAS.height);
  for (let y = 0; y < 7; y++) {
    const half = Math.floor(y / 3);
    for (let x = 2 - half; x <= 3 + half; x++) c.setPixel(x, y, y === 3 || y === 4 ? C.cream : x <= 2 ? C.kOrange : tone(C.kOrange, 'right'));
  }
  for (let x = 0; x < 6; x++) c.setPixel(x, 7, C.charcoal); // the base
  for (let x = 0; x < 6; x++) c.setPixel(x, 8, 0x000000, 70);
  c.outline(C.ink);
  return c;
}

/** A board on two legs with words (ROAD WORKS, CAR FREE DAY). Origin: the ground between the legs. */
export function drawBoard(text, board, ink, legs = 8) {
  const w = textWidth(text) + 8, h = 9;
  const c = new PixelCanvas(w + 2, h + legs + 2);
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) c.setPixel(x, y, y === 1 || y === h || x === 1 || x === w ? C.ink : board);
  drawText(c, text, 5, 3, ink);
  for (const lx of [3, w - 2]) for (let y = h + 1; y < h + legs + 1; y++) c.setPixel(lx, y, C.charcoal);
  return { canvas: c, groundX: Math.floor((w + 2) / 2), groundY: h + legs };
}

/** A red and white barrier across a road end. Origin at the bottom middle. */
export function drawBarrier(width = 30) {
  const c = new PixelCanvas(width, 12);
  for (let x = 1; x < width - 1; x++) for (let y = 2; y < 6; y++) c.setPixel(x, y, Math.floor((x + y) / 4) % 2 ? C.red : C.cream);
  for (const lx of [3, width - 4]) for (let y = 6; y < 12; y++) c.setPixel(lx, y, C.charcoal);
  c.outline(C.ink);
  return { canvas: c, groundX: Math.floor(width / 2), groundY: 11 };
}

/**
 * The dug-up strip of the road works: red earth with stones, a flat shape on the ground. corners:
 * 4 points (metres) at ground height z. Returns { canvas, x, y }: the screen position of the canvas.
 */
export function drawPatch(corners, z) {
  const pts = corners.map((p) => toScreen(p.x, p.y, z));
  const minX = Math.floor(Math.min(...pts.map((p) => p.x))) - 1, minY = Math.floor(Math.min(...pts.map((p) => p.y))) - 1;
  const maxX = Math.ceil(Math.max(...pts.map((p) => p.x))) + 1, maxY = Math.ceil(Math.max(...pts.map((p) => p.y))) + 1;
  const c = new PixelCanvas(maxX - minX, maxY - minY, minX, minY);
  const P = (p) => ({ x: p.x, y: p.y, u: 0, v: 0 });
  c.fillQuad(P(pts[0]), P(pts[1]), P(pts[2]), P(pts[3]), (u, v, px, py) => ((px * 7 + py * 13) % 11 === 0 ? 0x6a5a4a : (px + py * 3) % 7 === 0 ? 0x7a3a1a : 0x9a5230));
  return { canvas: c, x: minX, y: minY };
}

/** A road worker in an orange vest, with a shovel (two frames: the shovel up and down). */
export const WORKER_LOOK = { skin: C.skin, shirt: C.kOrange, legs: C.navy };
export function drawWorker(frame) {
  const c = drawPerson(WORKER_LOOK, 1, frame);
  // The shovel: a handle and a blade at the right hand.
  const x0 = 10, y0 = frame ? 12 : 15;
  for (let i = 0; i < 6; i++) c.setPixel(x0 + (i >> 2), y0 + i, 0x7a5230);
  for (let x = x0; x < x0 + 3; x++) c.setPixel(x, y0 + 6, C.silver);
  return c;
}

/** A round NO MOTOS sign on a pole: a red ring, a white face and a black moto. Origin: the foot of the pole. */
export function drawNoMotoSign() {
  const c = new PixelCanvas(15, 24);
  c.fillDisc(7, 7, 7, C.red);
  c.fillDisc(7, 7, 5, C.cream);
  // The moto: two wheels and a body.
  for (const wx of [4, 10]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) c.setPixel(wx + dx - (wx > 7 ? 1 : 0), 9 + dy, C.ink);
  for (let x = 5; x <= 9; x++) c.setPixel(x, 7, C.ink);
  c.setPixel(6, 6, C.ink);
  c.setPixel(9, 6, C.ink);
  c.setPixel(10, 5, C.ink);
  // The red bar across.
  for (let i = 0; i < 9; i++) c.setPixel(3 + i, 3 + i, C.red);
  for (let y = 15; y < 24; y++) c.setPixel(7, y, C.charcoal);
  c.outline(C.ink);
  return { canvas: c, groundX: 7, groundY: 23 };
}
