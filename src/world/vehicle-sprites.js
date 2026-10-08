import { toScreen } from './iso.js';
import { PixelCanvas } from './pixel-canvas.js';
import { PALETTE } from '../config.js';
import { tone, faceTone, finishFigure } from './palette.js';
import { textWidth, textBit } from './garage-sprites.js';
import { drawBike, BIKE_DIRECTIONS, BIKE_CANVAS } from './sprites.js';
import { KITENGE, drawKitengeDress, drawHeadWrap } from './market-sprites.js';

// Traffic sprites made in code: cars, minibuses, trucks (boxes turned to 16 directions) and
// other motos (the bike drawing with rival colours). People: walkers in 4 directions.

export const VEHICLE_CANVAS = { width: 112, height: 96, groundX: 56, groundY: 66 };
const C = PALETTE;
// Each variant: the paint (car), the stripe (minibus) or the cab colour (truck). Minibuses and
// trucks carry a sticker with a slogan across the top of the windscreen, as in Kigali. The truck
// variants also carry a different load: sacks, bananas or a tarpaulin.
export const VEHICLE_VARIANTS = {
  car: [C.white, C.silver, C.carRed, C.carBlue, C.carGreen],
  bus: [{ stripe: C.kBlue, slogan: ['IMANA', 'AMEN'] }, { stripe: C.green, slogan: ['JESUS', 'HOZA'] }, { stripe: C.red, slogan: ['MERCI', 'AMEN'] }],
  truck: [
    { cab: C.carRed, load: 'sacks', slogan: ['GOD IS WIN', 'BLESSED', 'IMANA'] },
    { cab: C.cabBlue, load: 'bananas', slogan: ['GOD BLESS', 'BLESSED', 'AMEN'] },
    { cab: C.cabGreen, load: 'tarp', slogan: ['ONLY GOD', 'IMANA', 'HOZA'] },
  ],
};

/** Draw a vehicle (car, bus or truck) for one of 16 directions. */
export function drawVehicle(kind, variant, frame) {
  const heading = (frame / BIKE_DIRECTIONS) * Math.PI * 2;
  const c = new PixelCanvas(VEHICLE_CANVAS.width, VEHICLE_CANVAS.height, -VEHICLE_CANVAS.groundX, -VEHICLE_CANVAS.groundY);
  const v = VEHICLE_VARIANTS[kind][variant % VEHICLE_VARIANTS[kind].length];
  const { parts, stickers = [] } = BUILD[kind](v);
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const P = (f, s, z) => {
    const dx = f * cos - s * sin, dy = f * sin + s * cos;
    return { ...toScreen(dx, dy, z), dx, dy };
  };
  // Lower parts first, then back to front.
  const depthOf = (p) => { const m = P((p.f0 + p.f1) / 2, (p.s0 + p.s1) / 2, 0); return m.dx + m.dy; };
  parts.sort((a, b) => a.z0 - b.z0 || depthOf(a) - depthOf(b));
  for (const part of parts) drawPart(c, part, P, cos, sin);
  for (const st of stickers) drawSticker(c, st, P, cos, sin);
  c.outline(C.ink);
  return c;
}

/**
 * One box of a vehicle: f (forward), s (side), z (up) ranges in metres. side(u, z, face) and
 * top(u, v) give a palette colour (or are one colour); the light rule gives the tone of the face.
 * On the front and back faces, u goes from left to right as you look at the face. On the left and
 * right faces, u goes from the front to the back (left) or from the back to the front (right). On the
 * top, u goes from the back to the front and v from the left side to the right side.
 */
function drawPart(c, p, P, cos, sin) {
  const faces = [
    { n: [1, 0], a: [p.f1, p.s1], b: [p.f1, p.s0], name: 'front' },
    { n: [-1, 0], a: [p.f0, p.s0], b: [p.f0, p.s1], name: 'back' },
    { n: [0, 1], a: [p.f0, p.s1], b: [p.f1, p.s1], name: 'right' },
    { n: [0, -1], a: [p.f1, p.s0], b: [p.f0, p.s0], name: 'left' },
  ];
  for (const face of faces) {
    // The world normal of the face. The camera looks from +x +y, so faces with nx + ny > 0 show.
    const nx = face.n[0] * cos - face.n[1] * sin, ny = face.n[0] * sin + face.n[1] * cos;
    if (nx + ny <= 0.01) continue;
    const t = faceTone(nx, ny);
    const A = P(face.a[0], face.a[1], p.z1), B = P(face.b[0], face.b[1], p.z1);
    const Bb = P(face.b[0], face.b[1], p.z0), Ab = P(face.a[0], face.a[1], p.z0);
    c.fillQuad(
      { x: A.x, y: A.y, u: 0, v: p.z1 }, { x: B.x, y: B.y, u: 1, v: p.z1 },
      { x: Bb.x, y: Bb.y, u: 1, v: p.z0 }, { x: Ab.x, y: Ab.y, u: 0, v: p.z0 },
      (u, z) => tone(typeof p.side === 'function' ? p.side(u, z, face.name) : p.side, t),
    );
  }
  const top = (u, v) => (typeof p.top === 'function' ? p.top(u, v) : p.top);
  c.fillQuad(
    { ...P(p.f0, p.s0, p.z1), u: 0, v: 0 }, { ...P(p.f1, p.s0, p.z1), u: 1, v: 0 },
    { ...P(p.f1, p.s1, p.z1), u: 1, v: 1 }, { ...P(p.f0, p.s1, p.z1), u: 0, v: 1 },
    (u, v) => tone(top(u, v), 'top'),
  );
}

/**
 * A sticker or painted words: a band of colour with a slogan in the sign font, on one face of the
 * vehicle, from the point a to the point b (f, s in metres) at the height z (the top of the band).
 * n is the normal of that face. It shows only when the face looks to the camera. The slogan is the
 * first one in the list that fits; when none fits, the band is a thin line.
 */
function drawSticker(c, st, P, cos, sin) {
  const nx = st.n[0] * cos - st.n[1] * sin, ny = st.n[0] * sin + st.n[1] * cos;
  if (nx + ny <= 0.2) return;
  const t = faceTone(nx, ny);
  let A = P(st.a[0], st.a[1], st.z), B = P(st.b[0], st.b[1], st.z);
  if (A.x > B.x) [A, B] = [B, A]; // the slogan reads from left to right on the screen
  const w = Math.round(B.x - A.x);
  const text = st.slogan.find((s) => textWidth(s) <= w - 2) ?? '';
  const x0 = Math.floor((w - textWidth(text)) / 2);
  const rows = text ? 7 : 2;
  for (let i = 1; i < w - 1; i++) {
    const k = (i + 0.5) / w;
    const x = Math.round(A.x + (B.x - A.x) * k), y = Math.round(A.y + (B.y - A.y) * k);
    for (let r = 0; r < rows; r++) {
      const on = r >= 1 && r <= 5 && text && textBit(text, i - x0, r - 1);
      c.plot(x, y + r, tone(on ? C.cream : st.colour, t));
    }
  }
}

/** Painted words on both sides of a box part (only the side that looks to the camera shows). */
const sideWords = (p, z, colour, slogan) => [
  { a: [p.f0, p.s1], b: [p.f1, p.s1], n: [0, 1], z, colour, slogan },
  { a: [p.f0, p.s0], b: [p.f1, p.s0], n: [0, -1], z, colour, slogan },
];

/** Four wheels. The outer side of each tyre shows a grey hub. */
const wheels = (L, W, r = 0.32, inset = 0.8) => {
  const out = [];
  const tyre = (u, z, face) => ((face === 'left' || face === 'right') && Math.abs(u - 0.5) < 0.24 && Math.abs(z - r) < r * 0.45 ? C.hub : C.tyre);
  for (const f of [L / 2 - inset, -L / 2 + inset]) {
    for (const s of [-W / 2, W / 2 - 0.24]) out.push({ f0: f - r, f1: f + r, s0: s, s1: s + 0.24, z0: 0, z1: 2 * r, top: C.tyre, side: tyre });
  }
  return out;
};
const band = (z, a, b) => z > a && z < b;
const edge = (u, e) => u < e || u > 1 - e;

const BUILD = {
  car: (paint) => {
    const L = 4.2, W = 1.8;
    const body = (u, z, face) => {
      if (face === 'front' || face === 'back') {
        if (z < 0.42) return band(u, 0.38, 0.62) && z > 0.3 ? C.plate : C.bumper; // bumper and number plate
        if (band(z, 0.55, 0.7) && edge(u, 0.2)) return face === 'front' ? C.headlight : C.tailLight;
        if (face === 'front' && band(z, 0.46, 0.62) && band(u, 0.3, 0.7)) return C.bumper; // the grille
        return paint;
      }
      if (z < 0.4) return C.bumper; // the sill
      if (band(z, 0.5, 0.8) && Math.abs(u - 0.47) < 0.012) return C.bumper; // the door line
      if (band(z, 0.6, 0.7) && edge(u, 0.04)) return C.indicator;
      return paint;
    };
    const cabin = (u, z, face) => {
      if (z < 0.82 || z > 1.32) return paint;
      if (face === 'front' || face === 'back') {
        if (edge(u, 0.07)) return paint;
        return face === 'front' && Math.abs(u - 0.3 - (1.3 - z) * 0.6) < 0.06 ? C.glassShine : C.glass;
      }
      return edge(u, 0.06) || Math.abs(u - 0.5) < 0.04 ? paint : C.glass; // two side windows
    };
    return {
      parts: [
        ...wheels(L, W),
        { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.25, z1: 0.8, top: paint, side: body },
        { f0: -1.35, f1: 0.85, s0: -W / 2 + 0.14, s1: W / 2 - 0.14, z0: 0.8, z1: 1.4, top: paint, side: cabin },
        // The side mirrors.
        { f0: 0.75, f1: 0.85, s0: -W / 2 - 0.14, s1: -W / 2, z0: 0.85, z1: 0.95, top: paint, side: paint },
        { f0: 0.75, f1: 0.85, s0: W / 2, s1: W / 2 + 0.14, z0: 0.85, z1: 0.95, top: paint, side: paint },
      ],
    };
  },
  bus: (v) => {
    // A white minibus (the Toyota Hiace kind): a coloured stripe, many side windows, a sliding door.
    const L = 5.0, W = 1.9;
    const body = (u, z, face) => {
      if (band(z, 0.92, 1.08)) return v.stripe;
      if (face === 'front') {
        if (z < 0.42) return band(u, 0.38, 0.62) && z > 0.3 ? C.plate : C.bumper;
        if (band(z, 0.58, 0.74) && edge(u, 0.18)) return C.headlight;
        if (band(z, 0.46, 0.66) && band(u, 0.3, 0.7)) return C.bumper; // the grille
        if (band(z, 1.15, 1.9) && !edge(u, 0.05)) return Math.abs(u - 0.28 - (1.9 - z) * 0.5) < 0.05 ? C.glassShine : C.glass;
        return C.white;
      }
      if (face === 'back') {
        if (z < 0.42) return band(u, 0.38, 0.62) && z > 0.3 ? C.plate : C.bumper;
        if (band(z, 0.6, 0.85) && edge(u, 0.12)) return C.tailLight;
        if (band(z, 1.2, 1.8) && !edge(u, 0.1)) return C.glass;
        return C.white;
      }
      if (z < 0.4) return C.bumper;
      if (band(z, 1.22, 1.78) && !edge(u, 0.04) && (u * 6) % 1 > 0.14) return C.glass; // side windows
      if (Math.abs(u - (face === 'right' ? 0.62 : 0.38)) < 0.01 && z < 1.9) return C.bumper; // the sliding door
      return C.white;
    };
    const roof = (u, w) => (edge(w, 0.08) || (u * 5) % 1 < 0.08 ? C.chrome : C.cream); // the roof rack
    return {
      parts: [
        ...wheels(L, W, 0.32, 0.9),
        { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.25, z1: 2.05, top: roof, side: body },
        { f0: 2.3, f1: 2.4, s0: -W / 2 - 0.16, s1: -W / 2, z0: 1.3, z1: 1.45, top: C.bumper, side: C.bumper },
        { f0: 2.3, f1: 2.4, s0: W / 2, s1: W / 2 + 0.16, z0: 1.3, z1: 1.45, top: C.bumper, side: C.bumper },
      ],
      stickers: [{ a: [L / 2, -W / 2], b: [L / 2, W / 2], n: [1, 0], z: 1.9, colour: v.stripe, slogan: v.slogan }],
    };
  },
  truck: (v) => {
    // A Kigali lorry: a flat cab with a chrome grille, a wooden cargo bed with posts, and a load.
    const L = 7.0, W = 2.4;
    const cab = (u, z, face) => {
      if (face === 'front') {
        if (z < 0.95) return band(u, 0.4, 0.6) && z > 0.82 ? C.plate : C.bumper;
        if (band(z, 1.0, 1.2) && edge(u, 0.14)) return C.headlight;
        if (band(z, 0.98, 1.38) && band(u, 0.25, 0.75)) return Math.floor(z * 30) % 2 ? C.chrome : C.bumper; // the grille
        if (band(z, 1.45, 2.3) && !edge(u, 0.05)) return C.glass;
        return v.cab;
      }
      const front = face === 'left' ? u < 0.6 : u > 0.4;
      if (band(z, 1.5, 2.2) && front && !edge(u, 0.06)) return C.glass; // the door window
      if (z < 1.0 && band(u, 0.3, 0.7)) return C.bumper; // the step
      return v.cab;
    };
    const slats = (u, z, face) => {
      if (face === 'back' && band(z, 0.86, 1.0) && edge(u, 0.12)) return C.tailLight;
      if ((face === 'left' || face === 'right') && (u * 5) % 1 < 0.06) return C.woodDark; // the posts
      return Math.floor(z * 8) % 2 ? C.wood : C.woodDark;
    };
    const loads = {
      // White rice sacks with a blue stripe, in rows; grey seams between the sacks.
      sacks: { side: (u) => ((u * 7) % 1 < 0.12 ? C.silver : Math.abs((u * 7) % 1 - 0.56) < 0.08 ? C.blue : C.sack), top: (u, w) => ((u * 7) % 1 < 0.12 || (w * 3) % 1 < 0.1 ? C.silver : Math.abs((w * 3) % 1 - 0.55) < 0.07 ? C.blue : C.sack) },
      bananas: { side: (u, z) => (Math.floor(u * 9) + Math.floor(z * 6)) % 3 ? C.banana : C.bananaDark, top: (u, w) => ((Math.floor(u * 9) + Math.floor(w * 4)) % 3 ? C.banana : C.bananaDark) },
      tarp: { side: (u, z) => (Math.floor(z * 6) % 2 ? C.tarp : C.green), top: (u) => (Math.floor(u * 6) % 2 ? C.tarp : C.green) },
    };
    const load = loads[v.load] ?? loads.tarp;
    const bed = { f0: -L / 2, f1: 1.8, s0: -W / 2, s1: W / 2, z0: 0.82, z1: 1.75, top: C.woodDark, side: slats };
    return {
      parts: [
        ...wheels(L, W, 0.44, 1.1),
        { f0: -L / 2, f1: L / 2, s0: -W / 2 + 0.15, s1: W / 2 - 0.15, z0: 0.5, z1: 0.82, top: C.bumper, side: C.bumper },
        { f0: 1.95, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.82, z1: 2.5, top: v.cab, side: cab },
        bed,
        { f0: -L / 2 + 0.2, f1: 1.6, s0: -W / 2 + 0.15, s1: W / 2 - 0.15, z0: 1.75, z1: 2.15, top: load.top, side: load.side },
        { f0: 3.4, f1: 3.5, s0: -W / 2 - 0.18, s1: -W / 2, z0: 1.6, z1: 1.9, top: C.bumper, side: C.bumper },
        { f0: 3.4, f1: 3.5, s0: W / 2, s1: W / 2 + 0.18, z0: 1.6, z1: 1.9, top: C.bumper, side: C.bumper },
      ],
      stickers: [
        { a: [L / 2, -W / 2], b: [L / 2, W / 2], n: [1, 0], z: 2.3, colour: C.kBlue, slogan: v.slogan.slice(1) },
        ...sideWords(bed, 1.66, v.cab, v.slogan), // the long slogan is painted on the side boards
      ],
    };
  },
};

/** Other moto riders, with or without a passenger. */
export function drawRivalMoto(frame, load = 'none') {
  return drawBike('rival', frame, load);
}

// ---------------------------------------------------------------------------
// People: a 3/4 view that looks to the right, towards the camera (facing 0) or away from it
// (facing 1), 2 walk frames, and the same frames to the left (drawn again, not flipped, so that the
// light stays on the top left). The light rule and the ink outline come from finishFigure().
// ---------------------------------------------------------------------------
export const PERSON_CANVAS = { width: 14, height: 30, groundX: 7, groundY: 28 };
// Looks of the walkers. The last four are mamas in kitenge (a bright printed wrap dress) and a
// head wrap; two of them carry a basket of goods on the head.
export const PERSON_LOOKS = [
  { shirt: C.red, legs: C.navy, skin: C.skin },
  { shirt: C.green, legs: C.charcoal, skin: C.skinDeep },
  { shirt: C.orange, legs: C.navy, skin: C.skinLight },
  { shirt: C.purple, legs: C.mud, skin: C.skinDeep, dress: true },
  { shirt: C.cloth, legs: C.charcoal, skin: C.skin },
  { shirt: C.blue, legs: C.mud, skin: C.skinLight },
  { kitenge: 0, skin: C.skin },
  { kitenge: 2, skin: C.skinDeep, basket: 'bananas' },
  { kitenge: 4, skin: C.skinLight },
  { kitenge: 5, skin: C.skinDeep, basket: 'tomatoes' },
];

/** A head in 3/4 view. facing 0: the face shows on the right (an eye); 1: the back of the head (hair). */
function drawHead(c, x, y, skin, facing) {
  c.fillDisc(x, y, 2.5, facing === 1 ? C.hair : skin);
  for (let dx = -2; dx <= 2; dx++) c.plot(x + dx, y - 2, C.hair); // short hair on top
  if (facing === 1) c.plot(x + 2, y, skin); // the ear and the cheek
  else {
    c.plot(x - 2, y - 1, C.hair); // hair at the back of the head
    c.plot(x + 1, y - 0.5, C.hair); // the eye
  }
}

/** A mama in kitenge: the dress, the arms, the head with a head wrap and maybe a basket on it. */
function drawMama(c, look, gx, gy, facing, step, armUp) {
  const k = KITENGE[look.kitenge % KITENGE.length];
  const swing = step ? 1 : -1;
  c.line(gx - 1 + swing, gy - 1, gx - 1 + swing, gy - 2, 1.6, C.shoe); // feet under the hem
  c.line(gx + 1 - swing, gy - 1, gx + 1 - swing, gy - 2, 1.6, C.shoe);
  c.line(gx - 2.5, gy - 14, gx - 2.5 - swing * 0.8, gy - 9, 1.6, look.skin); // the back arm
  drawKitengeDress(c, gx, gy - 15, gy - 3, 2.3, k, look.kitenge);
  if (armUp) c.line(gx + 2.5, gy - 14, gx + 4.5, gy - 21, 1.6, look.skin);
  else c.line(gx + 2.5, gy - 14, gx + 2.5 + swing * 0.8, gy - 9, 1.6, look.skin);
  drawHead(c, gx + 0.5, gy - 18.5, look.skin, facing);
  drawHeadWrap(c, gx + 0.5, gy - 18.5, 2.5, k);
  if (look.basket) {
    // A woven basket on the head, full of goods.
    for (let x = -4; x <= 4; x++) for (let y = 0; y <= 2; y++) c.plot(gx + 0.5 + x, gy - 23 + y, (x + y) % 2 ? C.basketDark : C.basket);
    const goods = look.basket === 'bananas' ? [C.banana, C.bananaDark] : [C.tomato, C.red];
    for (let x = -3; x <= 3; x += 1.5) c.fillDisc(gx + 0.5 + x, gy - 24.5, 1.1, goods[Math.round(x + 4) % 2]);
  }
}

/** The body of a man or a woman in a shirt (or a dress): legs with a long step, arms that swing. */
function drawBody(c, look, gx, gy, facing, step, armUp = false) {
  const sw = step ? 1 : -1; // which leg is in front
  const hip = gy - 9;
  // The back leg and the back arm first, then the body, then the front leg and the front arm.
  c.line(gx - 0.5, hip, gx - 2 * sw, gy - 2, 2, look.legs);
  c.plot(gx - 2 * sw, gy - 1, C.shoe);
  c.plot(gx - 2 * sw + 1, gy - 1, C.shoe);
  c.line(gx - 1.5, gy - 14, gx - 1.5 + 2 * sw, gy - 10, 1.6, look.skin);
  c.line(gx + 0.5, hip, gx + 2 * sw, gy - 2, 2, look.legs);
  c.plot(gx + 2 * sw, gy - 1, C.shoe);
  c.plot(gx + 2 * sw + 1, gy - 1, C.shoe);
  for (let y = gy - 15; y <= hip; y++) for (let x = gx - 2; x <= gx + 2; x++) c.plot(x, y, look.shirt);
  if (look.dress) for (let y = hip; y <= gy - 5; y++) for (let x = gx - 2 - (y - hip) * 0.4; x <= gx + 2 + (y - hip) * 0.4; x++) c.plot(x, y, look.shirt);
  if (armUp) {
    c.line(gx + 1.5, gy - 14, gx + 4, gy - 21, 1.6, look.skin);
    c.plot(gx + 2, gy - 14, look.shirt); // the sleeve
  } else {
    c.line(gx + 1.5, gy - 14, gx + 1.5 - 2 * sw, gy - 10, 1.6, look.skin);
    c.plot(gx + 1.5, gy - 14, look.shirt);
  }
  c.plot(gx + 0.5, gy - 16, look.skin); // the neck
  drawHead(c, gx + 0.5, gy - 18.5, look.skin, facing);
}

/** A walking person. facing: 0 = towards the camera, 1 = away. step: 0 or 1. left: look to the left. */
export function drawPerson(look, facing, step, left = false) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  if (look.kitenge !== undefined) drawMama(c, look, gx, gy, facing, step, false);
  else drawBody(c, look, gx, gy, facing, step);
  return finishFigure(c, left);
}

/** A customer who waves for a moto, with one arm up. */
export function drawWaver(look, left = false) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  if (look.kitenge !== undefined) drawMama(c, look, gx, gy, 0, 0, true);
  else drawBody(c, look, gx, gy, 0, 0, true);
  return finishFigure(c, left);
}

// ---------------------------------------------------------------------------
// Cyclists: slow traffic at the road edge. Variant 0: a rider; 1: a rice sack on the rack;
// 2: a bunch of bananas on the rack (bicycles carry a lot of goods in Kigali).
// ---------------------------------------------------------------------------
const CYCLIST_SHIRTS = [0xc0392b, 0x3f8f4a, 0x2f6fb0];
const CYCLIST_SCALE = 1.25;

export function drawCyclist(variant, frame) {
  const heading = (frame / BIKE_DIRECTIONS) * Math.PI * 2;
  const c = new PixelCanvas(BIKE_CANVAS.width, BIKE_CANVAS.height, -BIKE_CANVAS.groundX, -BIKE_CANVAS.groundY);
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const P = (f, s, z) => {
    f *= CYCLIST_SCALE; s *= CYCLIST_SCALE; z *= CYCLIST_SCALE;
    const dx = f * cos - s * sin, dy = f * sin + s * cos;
    const p = toScreen(dx, dy, z);
    return { x: p.x, y: p.y, depth: dx + dy };
  };
  const parts = [];
  const seg = (a, b, thick, col, bias = 0) => {
    const pa = P(...a), pb = P(...b);
    parts.push({ depth: (pa.depth + pb.depth) / 2 + bias, draw: () => c.line(pa.x, pa.y, pb.x, pb.y, thick, col) });
  };
  const blob = (p, r, col, bias = 0) => {
    const pp = P(...p);
    parts.push({ depth: pp.depth + bias, draw: () => c.fillDisc(pp.x, pp.y, r, col) });
  };
  const wheel = (fc) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(P(fc + 0.33 * Math.cos(a), 0, 0.33 + 0.33 * Math.sin(a)));
    }
    parts.push({ depth: P(fc, 0, 0.33).depth - 0.01, draw: () => { for (let i = 0; i < 16; i++) c.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 1, 0x1e1e1e); } });
  };
  const shirt = CYCLIST_SHIRTS[variant % CYCLIST_SHIRTS.length];
  wheel(-0.52);
  wheel(0.52);
  seg([-0.52, 0, 0.33], [-0.05, 0, 0.75], 1, 0x5a6a7a); // frame
  seg([-0.05, 0, 0.75], [0.48, 0, 0.8], 1, 0x5a6a7a);
  seg([0.52, 0, 0.33], [0.45, 0, 0.92], 1, 0x8a8a8a); // fork
  seg([-0.6, 0, 0.72], [-0.2, 0, 0.72], 1.4, 0x4a4a4a); // rack
  for (const side of [-1, 1]) {
    seg([-0.12, 0.1 * side, 0.85], [0.1, 0.16 * side, 0.6], 2.2, 0x2a3550); // thigh
    seg([0.1, 0.16 * side, 0.6], [0.02, 0.16 * side, 0.32], 2, 0x2a3550); // shin
    seg([0.02, 0.15 * side, 1.3], [0.42, 0.24 * side, 0.94], 1.8, 0x6b4226); // arm
  }
  seg([-0.12, 0, 0.88], [0.04, 0, 1.34], 4, shirt, 0.02); // torso
  blob([0.06, 0, 1.56], 2.2, 0x1a1a1a, 0.03); // head (no helmet)
  if (variant === 1) {
    seg([-0.6, 0, 0.86], [-0.24, 0, 0.86], 6, 0xe6e0cc, -0.02); // rice sack
    seg([-0.56, 0, 0.88], [-0.28, 0, 0.88], 1.6, 0x2f6fb0, -0.015);
  } else if (variant === 2) {
    let i = 0;
    for (let z = 0.8; z <= 1.2; z += 0.12) for (const sd of [-0.14, 0.14]) blob([-0.42, sd, z], 2 - (z - 0.8), [0x5f9a32, 0x4f8a2a, 0x76b23e][i++ % 3], -0.02);
  }
  parts.sort((a, b) => a.depth - b.depth);
  for (const p of parts) p.draw();
  c.outline(0x161616);
  return c;
}
