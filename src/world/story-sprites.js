import { COLOURS } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';

// The yellow battery pickup (story arc, levels 3 and 4): an Ampersand battery in Surge Yellow (a
// battery: Surge Yellow is right here), with a black top and a white lightning mark. 9 × 12 pixels.
export const BATTERY_CANVAS = { width: 9, height: 12, groundX: 4, groundY: 11 };

export function drawYellowBattery() {
  const c = new PixelCanvas(BATTERY_CANVAS.width, BATTERY_CANVAS.height);
  const Y = COLOURS.ampersandYellow, D = 0xc8ae00, K = 0x101010, W = 0xffffff;
  for (let y = 2; y < 11; y++) for (let x = 1; x < 8; x++) c.setPixel(x, y, x === 7 ? D : Y); // the body, darker on the right
  for (let x = 2; x < 7; x++) c.setPixel(x, 1, K); // the black top
  c.setPixel(3, 0, K); c.setPixel(5, 0, K); // the terminals
  for (const [x, y] of [[5, 3], [4, 4], [3, 5], [4, 5], [5, 5], [4, 6], [3, 7]]) c.setPixel(x, y, W); // a lightning mark
  for (let x = 1; x < 8; x++) c.setPixel(x, 11, 0x000000, 90); // a small shadow
  c.outline(0x161616);
  return c;
}

/**
 * The ending picture: a clear blue sky over the green hills of Kigali (no smog), the new family house
 * with blue doors and big windows, three Ampersand electric motos by the gate, and the family.
 */
export function drawEndingPicture(w, h) {
  const c = new PixelCanvas(w, h);
  const ground = h - 12;
  const sky = [0x3a7fd0, 0x4a8fe0, 0x5aa0e8, 0x70b4f0, 0x8ac6f4];
  const band = Math.ceil(ground / sky.length);
  for (let y = 0; y < ground; y++) for (let x = 0; x < w; x++) c.setPixel(x, y, sky[Math.min(sky.length - 1, Math.floor(y / band))]);
  c.fillDisc(w * 0.18, 12, 6, 0xfff0a0); // the sun
  // Two small white clouds.
  for (const [cx, cy] of [[w * 0.45, 10], [w * 0.78, 16]]) for (let i = 0; i < 4; i++) c.fillDisc(cx + i * 4, cy + (i % 2), 3, 0xffffff);
  // The hills: far blue green, near green.
  [[ground - 20, 6, 0.04, 1.1, 0x3f7a6a], [ground - 9, 5, 0.06, 3.3, 0x4f9a4a]].forEach(([base, amp, f, ph, col]) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(base - amp * Math.sin(x * f + ph));
      for (let y = Math.max(0, top); y < ground; y++) c.setPixel(x, y, col);
    }
  });
  // The yard (red earth) and a strip of grass.
  for (let y = ground; y < h; y++) for (let x = 0; x < w; x++) c.setPixel(x, y, y === ground ? 0x5aa040 : 0xa0502a);
  // The house: cream walls, a red roof, blue doors and big windows.
  const hx = Math.floor(Math.min(w * 0.55, w - 74)), hw = 46, hy = ground - 22; // room for the family on the right
  for (let y = hy; y < ground; y++) for (let x = hx; x < hx + hw; x++) c.setPixel(x, y, x === hx + hw - 1 ? 0xd8ccb0 : 0xf0e6cc);
  for (let i = 0; i < 9; i++) for (let x = hx - 3 + i; x < hx + hw + 3 - i; x++) c.setPixel(x, hy - 1 - i, i === 0 ? 0x7a2a1a : 0xb04a30);
  for (let y = ground - 12; y < ground; y++) for (let x = hx + 20; x < hx + 26; x++) c.setPixel(x, y, 0x2f6fb0); // the door
  for (const wx of [hx + 5, hx + 33]) for (let y = hy + 5; y < hy + 13; y++) for (let x = wx; x < wx + 8; x++) c.setPixel(x, y, y === hy + 9 || x === wx + 4 ? 0x2f6fb0 : 0x9cd0f0);
  // The gate posts and three electric motos (Surge Yellow: the Ampersand moto) in front.
  const moto = (mx) => {
    for (const wx of [mx + 2, mx + 11]) c.fillDisc(wx, ground + 6, 2.2, 0x1e1e1e);
    for (let x = mx + 2; x < mx + 12; x++) for (let y = ground + 2; y < ground + 5; y++) c.setPixel(x, y, COLOURS.ampersandYellow);
    for (let x = mx + 4; x < mx + 9; x++) c.setPixel(x, ground + 1, 0x111111); // the seat
    c.setPixel(mx + 12, ground + 1, 0x9a9a9a); c.setPixel(mx + 12, ground, 0x9a9a9a); // the handlebar
  };
  moto(hx - 50); moto(hx - 34); moto(hx - 18);
  // The family: two parents and two children, in bright clothes.
  const person = (px, tall, shirt) => {
    const top = ground + 6 - tall;
    c.fillDisc(px, top + 1, 1.6, 0x6b4226); // the head
    for (let y = top + 3; y < ground + 7; y++) {
      const legs = y > ground + 2;
      for (let x = px - 1; x <= px + 1; x++) if (!legs || x !== px) c.setPixel(x, y, legs ? 0x2a3550 : shirt);
    }
  };
  person(hx + 52, 13, 0x8a3a8a); person(hx + 58, 14, 0x3f8f4a); person(hx + 64, 9, 0xc0392b); person(hx + 69, 8, 0x2f6fb0);
  return c;
}
