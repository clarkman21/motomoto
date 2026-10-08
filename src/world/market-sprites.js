import { PixelCanvas, hash2 } from './pixel-canvas.js';
import { COLOURS } from '../config.js';
import { drawText, textWidth } from './garage-sprites.js';
import { finishFigure } from './palette.js';

// Market life, drawn small and simple: mamas in kitenge who sell fruit and vegetables on a mat
// (some under a big umbrella), goats and sheep tied up for sale, and kitenge for the walkers.
// Kitenge colours are bright, but not Surge Yellow (that colour is only for Ampersand).

export const KITENGE = [
  { base: 0xc0392b, pat: 0x1f4f9a, band: 0xf0a030, wrap: 0x1f4f9a },
  { base: 0x2f7f4a, pat: 0xe07a2a, band: 0xf2efe6, wrap: 0xe07a2a },
  { base: 0x6a2f8a, pat: 0xe8b030, band: 0x3fa0a0, wrap: 0xe8b030 },
  { base: 0x1f4f9a, pat: 0xe8e0c0, band: 0xc0392b, wrap: 0xc0392b },
  { base: 0xe07a2a, pat: 0x2a2a2a, band: 0x3f8f4a, wrap: 0x3f8f4a },
  { base: 0x2a8a8a, pat: 0xf2efe6, band: 0xb0306a, wrap: 0xb0306a },
];

/** A kitenge dress (a wrap from the shoulders to the ankles) with a dotted print and a band. */
export function drawKitengeDress(c, cx, top, bottom, halfW, k, seed = 0) {
  for (let y = Math.floor(top); y <= bottom; y++) {
    const w = halfW + (y - top) * 0.12; // a little wider at the hem
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const band = bottom - y === 2 || bottom - y === 3;
      const dot = (x + y * 2 + seed) % 4 === 0 && y % 2 === 0;
      c.plot(x, y, band ? k.band : dot ? k.pat : k.base);
    }
  }
}

/** A head wrap (igitambaro) on a head at (cx, cy) with radius r: it covers the top of the head, the face shows. */
export function drawHeadWrap(c, cx, cy, r, k) {
  // A wide, round wrap (an ellipse above the eyes) with a small knot on top.
  const ey = cy - r * 0.8, a = r * 1.3, b = r;
  for (let y = Math.floor(ey - b); y <= cy - r * 0.2; y++) {
    const q = 1 - ((y + 0.5 - ey) / b) ** 2;
    if (q <= 0) continue;
    const w = a * Math.sqrt(q);
    for (let x = Math.floor(cx - w); x <= cx + w; x++) c.plot(x, y, k.wrap);
  }
  c.fillDisc(cx + r * 0.3, ey - b + 0.3, r * 0.45, k.wrap);
  c.plot(cx - r * 0.4, ey, k.pat); // a fold in the cloth
}

// Goods on a vendor's mat. Each item: a colour and how it piles up.
const GOODS = {
  bananas: { colours: [0x7aa83a, 0x5a8a2a, 0x98c048], shape: 'bunch' },
  tomatoes: { colours: [0xd0302a, 0xe04a30, 0xb02a24], shape: 'pile' },
  avocados: { colours: [0x2f5a2a, 0x3f6a2a, 0x24481f], shape: 'pile' },
  pineapples: { colours: [0xd8a030, 0xc08a28], shape: 'pineapple' },
  potatoes: { colours: [0x8a4a5a, 0x9a6a4a, 0x7a3e4a], shape: 'pile' },
  onions: { colours: [0xb04a6a, 0xc06080], shape: 'pile' },
};
export const MARKET_GOODS = Object.keys(GOODS);

export const VENDOR_CANVAS = { width: 34, height: 42, groundX: 17, groundY: 37 };

function drawGoods(c, goods, x, y, seed) {
  const g = GOODS[goods];
  const col = (i) => g.colours[Math.floor(hash2(i, seed, 3) * g.colours.length)];
  // A wide woven basket (agaseke), with the goods heaped on top.
  for (let dy = 0; dy <= 2; dy++) {
    const w = 4.5 - dy * 0.8;
    for (let dx = -w; dx <= w; dx++) c.plot(x + dx, y + dy, (Math.round(dx) + dy) % 2 ? 0x8a5a2a : 0xb07a3a);
  }
  if (g.shape === 'pile') {
    const heap = [[-3, -1], [0, -1], [3, -1], [-1.5, -3], [1.5, -3], [0, -5]];
    heap.forEach(([dx, dy], i) => c.fillDisc(x + dx, y + dy, 1.7, col(i)));
    c.plot(x - 1, y - 6, 0xffffff); // a shine on the top one
  } else if (g.shape === 'bunch') {
    // A big bunch of green bananas: hands of fingers that point up, on a dark stem.
    c.line(x, y - 1, x, y - 9, 1.4, 0x4a3a1a);
    for (let r = 0; r < 4; r++) {
      const hy = y - 1 - r * 2;
      for (let i = -3; i <= 3; i++) if (Math.abs(i) <= 3 - (r === 3 ? 1 : 0)) c.line(x + i, hy, x + i * 1.2, hy - 2, 1, col(r * 7 + i));
    }
  } else {
    for (const dx of [-2.5, 2.5]) {
      c.fillDisc(x + dx, y - 3, 2.2, col(dx));
      for (let i = 0; i < 3; i++) c.plot(x + dx - 1 + i, y - 6 - (i === 1 ? 1 : 0), 0x3f8f4a);
      c.plot(x + dx, y - 3, 0xa07020); // the pattern on the skin
    }
  }
}

/**
 * A mama who sells goods on a woven mat. She sits on a low stool behind it. frame 1: she
 * lifts an arm and calls to customers. umbrella: a big market umbrella above her.
 */
export function drawVendor(goods, kitenge, frame = 0, umbrella = null, seed = 0) {
  const c = new PixelCanvas(VENDOR_CANVAS.width, VENDOR_CANVAS.height);
  const gx = VENDOR_CANVAS.groundX, gy = VENDOR_CANVAS.groundY;
  const k = KITENGE[kitenge % KITENGE.length];
  const skin = [0x6b4226, 0x5a3820, 0x7a4a2a][seed % 3];
  // The mama: a wide sitting body in kitenge, arms, head with a head wrap.
  const by = gy - 6; // seat
  drawKitengeDress(c, gx, by - 8, by + 1, 3.2, k, seed);
  c.line(gx - 3.5, by - 7, gx - 4, by - 2, 1.6, skin);
  if (frame) c.line(gx + 3.5, by - 7, gx + 6, by - 13, 1.6, skin); // calls to customers
  else c.line(gx + 3.5, by - 7, gx + 4, by - 2, 1.6, skin);
  c.fillDisc(gx + 0.5, by - 11, 2.6, skin);
  drawHeadWrap(c, gx + 0.5, by - 11, 2.6, k);
  // The mat in front of her, a flat diamond, with the goods on it.
  const my = gy;
  for (let y = -3; y <= 3; y++) {
    const w = 13 - Math.abs(y) * 3;
    for (let x = -w; x <= w; x++) c.plot(gx + x, my + y, (Math.floor(x) + y) % 3 === 0 ? 0xa8804a : 0xc8a060);
  }
  drawGoods(c, goods, gx - 6, my, seed);
  drawGoods(c, goods, gx + 5, my + 1, seed + 1);
  if (umbrella !== null) {
    // A big umbrella on a pole behind her: alternate colour panels.
    c.line(gx - 6, gy - 2, gx - 6, gy - 30, 1, 0x4a4a4a);
    const cols = [[0xc0392b, 0xf2efe6], [0x2f6fb0, 0xf2efe6], [0x3f8f4a, 0xe07a2a]][umbrella % 3];
    for (let y = 0; y <= 6; y++) {
      const w = 4 + y * 2;
      for (let x = -w; x <= w; x++) c.plot(gx - 6 + x, gy - 36 + y, cols[Math.floor((x + 40) / 4) % 2]);
    }
  }
  return finishFigure(c);
}

export const ANIMAL_CANVAS = { width: 20, height: 16, groundX: 10, groundY: 15 };
export const GOAT_COATS = [
  { body: 0x8a5a3a, patch: 0xe8e4dc, head: 0x8a5a3a },
  { body: 0x2a2a2a, patch: 0x5a4a3a, head: 0x2a2a2a },
  { body: 0xe8e4dc, patch: 0x8a5a3a, head: 0x8a5a3a },
];

/** A goat, side view, looking to the right. frame 1: the head is down (it eats). */
export function drawGoat(coat, frame = 0) {
  const c = new PixelCanvas(ANIMAL_CANVAS.width, ANIMAL_CANVAS.height);
  const gx = ANIMAL_CANVAS.groundX, gy = ANIMAL_CANVAS.groundY;
  const k = GOAT_COATS[coat % GOAT_COATS.length];
  for (const lx of [-4, -2, 2, 4]) c.line(gx + lx, gy - 1, gx + lx, gy - 6, 1, 0x3a2a1a); // thin legs
  c.fillDisc(gx - 2, gy - 8, 2.6, k.body);
  c.fillDisc(gx + 2, gy - 8, 2.6, k.body);
  c.fillDisc(gx - 1, gy - 8, 1.3, k.patch);
  c.line(gx - 4.5, gy - 10, gx - 5.5, gy - 12, 1, k.body); // the tail stands up
  const hy = frame ? gy - 4 : gy - 12, hx = gx + 6;
  c.line(gx + 3.5, gy - 9, hx, hy + 1, 1.8, k.body);
  c.fillDisc(hx + 0.5, hy, 1.7, k.head);
  c.line(hx - 0.5, hy - 1.5, hx - 2, hy - 3.5, 1, 0x9a8a6a); // horns that curve back
  c.plot(hx - 1.5, hy, 0x2a2a2a); // ear
  c.plot(hx + 1.5, hy + 2, 0x3a3a3a); // beard
  return finishFigure(c);
}

/** A sheep, side view, looking to the right: a fluffy white body, a dark face and dark legs. */
export function drawSheep(frame = 0) {
  const c = new PixelCanvas(ANIMAL_CANVAS.width, ANIMAL_CANVAS.height);
  const gx = ANIMAL_CANVAS.groundX, gy = ANIMAL_CANVAS.groundY;
  for (const lx of [-3, -1, 2, 4]) c.line(gx + lx, gy - 1, gx + lx, gy - 3, 1, 0x2a2a2a);
  for (const [dx, dy, r] of [[-3, -6, 3], [0, -7, 3.2], [3, -6, 3], [-1, -4, 2.8], [2, -4, 2.8]]) c.fillDisc(gx + dx, gy + dy, r, 0xeeeae0);
  for (const [dx, dy] of [[-4, -4], [-1, -3], [2, -3], [4, -5]]) c.plot(gx + dx, gy + dy, 0xc8c4b8); // shade in the wool
  const hy = frame ? gy - 3 : gy - 8, hx = gx + 7;
  c.fillDisc(hx, hy, 1.8, 0x2a2a2a);
  c.plot(hx - 2, hy - 1, 0x2a2a2a); // ear
  return finishFigure(c);
}

/**
 * An MTN MoMo agent: a lady in a yellow vest sits behind a small yellow stand with "MOMO" on it,
 * under a big yellow umbrella. frame 1: she holds her phone to her ear. MTN yellow, not Surge Yellow.
 */
export function drawMomoAgent(frame = 0, seed = 0) {
  const c = new PixelCanvas(VENDOR_CANVAS.width, VENDOR_CANVAS.height);
  const gx = VENDOR_CANVAS.groundX, gy = VENDOR_CANVAS.groundY;
  const Y = COLOURS.mtnYellow, B = COLOURS.mtnBlue, DARK_Y = 0xd99a00;
  const skin = [0x6b4226, 0x5a3820, 0x7a4a2a][seed % 3];
  const k = KITENGE[(seed + 1) % KITENGE.length];
  // The umbrella pole, behind her.
  c.line(gx + 4, gy - 2, gx + 4, gy - 29, 1, 0x4a4a4a);
  // The lady: a kitenge skirt, a yellow vest, a head wrap; she sits behind the stand.
  const by = gy - 6;
  drawKitengeDress(c, gx - 2, by - 8, by + 1, 3.2, k, seed);
  for (let y = by - 8; y <= by - 3; y++) for (let x = gx - 5; x <= gx + 1; x++) c.plot(x, y, Y); // the vest
  c.plot(gx - 2, by - 6, B); // the MTN badge on the vest
  c.line(gx - 5.5, by - 7, gx - 6, by - 2, 1.6, skin);
  if (frame) {
    c.line(gx + 1.5, by - 7, gx + 1, by - 12, 1.6, skin); // the phone at her ear
    c.plot(gx + 1, by - 13, 0x1a1a1a);
    c.plot(gx + 1, by - 12, 0x1a1a1a);
  } else c.line(gx + 1.5, by - 7, gx + 2, by - 2, 1.6, skin);
  c.fillDisc(gx - 1.5, by - 11, 2.6, skin);
  drawHeadWrap(c, gx - 1.5, by - 11, 2.6, k);
  // The stand in front: a yellow box with a blue band and MOMO in yellow letters.
  const sx = gx - 11, sw = 22, sTop = gy - 9;
  for (let y = sTop; y <= gy; y++) for (let x = sx; x < sx + sw; x++) c.plot(x, y, y === sTop ? 0xffe070 : x === sx + sw - 1 ? DARK_Y : Y);
  for (let y = sTop + 2; y <= sTop + 8; y++) for (let x = sx + 1; x < sx + sw - 1; x++) c.plot(x, y, B);
  const word = 'MOMO';
  drawText(c, word, sx + Math.round((sw - textWidth(word)) / 2), sTop + 3, Y);
  // The umbrella: all yellow, with darker panels, and a blue top.
  for (let y = 0; y <= 6; y++) {
    const w = Math.round(3 + y * 1.8);
    for (let x = -w; x <= w; x++) c.plot(gx + 2 + x, gy - 34 + y, Math.floor((x + 40) / 4) % 2 ? Y : DARK_Y);
  }
  c.plot(gx + 2, gy - 35, B);
  return finishFigure(c);
}
