import { PALETTE, COLOURS, WORLD } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';
import { finishFigure, tone } from './palette.js';
import { drawText, textWidth } from './garage-sprites.js';
import { toScreen } from './iso.js';
import { PERSON_CANVAS } from './vehicle-sprites.js';

// Sprites for the Ampersand HQ in Gikondo (sim/hq.js): the fence, the gates of the test track, the
// teal bow on your Alpha, the hand-in desk, the MURAKAZA NEZA banner and the children of the family.
// No Phaser here. Surge Yellow only on Ampersand things (the staff, the desk sign).

const C = PALETTE;
const T = WORLD.tileMetres;

// The Ampersand staff (design canvas: yellow and blue work clothes), the rider on foot, the family.
export const STAFF_LOOK = { shirt: COLOURS.ampersandYellow, legs: C.carBlue, skin: C.skinDeep, cap: C.carBlue, trim: C.carBlue };
export const MOTHER_LOOK = { kitenge: 1, skin: C.skin };
export const CHILD_LOOKS = [{ shirt: C.kOrange, legs: C.navy, skin: C.skin }, { shirt: C.green, legs: C.navy, skin: C.skinDeep }];

/** A fence panel of one tile along the x axis or the y axis: steel posts, rails and a see-through mesh. */
export const FENCE_HEIGHT_PX = 13;
export function drawFencePanel(axis) {
  const end = axis === 'x' ? toScreen(T, 0, 0) : toScreen(0, T, 0);
  const w = Math.abs(end.x) + 3, h = Math.abs(end.y) + FENCE_HEIGHT_PX + 3;
  const ox = end.x < 0 ? -end.x + 1 : 1; // the canvas point of the ground at the start of the panel
  const c = new PixelCanvas(w, h);
  const at = (t, up) => ({ x: ox + end.x * t, y: FENCE_HEIGHT_PX + 1 + end.y * t - up });
  // The mesh: a sparse pattern of diamonds, half see-through.
  const steps = Math.ceil(Math.abs(end.x));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    for (let up = 1; up < FENCE_HEIGHT_PX - 1; up++) {
      if ((i + up) % 3 && (i - up + 99) % 3) continue;
      const p = at(t, up);
      c.setPixel(Math.round(p.x), Math.round(p.y), C.silver, 150);
    }
  }
  // The rails at the top and the bottom.
  for (const up of [1, FENCE_HEIGHT_PX - 1]) {
    for (let i = 0; i <= steps; i++) {
      const p = at(i / steps, up);
      c.setPixel(Math.round(p.x), Math.round(p.y), up > 1 ? C.chrome : C.hub);
    }
  }
  // The post at the start of the panel (the next panel draws the next post).
  for (let up = 0; up <= FENCE_HEIGHT_PX; up++) {
    const p = at(0, up);
    c.setPixel(Math.round(p.x), Math.round(p.y), C.hub);
    c.setPixel(Math.round(p.x) + 1, Math.round(p.y), C.chrome);
  }
  return { canvas: c, groundX: ox, groundY: FENCE_HEIGHT_PX + 1 };
}

/** A gate of the test track: two poles and a band with the number. lit: the next gate (a bright band). */
export const GATE_CANVAS = { width: 26, height: 26, groundX: 13, groundY: 24 };
export function drawTrackGate(n, lit) {
  const c = new PixelCanvas(GATE_CANVAS.width, GATE_CANVAS.height);
  const gy = GATE_CANVAS.groundY;
  for (const x of [2, 23]) {
    for (let y = 6; y <= gy; y++) c.setPixel(x, y, y % 4 < 2 ? C.cream : C.red); // the red and white poles
  }
  const band = lit ? C.teal : C.charcoal;
  for (let y = 3; y <= 10; y++) for (let x = 1; x <= 24; x++) c.setPixel(x, y, (x + y) % 4 < 2 && (y === 3 || y === 10) ? C.cream : band);
  const label = String(n);
  drawText(c, label, Math.round((GATE_CANVAS.width - textWidth(label)) / 2), 5, C.cream);
  c.outline(C.ink);
  return c;
}

/** The big teal bow on your Alpha, with the name tag that hangs from it. */
export const BOW_CANVAS = { width: 15, height: 14, groundX: 7, groundY: 13 };
export function drawBow() {
  const c = new PixelCanvas(BOW_CANVAS.width, BOW_CANVAS.height);
  const teal = C.teal, dark = tone(C.teal, 'right');
  // Two loops and the knot.
  for (const [cx, col] of [[3.5, teal], [10.5, dark]]) c.fillDisc(cx, 3.5, 2.6, col);
  c.fillDisc(7, 4, 1.4, tone(C.teal, 'left'));
  c.line(6, 5, 4, 10, 1.4, teal); // the ribbon ends
  c.line(8, 5, 10, 9, 1.4, dark);
  // The name tag on a string.
  c.line(10, 9, 11, 11, 1, C.ink);
  for (let y = 10; y <= 13; y++) for (let x = 9; x <= 14; x++) c.setPixel(x, y, C.cream);
  for (let x = 10; x <= 13; x++) c.setPixel(x, 12, C.charcoal);
  c.outline(C.ink);
  return c;
}

/** The hand-in desk: a small table with a laptop and a yellow AMPERSAND card. */
export const DESK_CANVAS = { width: 28, height: 20, groundX: 14, groundY: 18 };
export function drawDesk() {
  const c = new PixelCanvas(DESK_CANVAS.width, DESK_CANVAS.height);
  // The top (a flat iso box), the front and the legs.
  const top = [{ x: 2, y: 10 }, { x: 14, y: 4 }, { x: 26, y: 10 }, { x: 14, y: 16 }];
  c.fillPoly(top, C.wood);
  for (let x = 2; x <= 14; x++) for (let y = 0; y < 3; y++) c.setPixel(x, Math.round(10 + (x - 2) / 2) + y, C.woodDark);
  for (let x = 14; x <= 26; x++) for (let y = 0; y < 3; y++) c.setPixel(x, Math.round(16 - (x - 14) / 2) + y, tone(C.woodDark, 'right'));
  for (const [x, y] of [[3, 13], [14, 19], [25, 13]]) for (let k = 0; k < 4; k++) c.setPixel(x, Math.min(19, y + k - 1), C.woodDark);
  // The laptop and the card.
  c.fillPoly([{ x: 12, y: 8 }, { x: 16, y: 6 }, { x: 19, y: 8 }, { x: 15, y: 10 }], C.silver);
  for (let y = 2; y <= 7; y++) c.line(16, y, 19, y + 1, 1, y === 2 ? C.hub : C.charcoal);
  for (let x = 6; x <= 9; x++) for (let y = 9; y <= 10; y++) c.setPixel(x, y, COLOURS.ampersandYellow);
  c.outline(C.ink);
  return c;
}

/** The MURAKAZA NEZA banner ("welcome") on two poles over the exit gate. */
export function drawBanner(text = 'MURAKAZA NEZA') {
  const w = textWidth(text) + 10, h = 9, pole = 20;
  const c = new PixelCanvas(w + 4, h + pole + 2);
  for (const x of [1, w + 2]) for (let y = 1; y <= h + pole; y++) c.setPixel(x, y, C.hub);
  for (let y = 2; y <= h + 1; y++) for (let x = 2; x <= w + 1; x++) c.setPixel(x, y, y === 2 || y === h + 1 ? tone(C.red, 'right') : C.red);
  drawText(c, text, 6, 4, C.cream);
  c.outline(C.ink);
  return { canvas: c, groundX: Math.round((w + 4) / 2), groundY: h + pole + 1 };
}

/** A child of the family (smaller than the walkers). armUp: waving. */
export function drawChild(look, armUp = false, left = false) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  for (const dx of [-1, 1]) c.line(gx + dx, gy - 1, gx + dx, gy - 6, 1.6, look.legs);
  for (let y = gy - 11; y <= gy - 6; y++) for (let x = gx - 2; x <= gx + 2; x++) c.plot(x, y, look.shirt);
  c.line(gx - 2.5, gy - 10, gx - 3, gy - 6, 1.4, look.skin);
  if (armUp) c.line(gx + 2.5, gy - 10, gx + 4, gy - 15, 1.4, look.skin);
  else c.line(gx + 2.5, gy - 10, gx + 3, gy - 6, 1.4, look.skin);
  c.fillDisc(gx + 0.5, gy - 13.5, 2.2, look.skin);
  for (let dx = -2; dx <= 2; dx++) c.plot(gx + 0.5 + dx, gy - 15.5, C.hair);
  c.plot(gx + 1.5, gy - 14, C.hair); // the eye
  return finishFigure(c, left);
}

// The colours of the confetti (the design canvas: coral, mint, lilac, gold; not Surge Yellow).
export const CONFETTI_COLOURS = [0xe8806a, 0x7fe0b8, 0xa8b0e0, 0xffc85a];
