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
// Each variant: the paint (car), the roof rack (bus) or the cab colour (truck). Trucks carry a
// tagline on the windscreen and on the side boards, as in Kigali, and a load: sacks, bananas or a tarpaulin.
export const VEHICLE_VARIANTS = {
  // Small cars (Alp): mostly old Toyotas, a white NGO Land Cruiser, a few new electric cars. people: who
  // you see inside (1 = the driver only).
  car: [
    { model: 'corolla', paint: C.white, people: 3, rust: true },
    { model: 'corolla', paint: C.silver, people: 2 },
    { model: 'corolla', paint: C.carBlue, people: 1 },
    { model: 'starlet', paint: C.carRed, people: 2, rust: true },
    { model: 'starlet', paint: C.paintSky, people: 1 },
    { model: 'probox', paint: C.white, people: 1, rack: true },
    { model: 'probox', paint: C.silver, people: 2, rack: true },
    { model: 'rav4', paint: C.silver, people: 4, spare: true },
    { model: 'rav4', paint: C.carGreen, people: 3, spare: true },
    { model: 'cruiser', paint: C.policeWhite, people: 3, snorkel: true, antenna: true },
    { model: 'ev', paint: C.white, people: 1, ev: true },
    { model: 'ev', paint: C.slate, people: 2, ev: true },
  ],
  pickup: [
    { paint: C.white, load: 'bananas', riders: 2, cab: 2, rust: true },
    { paint: C.carRed, load: 'sacks', riders: 1, cab: 1, rust: true },
    { paint: C.silver, load: 'charcoal', riders: 0, cab: 2 },
    { paint: C.cabBlue, load: 'people', riders: 4, cab: 2 },
  ],
  lorry: [
    { cab: C.cabBlue, load: 'sacks', rider: true, slogan: ['IMANA IRATABARA', 'IMANA', 'AMEN'] },
    { cab: C.white, load: 'charcoal', rider: false, slogan: ['GOD IS ABLE', 'AMEN'] },
    { cab: C.cabGreen, load: 'sacks', rider: true, slogan: ['NTA KIBAZO', 'HOZA'] },
  ],
  tipper: [{ cab: C.kGold }, { cab: C.carRed }],
  // Buses are plain white government buses (Alp); one kind has a roof rack.
  bus: [{ rack: false }, { rack: true }],
  // A police patrol car: white, a blue stripe, a light bar (two frames: the red and the blue lamp swap).
  police: [{ flash: 0 }, { flash: 1 }],
  // A VIP convoy car: a big black car with dark glass.
  vip: [{}],
  truck: [
    // Taglines from Alp; the first one that fits is painted (long ones on the side boards).
    { cab: C.carRed, load: 'sacks', slogan: ['GOD IS WIN', 'GOD IS KING', 'IMANA'] },
    { cab: C.cabBlue, load: 'bananas', slogan: ['JESUS SAVE ME', 'GOD IS KING', 'AMEN'] },
    { cab: C.cabGreen, load: 'tarp', slogan: ['JESUS TAKE THE WHEEL', 'JESUS SAVE ME', 'GOD IS WIN', 'HOZA'] },
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

// Car models (Alp, 14 October 2026: old Toyotas and a few new electric cars). L, W: metres; body: the
// top of the body; cab: the cabin from f0 to f1 (forward is +), its roof at top.
const CAR_MODELS = {
  corolla: { L: 4.4, W: 1.72, body: 0.8, cab: [-1.35, 0.75], top: 1.4 }, // a saloon with a boot
  starlet: { L: 3.8, W: 1.66, body: 0.78, cab: [-1.6, 0.5], top: 1.42 }, // a small hatchback
  probox: { L: 4.2, W: 1.7, body: 0.8, cab: [-1.95, 0.7], top: 1.46 }, // the work wagon
  rav4: { L: 4.1, W: 1.76, body: 0.95, cab: [-1.85, 0.85], top: 1.66 }, // a boxy SUV
  cruiser: { L: 4.8, W: 1.9, body: 1.05, cab: [-2.25, 0.9], top: 1.92 }, // the big white NGO car
  ev: { L: 4.4, W: 1.8, body: 0.85, cab: [-1.55, 0.95], top: 1.5 }, // a new electric car
};
const HEADS = [C.skin, C.skinDeep, C.skinLight];

/**
 * The cabin of a car or a pickup: glass all round, with the heads of the people inside. people: 1 =
 * the driver (on the left: Rwanda drives on the right), 2 = and the front passenger, 3 and 4 = and the
 * back seats. z0, top: the bottom and the roof of the cabin.
 */
function cabinSide(paint, z0, top, people, skin) {
  const g0 = z0 + 0.03, g1 = top - 0.08;
  const headZ = z0 + 0.32;
  const head = (u, z, at) => Math.abs(u - at) < 0.07 && z > headZ - 0.13 && z < headZ + 0.14 ? (z > headZ + 0.08 ? C.hair : skin) : null;
  return (u, z, face) => {
    if (z < g0 || z > g1) return paint;
    if (face === 'front' || face === 'back') {
      if (edge(u, 0.07)) return paint;
      const seats = face === 'front' ? [[0.7, 1], [0.3, 2]] : [[0.3, 3], [0.7, 4]];
      for (const [at, n] of seats) if (people >= n) { const h = head(u, z, at); if (h) return h; }
      return face === 'front' && Math.abs(u - 0.3 - (g1 - z) * 0.6) < 0.06 ? C.glassShine : C.glass;
    }
    if (edge(u, 0.06) || Math.abs(u - 0.5) < 0.04) return paint; // the pillars between the side windows
    // The left side shows the driver and the back-left seat; the right side the front passenger and the back-right seat.
    const front = face === 'left' ? 0.28 : 0.72, back = face === 'left' ? 0.74 : 0.26;
    const [nf, nb] = face === 'left' ? [1, 3] : [2, 4];
    if (people >= nf) { const h = head(u, z, front); if (h) return h; }
    if (people >= nb) { const h = head(u, z, back); if (h) return h; }
    return C.glass;
  };
}

/** A person who sits in the open back of a pickup or on a load: a shirt box and a head box. */
const sitter = (f, s, z, shirt, skin) => [
  { f0: f - 0.17, f1: f + 0.17, s0: s - 0.18, s1: s + 0.18, z0: z, z1: z + 0.45, top: shirt, side: shirt },
  { f0: f - 0.12, f1: f + 0.12, s0: s - 0.12, s1: s + 0.12, z0: z + 0.45, z1: z + 0.7, top: C.hair, side: (u, zz) => (zz > z + 0.63 ? C.hair : skin) },
];

const BUILD = {
  car: (v) => {
    const m = CAR_MODELS[v.model ?? 'corolla'];
    const paint = v.paint, L = m.L, W = m.W;
    const body = (u, z, face) => {
      if (face === 'front' || face === 'back') {
        if (z < 0.42) return band(u, 0.38, 0.62) && z > 0.3 ? C.plate : C.bumper; // bumper and number plate
        if (band(z, 0.55, 0.7) && edge(u, 0.2)) return face === 'front' ? C.headlight : C.tailLight;
        if (face === 'front' && !v.ev && band(z, 0.46, 0.62) && band(u, 0.3, 0.7)) return C.bumper; // the grille (an electric car has none)
        if (face === 'back' && v.spare && band(z, 0.5, 0.95) && band(u, 0.32, 0.68)) return Math.abs(u - 0.5) < 0.06 && Math.abs(z - 0.72) < 0.06 ? C.hub : C.tyre; // the spare wheel
        return paint;
      }
      if (z < 0.4) return v.rust && (u * 9) % 1 < 0.3 ? C.tinRust : C.bumper; // the sill (rust on an old car)
      if (band(z, 0.5, m.body) && Math.abs(u - 0.47) < 0.012) return C.bumper; // the door line
      if (band(z, 0.6, 0.7) && edge(u, 0.04)) return C.indicator;
      if (v.ev && band(z, 0.56, 0.66) && Math.abs(u - (face === 'left' ? 0.12 : 0.88)) < 0.04) return C.green; // the green EV mark
      return paint;
    };
    const skin = HEADS[(v.people * 7 + (v.model?.length ?? 0)) % HEADS.length];
    const parts = [
      ...wheels(L, W, m.body > 0.9 ? 0.36 : 0.32, 0.8),
      { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.25, z1: m.body, top: paint, side: body },
      { f0: m.cab[0], f1: m.cab[1], s0: -W / 2 + 0.14, s1: W / 2 - 0.14, z0: m.body, z1: m.top, top: paint, side: cabinSide(paint, m.body, m.top, v.people ?? 1, skin) },
      // The side mirrors.
      { f0: m.cab[1] - 0.1, f1: m.cab[1], s0: -W / 2 - 0.14, s1: -W / 2, z0: m.body + 0.05, z1: m.body + 0.15, top: paint, side: paint },
      { f0: m.cab[1] - 0.1, f1: m.cab[1], s0: W / 2, s1: W / 2 + 0.14, z0: m.body + 0.05, z1: m.body + 0.15, top: paint, side: paint },
    ];
    if (v.rack) {
      // A roof rack with a load: sacks, boxes, a jerrycan.
      const r0 = m.cab[0] + 0.2, r1 = m.cab[1] - 0.25;
      parts.push({ f0: r0, f1: r1, s0: -W / 2 + 0.2, s1: W / 2 - 0.2, z0: m.top, z1: m.top + 0.06, top: C.bumper, side: C.bumper });
      parts.push({ f0: r0 + 0.1, f1: r0 + 0.9, s0: -0.5, s1: 0.4, z0: m.top + 0.06, z1: m.top + 0.36, top: C.sack, side: C.sack });
      parts.push({ f0: r0 + 1.0, f1: r0 + 1.5, s0: -0.3, s1: 0.5, z0: m.top + 0.06, z1: m.top + 0.3, top: C.woodDark, side: C.wood });
      if (r1 - r0 > 1.9) parts.push({ f0: r0 + 1.6, f1: r0 + 1.9, s0: -0.4, s1: -0.1, z0: m.top + 0.06, z1: m.top + 0.42, top: C.kOrange, side: C.kOrange });
    }
    if (v.snorkel) parts.push({ f0: m.cab[1] - 0.12, f1: m.cab[1] - 0.02, s0: W / 2, s1: W / 2 + 0.1, z0: m.body - 0.25, z1: m.top + 0.05, top: C.bumper, side: C.bumper });
    if (v.antenna) parts.push({ f0: L / 2 - 0.35, f1: L / 2 - 0.3, s0: -W / 2 + 0.1, s1: -W / 2 + 0.15, z0: m.body, z1: m.body + 0.9, top: C.bumper, side: C.bumper });
    return { parts };
  },
  // An old pickup: a cab, an open back with a load, and people who ride in the back.
  pickup: (v) => {
    const L = 4.9, W = 1.76, top = 1.52, z0 = 0.82;
    const body = (u, z, face) => {
      if (face === 'front' || face === 'back') {
        if (z < 0.42) return band(u, 0.38, 0.62) && z > 0.3 ? C.plate : C.bumper;
        if (band(z, 0.55, 0.7) && edge(u, 0.18)) return face === 'front' ? C.headlight : C.tailLight;
        if (face === 'front' && band(z, 0.46, 0.66) && band(u, 0.28, 0.72)) return (Math.floor(z * 30) % 2 ? C.chrome : C.bumper); // the grille
        return v.paint;
      }
      if (z < 0.42) return v.rust && (u * 8) % 1 < 0.3 ? C.tinRust : C.bumper;
      return v.paint;
    };
    const skin = HEADS[(v.riders ?? 0) % HEADS.length];
    const loads = {
      bananas: { side: (u, z) => ((Math.floor(u * 8) + Math.floor(z * 7)) % 3 ? C.banana : C.bananaDark), top: (u, w) => ((Math.floor(u * 8) + Math.floor(w * 4)) % 3 ? C.banana : C.bananaDark), h: 0.42 },
      sacks: { side: (u) => ((u * 5) % 1 < 0.14 ? C.silver : C.sack), top: (u, w) => ((u * 5) % 1 < 0.14 || (w * 2) % 1 < 0.12 ? C.silver : C.sack), h: 0.38 },
      charcoal: { side: (u, z) => ((u * 5) % 1 < 0.12 ? C.charcoal : z > z0 + 0.3 ? C.charcoal : C.sack), top: C.charcoal, h: 0.45 },
      people: null,
    };
    const load = loads[v.load];
    const parts = [
      ...wheels(L, W, 0.36, 0.85),
      { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.3, z1: z0, top: (u) => (u < 0.53 ? C.bumper : v.paint), side: body },
      { f0: 0.0, f1: 1.25, s0: -W / 2 + 0.06, s1: W / 2 - 0.06, z0, z1: top, top: v.paint, side: cabinSide(v.paint, z0, top, v.cab ?? 2, skin) },
      // The sides and the tailgate of the open back.
      { f0: -L / 2, f1: -0.05, s0: -W / 2, s1: -W / 2 + 0.07, z0, z1: z0 + 0.3, top: v.paint, side: v.paint },
      { f0: -L / 2, f1: -0.05, s0: W / 2 - 0.07, s1: W / 2, z0, z1: z0 + 0.3, top: v.paint, side: v.paint },
      { f0: -L / 2, f1: -L / 2 + 0.07, s0: -W / 2, s1: W / 2, z0, z1: z0 + 0.3, top: v.paint, side: (u, z, face) => (face === 'back' && band(z, z0 + 0.08, z0 + 0.2) && edge(u, 0.12) ? C.tailLight : v.paint) },
    ];
    if (load) parts.push({ f0: -L / 2 + 0.15, f1: -0.25, s0: -W / 2 + 0.12, s1: W / 2 - 0.12, z0, z1: z0 + load.h, top: load.top, side: load.side });
    const shirts = [C.blue, C.kOrange, C.red, C.green];
    for (let i = 0; i < (v.riders ?? 0); i++) parts.push(...sitter(-0.7 - Math.floor(i / 2) * 0.9, i % 2 ? 0.42 : -0.42, load ? z0 + load.h - 0.05 : z0, shirts[i % shirts.length], HEADS[(i + 1) % HEADS.length]));
    return { parts };
  },
  // A short truck (Canter, Elf): a flat cab, wooden sides, sacks piled high, a loader on top.
  lorry: (v) => {
    const L = 5.6, W = 2.04, cab0 = 1.5, cz0 = 0.75, cz1 = 2.3, bz1 = 1.5;
    const cab = (u, z, face) => {
      if (face === 'front') {
        if (z < 0.9) return band(u, 0.4, 0.6) && z > 0.78 ? C.plate : C.bumper;
        if (band(z, 0.95, 1.12) && edge(u, 0.14)) return C.headlight;
        if (band(z, 0.92, 1.25) && band(u, 0.28, 0.72)) return Math.floor(z * 30) % 2 ? C.chrome : C.bumper;
        if (band(z, 1.4, 2.12) && !edge(u, 0.06)) { if (Math.abs(u - 0.7) < 0.08 && band(z, 1.5, 1.8)) return z > 1.72 ? C.hair : C.skin; return C.glass; }
        return v.cab;
      }
      const front = face === 'left' ? u < 0.62 : u > 0.38;
      if (band(z, 1.45, 2.1) && front && !edge(u, 0.07)) return C.glass;
      if (z < 0.95 && band(u, 0.3, 0.7)) return C.bumper;
      return v.cab;
    };
    const slats = (u, z, face) => {
      if (face === 'back' && band(z, 0.8, 0.95) && edge(u, 0.12)) return C.tailLight;
      if ((face === 'left' || face === 'right') && (u * 4) % 1 < 0.06) return C.woodDark;
      return Math.floor(z * 8) % 2 ? C.wood : C.woodDark;
    };
    const sacks = { side: (u, z) => ((u * 6) % 1 < 0.12 || Math.floor(z * 3.4) !== Math.floor((z + 0.04) * 3.4) ? C.silver : v.load === 'charcoal' && z > 1.9 ? C.charcoal : C.sack), top: (u, w) => ((u * 6) % 1 < 0.12 || (w * 3) % 1 < 0.1 ? C.silver : v.load === 'charcoal' ? C.charcoal : C.sack) };
    const bed = { f0: -L / 2, f1: cab0 - 0.12, s0: -W / 2, s1: W / 2, z0: cz0, z1: bz1, top: C.woodDark, side: slats };
    const parts = [
      ...wheels(L, W, 0.4, 1.0),
      { f0: -L / 2, f1: L / 2, s0: -W / 2 + 0.15, s1: W / 2 - 0.15, z0: 0.45, z1: cz0, top: C.bumper, side: C.bumper },
      { f0: cab0, f1: L / 2, s0: -W / 2, s1: W / 2, z0: cz0, z1: cz1, top: v.cab, side: cab },
      bed,
      { f0: -L / 2 + 0.15, f1: cab0 - 0.3, s0: -W / 2 + 0.12, s1: W / 2 - 0.12, z0: bz1, z1: 2.3, top: sacks.top, side: sacks.side },
    ];
    if (v.rider) parts.push(...sitter(-0.9, 0.2, 2.3, C.kOrange, C.skinDeep));
    return { parts, stickers: v.slogan ? sideWords(bed, 1.42, v.cab, v.slogan) : [] };
  },
  // A big old tipper truck with sand or murram for the building sites.
  tipper: (v) => {
    const L = 8.0, W = 2.5, cab0 = 2.55, cz0 = 0.95, cz1 = 2.95, bz0 = 0.95, bz1 = 2.35;
    const cab = (u, z, face) => {
      if (face === 'front') {
        if (z < 1.15) return band(u, 0.4, 0.6) && z > 1.0 ? C.plate : C.bumper;
        if (band(z, 1.2, 1.4) && edge(u, 0.14)) return C.headlight;
        if (band(z, 1.18, 1.65) && band(u, 0.25, 0.75)) return Math.floor(z * 30) % 2 ? C.chrome : C.bumper;
        if (band(z, 1.85, 2.7) && !edge(u, 0.05)) { if (Math.abs(u - 0.7) < 0.07 && band(z, 2.0, 2.35)) return z > 2.27 ? C.hair : C.skin; return C.glass; }
        return v.cab;
      }
      const front = face === 'left' ? u < 0.6 : u > 0.4;
      if (band(z, 1.95, 2.7) && front && !edge(u, 0.06)) return C.glass;
      if (z < 1.2 && band(u, 0.3, 0.7)) return C.bumper;
      return v.cab;
    };
    const bin = (u, z, face) => {
      if (face === 'back' && band(z, 1.0, 1.15) && edge(u, 0.1)) return C.tailLight;
      if ((face === 'left' || face === 'right') && (u * 7) % 1 < 0.1) return C.slate; // the ribs of the steel bin
      return C.charcoal;
    };
    const sand = { side: (u, z) => ((Math.floor(u * 12) + Math.floor(z * 10)) % 4 ? C.mudLight : C.mudWall), top: (u, w) => ((Math.floor(u * 12) + Math.floor(w * 5)) % 4 ? C.mudLight : C.mudWall) };
    const rear = wheels(L, W, 0.5, 1.25).filter((p) => p.f0 < 0).map((p) => ({ ...p, f0: p.f0 + 1.15, f1: p.f1 + 1.15 }));
    return {
      parts: [
        ...wheels(L, W, 0.5, 1.25), ...rear,
        { f0: -L / 2, f1: L / 2, s0: -W / 2 + 0.2, s1: W / 2 - 0.2, z0: 0.6, z1: bz0, top: C.bumper, side: C.bumper },
        { f0: cab0, f1: L / 2, s0: -W / 2, s1: W / 2, z0: cz0, z1: cz1, top: v.cab, side: cab },
        { f0: -L / 2, f1: cab0 - 0.15, s0: -W / 2, s1: W / 2, z0: bz0, z1: bz1, top: C.charcoal, side: bin },
        { f0: -L / 2 + 0.3, f1: cab0 - 0.45, s0: -W / 2 + 0.2, s1: W / 2 - 0.2, z0: bz1, z1: bz1 + 0.3, top: sand.top, side: sand.side },
        { f0: L / 2 - 0.15, f1: L / 2 - 0.05, s0: -W / 2 - 0.18, s1: -W / 2, z0: 1.9, z1: 2.25, top: C.bumper, side: C.bumper },
        { f0: L / 2 - 0.15, f1: L / 2 - 0.05, s0: W / 2, s1: W / 2 + 0.18, z0: 1.9, z1: 2.25, top: C.bumper, side: C.bumper },
      ],
    };
  },
  police: (v) => {
    // A white car with a blue stripe on the sides and POLICE, and a red and blue light bar on the roof.
    const car = BUILD.car({ model: 'corolla', paint: C.policeWhite, people: 2 });
    const stripe = (side) => (u, z, face) => (face !== 'front' && face !== 'back' && band(z, 0.48, 0.64) ? C.uniform : side(u, z, face));
    const body = car.parts.find((p) => p.z0 === 0.25 && p.z1 === 0.8);
    body.side = stripe(body.side);
    const [a, b] = v.flash ? [C.red, C.blue] : [C.blue, C.red];
    car.parts.push(
      { f0: -0.35, f1: 0.05, s0: -0.6, s1: 0, z0: 1.4, z1: 1.55, top: a, side: a },
      { f0: -0.35, f1: 0.05, s0: 0, s1: 0.6, z0: 1.4, z1: 1.55, top: b, side: b },
    );
    return car;
  },
  vip: () => {
    const car = BUILD.car({ model: 'corolla', paint: C.charcoal, people: 0 });
    for (const p of car.parts) { p.f0 *= 1.12; p.f1 *= 1.12; } // a little longer than a car
    return car;
  },
  bus: (v) => {
    // A plain white minibus: many side windows, a sliding door, maybe a roof rack.
    const L = 5.0, W = 1.9;
    const body = (u, z, face) => {
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
    const roof = (u, w) => (v.rack && (edge(w, 0.08) || (u * 5) % 1 < 0.08) ? C.chrome : C.cream); // the roof rack
    return {
      parts: [
        ...wheels(L, W, 0.32, 0.9),
        { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.25, z1: 2.05, top: roof, side: body },
        { f0: 2.3, f1: 2.4, s0: -W / 2 - 0.16, s1: -W / 2, z0: 1.3, z1: 1.45, top: C.bumper, side: C.bumper },
        { f0: 2.3, f1: 2.4, s0: W / 2, s1: W / 2 + 0.16, z0: 1.3, z1: 1.45, top: C.bumper, side: C.bumper },
      ],
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

/** Ampersand riders on red Alphas (the yellow helmet), with or without a passenger. */
export function drawAmpMoto(frame, load = 'none') {
  return drawBike('amp', frame, load);
}

/** Your hired riders on your electric motos (a blue helmet), with or without a passenger. */
export function drawFleetMoto(frame, load = 'none') {
  return drawBike('fleet', frame, load);
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
