import { toScreen } from './iso.js';
import { PixelCanvas, shadeColour } from './pixel-canvas.js';
import { drawBike, BIKE_DIRECTIONS, BIKE_CANVAS } from './sprites.js';

// Traffic sprites made in code: cars, minibuses, trucks (boxes turned to 16 directions) and
// other motos (the bike drawing with rival colours). People: walkers in 4 directions.

export const VEHICLE_CANVAS = { width: 112, height: 88, groundX: 56, groundY: 60 };
export const VEHICLE_VARIANTS = {
  car: [0xe8e8e4, 0xa9adb3, 0xb83a2e, 0x2e4a7a],
  bus: [0x2f5d9a, 0x3f8f4a], // stripe colour on a white minibus
  truck: [0xb83a2e, 0x2e5a9a], // cab colour
};
const GLASS = 0x2c3e4c;
const TYRE = 0x1b1b1b;

/** Draw a vehicle (car, bus or truck) for one of 16 directions. */
export function drawVehicle(kind, variant, frame) {
  const heading = (frame / BIKE_DIRECTIONS) * Math.PI * 2;
  const c = new PixelCanvas(VEHICLE_CANVAS.width, VEHICLE_CANVAS.height, -VEHICLE_CANVAS.groundX, -VEHICLE_CANVAS.groundY);
  const parts = PARTS[kind](VEHICLE_VARIANTS[kind][variant]);
  const cos = Math.cos(heading), sin = Math.sin(heading);
  const P = (f, s, z) => {
    const dx = f * cos - s * sin, dy = f * sin + s * cos;
    return { ...toScreen(dx, dy, z), dx, dy };
  };
  // Lower parts first, then back to front.
  const depthOf = (p) => { const m = P((p.f0 + p.f1) / 2, (p.s0 + p.s1) / 2, 0); return m.dx + m.dy; };
  parts.sort((a, b) => a.z0 - b.z0 || depthOf(a) - depthOf(b));
  for (const part of parts) drawPart(c, part, P, cos, sin);
  c.outline(0x161616);
  return c;
}

/** One box of a vehicle: f (forward), s (side), z (up) ranges in metres. side(u, z, face) gives a colour. */
function drawPart(c, p, P, cos, sin) {
  const faces = [
    { n: [1, 0], a: [p.f1, p.s0], b: [p.f1, p.s1], name: 'front' },
    { n: [-1, 0], a: [p.f0, p.s1], b: [p.f0, p.s0], name: 'back' },
    { n: [0, 1], a: [p.f1, p.s1], b: [p.f0, p.s1], name: 'right' },
    { n: [0, -1], a: [p.f0, p.s0], b: [p.f1, p.s0], name: 'left' },
  ];
  for (const face of faces) {
    // World normal of the face. The camera looks from +x +y, so faces with nx + ny > 0 are visible.
    const nx = face.n[0] * cos - face.n[1] * sin, ny = face.n[0] * sin + face.n[1] * cos;
    if (nx + ny <= 0.01) continue;
    const wx = Math.max(nx, 0), wy = Math.max(ny, 0);
    const k = (0.68 * wx + 0.86 * wy) / (wx + wy);
    const A = P(face.a[0], face.a[1], p.z1), B = P(face.b[0], face.b[1], p.z1);
    const Bb = P(face.b[0], face.b[1], p.z0), Ab = P(face.a[0], face.a[1], p.z0);
    c.fillQuad(
      { x: A.x, y: A.y, u: 0, v: p.z1 }, { x: B.x, y: B.y, u: 1, v: p.z1 },
      { x: Bb.x, y: Bb.y, u: 1, v: p.z0 }, { x: Ab.x, y: Ab.y, u: 0, v: p.z0 },
      (u, z) => shadeColour(typeof p.side === 'function' ? p.side(u, z, face.name) : p.side, k),
    );
  }
  const t = [P(p.f0, p.s0, p.z1), P(p.f1, p.s0, p.z1), P(p.f1, p.s1, p.z1), P(p.f0, p.s1, p.z1)];
  c.fillPoly(t, p.top);
}

const wheels = (L, W, r = 0.32) => {
  const out = [];
  for (const f of [L / 2 - 0.8, -L / 2 + 0.8]) {
    for (const s of [-W / 2, W / 2 - 0.22]) out.push({ f0: f - r, f1: f + r, s0: s, s1: s + 0.22, z0: 0, z1: 2 * r, top: TYRE, side: TYRE });
  }
  return out;
};

const PARTS = {
  car: (colour) => {
    const L = 4.2, W = 1.8;
    const lights = (u, z, face) => {
      if (face === 'front' && z > 0.6 && z < 0.78 && (u < 0.22 || u > 0.78)) return 0xfff2b0;
      if (face === 'back' && z > 0.6 && z < 0.78 && (u < 0.2 || u > 0.8)) return 0xc0392b;
      return colour;
    };
    const cabin = (u, z, face) => ((face === 'left' || face === 'right') && (u < 0.06 || u > 0.94) ? colour : GLASS);
    return [
      ...wheels(L, W),
      { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.3, z1: 0.95, top: colour, side: lights },
      { f0: -1.3, f1: 0.8, s0: -W / 2 + 0.12, s1: W / 2 - 0.12, z0: 0.95, z1: 1.45, top: shadeColour(colour, 1.05), side: cabin },
    ];
  },
  bus: (stripe) => {
    const L = 5.0, W = 1.9, white = 0xf0efe6;
    const body = (u, z, face) => {
      if (z > 0.95 && z < 1.12) return stripe;
      if (face === 'front' && z > 1.2 && z < 1.85) return GLASS;
      if ((face === 'left' || face === 'right') && z > 1.25 && z < 1.75 && (u * 6) % 1 > 0.12) return GLASS;
      if (face === 'front' && z > 0.6 && z < 0.75 && (u < 0.2 || u > 0.8)) return 0xfff2b0;
      return white;
    };
    return [...wheels(L, W), { f0: -L / 2, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.3, z1: 2.05, top: 0xd8d6cc, side: body }];
  },
  truck: (cabColour) => {
    const L = 7.0, W = 2.4;
    const cab = (u, z, face) => {
      if (face === 'front' && z > 1.5 && z < 2.2 && u > 0.08 && u < 0.92) return GLASS;
      if ((face === 'left' || face === 'right') && z > 1.5 && z < 2.2 && (face === 'left' ? u > 0.5 : u < 0.5)) return GLASS;
      return cabColour;
    };
    const load = (u, z) => ((Math.floor(z * 4) & 1) ? 0x56703f : 0x4b6437); // green tarpaulin with folds
    return [
      ...wheels(L, W, 0.42),
      { f0: -L / 2, f1: L / 2, s0: -W / 2 + 0.1, s1: W / 2 - 0.1, z0: 0.45, z1: 0.8, top: 0x2a2a2a, side: 0x2a2a2a },
      { f0: 1.9, f1: L / 2, s0: -W / 2, s1: W / 2, z0: 0.8, z1: 2.5, top: shadeColour(cabColour, 0.9), side: cab },
      { f0: -L / 2, f1: 1.75, s0: -W / 2, s1: W / 2, z0: 0.8, z1: 2.3, top: 0x5f7a46, side: load },
    ];
  },
};

/** Other moto riders, with or without a passenger. */
export function drawRivalMoto(frame, load = 'none') {
  return drawBike('rival', frame, load);
}

// ---------------------------------------------------------------------------
// People: 4 directions (by screen quadrant) × 2 walk frames, a few colour sets.
// ---------------------------------------------------------------------------
export const PERSON_CANVAS = { width: 14, height: 26, groundX: 7, groundY: 24 };
export const PERSON_LOOKS = [
  { shirt: 0xc0392b, legs: 0x2a3550, skin: 0x6b4226 },
  { shirt: 0x3f8f4a, legs: 0x3a3a3a, skin: 0x5a3820 },
  { shirt: 0xe0a030, legs: 0x2a3550, skin: 0x7a4a2a },
  { shirt: 0x6a4aa0, legs: 0x4a3a2a, skin: 0x5a3820 }, // dress
  { shirt: 0xe8e8e4, legs: 0x2a2a2a, skin: 0x6b4226 },
  { shirt: 0x2f6fb0, legs: 0x5a4a3a, skin: 0x7a4a2a },
];

/** A walking person. facing: 0 = towards the camera, 1 = away. step: 0 or 1. */
export function drawPerson(look, facing, step) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  const swing = step ? 1.5 : -1.5;
  c.line(gx - 1, gy - 1, gx - 1 + swing * 0.6, gy - 8, 2.2, look.legs);
  c.line(gx + 1, gy - 1, gx + 1 - swing * 0.6, gy - 8, 2.2, look.legs);
  c.line(gx, gy - 9, gx, gy - 15, 4.6, look.shirt);
  c.line(gx - 2.5, gy - 14, gx - 2.5 - swing * 0.5, gy - 9, 1.6, look.skin);
  c.line(gx + 2.5, gy - 14, gx + 2.5 + swing * 0.5, gy - 9, 1.6, look.skin);
  c.fillDisc(gx + 0.5, gy - 18.5, 2.5, facing === 1 ? 0x1a1a1a : look.skin); // the back of the head shows hair
  c.outline(0x161616);
  return c;
}

/** A customer who waves for a moto, with one arm up. */
export function drawWaver(look) {
  const c = new PixelCanvas(PERSON_CANVAS.width, PERSON_CANVAS.height);
  const gx = PERSON_CANVAS.groundX, gy = PERSON_CANVAS.groundY;
  c.line(gx - 1, gy - 1, gx - 1, gy - 8, 2.2, look.legs);
  c.line(gx + 1, gy - 1, gx + 1, gy - 8, 2.2, look.legs);
  c.line(gx, gy - 9, gx, gy - 15, 4.6, look.shirt);
  c.line(gx + 2.5, gy - 14, gx + 4.5, gy - 21, 1.6, look.skin); // arm up
  c.line(gx - 2.5, gy - 14, gx - 3, gy - 9, 1.6, look.skin);
  c.fillDisc(gx + 0.5, gy - 18.5, 2.5, look.skin);
  c.outline(0x161616);
  return c;
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
