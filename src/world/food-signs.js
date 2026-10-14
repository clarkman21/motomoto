import { PALETTE, RIDER } from '../config.js';
import { PixelCanvas } from './pixel-canvas.js';
import { drawText, textWidth } from './garage-sprites.js';

// The food sign (Alp, 14 October 2026: "kiosks should clearly be labeled"): one look for all the food
// stops, so you learn it once and see it from far. An orange disc with a white food picture on a pole,
// and a small board under it with what you can buy there and the price. No Phaser here.

const C = PALETTE;
const DISC = 0xe07a2a; // food orange (not Surge Yellow, not the MTN yellow)
const BOARD = 0x1f3a2a;
// The food pictures (white on the disc), 7 × 5.
const ICONS = {
  buffet: ['.......', '#.#.#..', '#######', '.#####.', '..###..'], // a fork and a plate of food
  ikivuguto: ['..###..', '..#.#..', '.#####.', '.#####.', '.#####.'], // a milk bottle
  bananas: ['......#', '....##.', '..###..', '.###...', '##.....'], // a banana
  drink: ['...##..', '..##...', '.#####.', '.##.##.', '.#####.'], // a can
};
const LABELS = { buffet: 'BUFFET', ikivuguto: 'IKIVUGUTO', bananas: 'BANANAS', drink: 'DRINKS' };

/** The sign of a food stop (food: a key of RIDER.foods). Returns { canvas, groundX, groundY } (the foot of the pole). */
export function drawFoodSign(food) {
  const f = RIDER.foods[food];
  const name = LABELS[food] ?? food.toUpperCase();
  const price = `${f.price.toLocaleString('en')} RWF`;
  const bw = Math.max(textWidth(name), textWidth(price)) + 6, bh = 15, r = 6, pole = 10;
  const w = Math.max(bw, r * 2 + 1) + 2, h = r * 2 + 1 + bh + pole + 2;
  const c = new PixelCanvas(w, h);
  const cx = Math.floor(w / 2);
  // The pole.
  for (let y = r * 2 + bh; y < h - 1; y++) { c.setPixel(cx, y, C.hub); c.setPixel(cx - 1, y, C.charcoal); }
  // The disc with the picture.
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) c.setPixel(cx + x, r + 1 + y, DISC);
  (ICONS[food] ?? ICONS.buffet).forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && c.setPixel(cx - 3 + i, r - 1 + j, C.cream)));
  // The board: the name and the price.
  const bx = Math.floor((w - bw) / 2), by = r * 2 + 2;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) c.setPixel(bx + x, by + y, y === 0 || y === bh - 1 ? DISC : BOARD);
  drawText(c, name, Math.round((w - textWidth(name)) / 2), by + 2, C.cream);
  drawText(c, price, Math.round((w - textWidth(price)) / 2), by + 8, 0xf2c94c);
  c.outline(C.ink);
  return { canvas: c, groundX: cx, groundY: h - 2 };
}
