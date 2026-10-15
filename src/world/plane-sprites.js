import { toScreen } from './iso.js';
import { PixelCanvas, shadeColour } from './pixel-canvas.js';

// An airliner for Kigali International Airport (the apron and the runway). It points along +x (to the
// east on the map: down and to the right on the screen), or along -x (west: up and to the left) for the
// take-off. The plane is the same on its two sides, so the west plane is the east plane mirrored in x. It is a small mesh in metres: a round fuselage
// (8 sides) with a nose and a tail cone, swept wings, engines under the wings, a tailplane and a fin.
// The fuselage faces are sorted far to near and the back faces are not drawn. A white plane with a blue
// tail and a blue cheat line; no airline name or logo. No Phaser here.

export const PLANE = { length: 18, span: 16, height: 7 }; // metres (smaller than real, for the compressed map)

const WHITE = 0xf2f2ee, WING = 0xc9cdd2, FLAP = 0xa6abb2, BLUE = 0x2a5aa8, BLUE_LIGHT = 0x4a7cc8;
const WINDOW = 0x24323f, ENGINE = 0xb8bcc2, INTAKE = 0x3a3e44, TYRE = 0x1a1a1a, OUTLINE = 0x1a1c1e;

const LIGHT = norm([-0.3, 0.6, 0.75]); // the sun: high, from the south
const SIDES = 8;
const R = 1.3, ZC = 2.3; // the fuselage radius and the height of its centre line (metres)

function norm([x, y, z]) { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
const lit = (colour, n) => shadeColour(colour, 0.74 + 0.3 * Math.max(0, dot(n, LIGHT)));

/** A ring of points round the x axis: { x, s (the size, 0..1), dz (lifts the centre) }. */
function ring({ x, s, dz = 0 }, r = R, zc = ZC, yc = 0) {
  return Array.from({ length: SIDES }, (_, k) => {
    const a = ((k + 0.5) / SIDES) * Math.PI * 2; // a = 0 is the top; the faces centre on 0°, 45°, 90° ...
    return [x, yc + Math.sin(a) * r * s, zc + dz + Math.cos(a) * r * s];
  });
}

/** A tube from rings: the faces (quads) with their outward normals, and the two end caps. */
function tube(stations, r, zc, yc, colourOf) {
  const rings = stations.map((st) => ring(st, r, zc, yc));
  const faces = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let k = 0; k < SIDES; k++) {
      const k2 = (k + 1) % SIDES;
      const pts = [rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2]];
      faces.push({ pts, colour: colourOf(i, k), closed: true });
    }
  }
  const capFront = [...rings[rings.length - 1]].reverse(), capBack = [...rings[0]];
  return { faces, capFront, capBack };
}

/** The parts of the plane, in metres, in the order to draw them. gear: the wheels are down. */
function planeParts(gear) {
  const L = PLANE.length / 2, half = PLANE.span / 2;
  const groups = [];
  const flat = (pts, colour, shade) => ({ pts, colour, shade });

  // The wings: swept back, with a small dihedral. u: from the leading edge to the trailing edge; v: from the root.
  const wing = (s) => flat([[2.4, s * 1.1, 1.6], [-1.4, s * 1.1, 1.6], [-4.4, s * half, 2.2], [-3.2, s * half, 2.2]], WING,
    (u) => (u > 0.82 ? FLAP : WING));
  // The engines: short tubes under the wings, a dark intake at the front.
  const engine = (s) => {
    const t = tube([{ x: -0.6, s: 0.8 }, { x: 0.2, s: 1 }, { x: 2.0, s: 1 }], 0.62, 1.0, s * 3.9, () => ENGINE);
    return [...t.faces, { pts: t.capFront, colour: INTAKE, closed: true }, { pts: t.capBack, colour: FLAP, closed: true }];
  };
  const tailplane = (s) => flat([[-L + 2.8, s * 0.5, ZC + 0.7], [-L + 0.9, s * 0.5, ZC + 0.7], [-L - 0.1, s * 3.6, ZC + 1.0], [-L + 1.0, s * 3.6, ZC + 1.0]], WING,
    (u) => (u > 0.75 ? FLAP : WING));

  groups.push(engine(-1), [wing(-1)], [tailplane(-1)]);

  // The wheels: behind the belly, so only their low part shows.
  if (gear) {
    const wheel = (x, y, h) => flat([[x + 0.3, y, h], [x - 0.3, y, h], [x - 0.3, y, 0], [x + 0.3, y, 0]], TYRE);
    groups.push([wheel(L - 2.2, 0, 1.0), wheel(-1.0, -0.8, 0.9), wheel(-1.0, 0.8, 0.9)]);
  }

  // The fuselage: the tail cone (lifted), the long middle, the nose (a little low).
  const stations = [{ x: -L, s: 0.3, dz: 0.75 }, { x: -L + 2.6, s: 0.85, dz: 0.2 }, { x: -L + 4.0, s: 1 }, { x: L - 2.6, s: 1 },
    { x: L - 1.1, s: 0.78, dz: -0.15 }, { x: L - 0.2, s: 0.38, dz: -0.35 }];
  const body = tube(stations, R, ZC, 0, (i, k) => {
    if (i === 4 && (k === 7 || k === 0 || k === 1)) return 'cockpit'; // the faces centred on 0°, 45° and 90°
    if ((k === 1 || k === 5) && i >= 1 && i <= 3) return 'side'; // the windows on the two sides
    return WHITE;
  });
  const tip = [L + 0.25, 0, ZC - 0.45];
  const ringN = ring(stations[stations.length - 1]);
  const nose = ringN.map((p, k) => ({ pts: [p, ringN[(k + 1) % SIDES], tip], colour: WHITE, closed: true }));
  groups.push([...body.faces, ...nose, { pts: body.capBack, colour: WHITE, closed: true }]);

  // The fin (blue, with a light band) on the top of the tail.
  groups.push([flat([[-L + 3.2, 0, ZC + R * 0.9], [-L + 0.6, 0, ZC + 1.0], [-L - 0.6, 0, ZC + 4.6], [-L + 1.1, 0, ZC + 4.6]], BLUE,
    (u, v) => (v > 0.55 && v < 0.68 ? BLUE_LIGHT : BLUE))]);
  groups.push([tailplane(1)]);

  groups.push(engine(1), [wing(1)]);
  return groups;
}

const screenOf = (pts) => pts.map(([x, y, z]) => toScreen(x, y, z));
function screenArea(s) {
  let a = 0;
  for (let i = 0; i < s.length; i++) { const p = s[i], q = s[(i + 1) % s.length]; a += p.x * q.y - q.x * p.y; }
  return a;
}
function canvasFor(groups, flatten) {
  const all = groups.flat().flatMap((f) => screenOf(f.pts.map(([x, y, z]) => [x, y, flatten ? 0 : z])));
  const minX = Math.floor(Math.min(...all.map((p) => p.x))) - 2, maxX = Math.ceil(Math.max(...all.map((p) => p.x))) + 2;
  const minY = Math.floor(Math.min(...all.map((p) => p.y))) - 2, maxY = Math.ceil(Math.max(...all.map((p) => p.y))) + 2;
  return new PixelCanvas(maxX - minX, maxY - minY, minX, minY);
}
const result = (c) => {
  const g = toScreen(0, 0, 0);
  return { canvas: c, groundX: Math.round(g.x - c.ox), groundY: Math.round(g.y - c.oy) };
};

// The sign of the screen area of a face that looks at the camera (the top face of a box, seen from above).
const FRONT = Math.sign(screenArea(screenOf([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]])));

const mirrored = (groups) => groups.map((g) => g.map((f) => ({ ...f, pts: f.pts.map(([x, y, z]) => [-x, y, z]) })));

/**
 * The plane: { canvas, groundX, groundY } (groundX, groundY: the canvas pixel under the middle of the plane).
 * gear: the wheels are down. west: the nose points west (-x).
 */
export function drawPlane({ gear = true, west = false } = {}) {
  const groups = west ? mirrored(planeParts(gear)) : planeParts(gear);
  const front = west ? -FRONT : FRONT; // a mirror turns the faces round
  const c = canvasFor(groups, false);
  for (const group of groups) {
    // In a group: far faces first (the camera looks along -x, -y, -z), and no back faces of closed parts.
    const faces = group.map((f) => ({ ...f, depth: f.pts.reduce((d, [x, y, z]) => d + x + y + 0.75 * z, 0) / f.pts.length }));
    faces.sort((a, b) => a.depth - b.depth);
    for (const f of faces) {
      const s = screenOf(f.pts);
      if (f.closed && Math.sign(screenArea(s)) !== front) continue;
      const n = norm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[f.pts.length - 1], f.pts[0]))).map((v) => (west ? -v : v));
      const nUp = n[2] < 0 && !f.closed ? n.map((v) => -v) : n; // a flat part: light its top
      let shade;
      if (f.colour === 'side') {
        // The middle side of the fuselage: a row of windows and a blue cheat line under them.
        shade = (u, v, px) => {
          const base = v > 0.62 && v < 0.78 ? BLUE : v > 0.32 && v < 0.5 && px % 3 !== 0 ? WINDOW : WHITE;
          return base === WHITE ? lit(WHITE, nUp) : base;
        };
      } else if (f.colour === 'cockpit') {
        shade = (u) => (u > 0.3 && u < 0.75 ? WINDOW : lit(WHITE, nUp));
      } else if (f.shade) {
        shade = (u, v) => lit(f.shade(u, v), nUp);
      } else {
        const col = lit(f.colour, nUp);
        shade = () => col;
      }
      const uv = s.map((p, i) => ({ ...p, u: i === 1 || i === 2 ? 1 : 0, v: i >= 2 ? 1 : 0 }));
      if (uv.length === 3) c.fillTri(uv[0], uv[1], uv[2], shade);
      else if (uv.length === 4) c.fillQuad(uv[0], uv[1], uv[2], uv[3], shade);
      else for (let i = 1; i + 1 < uv.length; i++) c.fillTri(uv[0], uv[i], uv[i + 1], shade);
    }
  }
  c.outline(OUTLINE);
  return result(c);
}

/** The shadow of the plane on the ground: its shape seen from straight above, in one dark colour. */
export function drawPlaneShadow({ west = false } = {}) {
  const groups = west ? mirrored(planeParts(false)) : planeParts(false);
  const c = canvasFor(groups, true);
  for (const f of groups.flat()) {
    const s = screenOf(f.pts.map(([x, y]) => [x, y, 0]));
    if (Math.abs(screenArea(s)) < 0.5) continue;
    for (let i = 1; i + 1 < s.length; i++) c.fillTri({ ...s[0], u: 0, v: 0 }, { ...s[i], u: 0, v: 0 }, { ...s[i + 1], u: 0, v: 0 }, () => 0x000000);
  }
  return result(c);
}
