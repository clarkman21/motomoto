import { HQ, WORLD } from '../config.js';

// The Ampersand HQ mission (start of level 5): ride the old petrol moto into the HQ yard in Gikondo, get
// off, walk to the desk and hand in the old moto (trade-in), walk to your new Alpha (the teal bow), ride
// the test track (4 gates against the clock, or skip it), and ride out of the yard. No Phaser here.
//
// Stages: 'ride' (ride in and stop) → 'desk' (on foot, to the desk) → 'alpha' (on foot, to your Alpha)
// → 'track' (on the Alpha: the gates) → 'exit' (ride out of the yard) → 'done'.
// Positions are in metres (world), the layout in config.js is in tiles.

const T = WORLD.tileMetres;

/** True when the Alpha waits at HQ: the level 4 milestone is bought, and you do not ride it yet. */
export function hqMissionDue(wallet) {
  return !!wallet.perks?.alphaReady && !wallet.perks?.electric;
}

/** True when the point (metres) is inside the HQ yard. margin: metres inside the fence. */
export function inYard(x, y, margin = 0) {
  const r = HQ.yard;
  return x >= r.x0 * T + margin && x <= (r.x1 + 1) * T - margin && y >= r.y0 * T + margin && y <= (r.y1 + 1) * T - margin;
}

/** The new Alphas in rows (metres), nose to the south. One of them has the ribbon: it is yours. */
export function alphaSpots() {
  const a = HQ.alphaRows, out = [];
  a.ys.forEach((ty, row) => {
    let i = 0;
    for (let tx = a.x0; tx <= a.x1 + 1e-6; tx += a.step, i++) out.push({ x: tx * T, y: ty * T, ribbon: row === HQ.ribbon.row && i === HQ.ribbon.index });
  });
  return out;
}

/** Your Alpha (the one with the ribbon). */
export function ribbonAlpha() {
  return alphaSpots().find((s) => s.ribbon);
}

/** The old petrol motos in the trade-in row (metres). n: the number of spots (one more for yours). */
export function tradeSpots(n = HQ.tradeRow.count) {
  const r = HQ.tradeRow;
  return Array.from({ length: n }, (_, i) => ({ x: r.x * T, y: (r.y0 + i * r.step) * T }));
}

const ellipse = (rx, ry, a) => ({ x: (HQ.track.cx + rx * Math.cos(a)) * T, y: (HQ.track.cy + ry * Math.sin(a)) * T });
const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** The test track: the cones (an outer and an inner ring, with openings) and the 4 gates on the lane. */
export function trackLayout() {
  const k = HQ.track, cones = [];
  const ring = (rx, ry, open) => {
    const perimeter = Math.PI * 2 * Math.sqrt((rx * rx + ry * ry) / 2) * T;
    const n = Math.max(6, Math.round(perimeter / k.coneMetres));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (open && k.openings.some((o) => angleGap(a, o) < 0.36)) continue; // a way in and a way out
      cones.push(ellipse(rx, ry, a));
    }
  };
  ring(k.rx, k.ry, true);
  ring(k.innerRx, k.innerRy, false);
  const mx = (k.rx + k.innerRx) / 2, my = (k.ry + k.innerRy) / 2;
  const gates = HQ.gateOrder.map((a, i) => ({ n: i + 1, ...ellipse(mx, my, a), angle: a }));
  return { cones, gates };
}

/** A new mission (at the start of a level 5 day, while the Alpha waits). */
export function createHq() {
  const { cones, gates } = trackLayout();
  return {
    stage: 'ride',
    walker: null, // { x, y, dx, dy, moving } while you are on foot
    oldBike: null, // where you left the old moto { x, y, heading }
    cones: cones.map((c) => ({ ...c, down: false })),
    gates,
    gate: 0, // the next gate (index)
    time: 0, // seconds on the track
    penalty: 0, // seconds for the cones
    result: null, // { seconds, cones, bonus, skipped }
  };
}

/**
 * F in the yard. Returns { type, ... } or { type: 'no', reason } (the scene shows the text).
 * bike: the bike now; busy: a job is active.
 */
export function hqAction(hq, bike, busy = false) {
  const kmh = Math.hypot(bike.vx ?? 0, bike.vy ?? 0) * 3.6;
  if (hq.stage === 'ride') {
    if (!inYard(bike.x, bike.y)) return { type: 'no', reason: 'yard' };
    if (busy) return { type: 'no', reason: 'job' };
    if (kmh > HQ.stopKmh) return { type: 'no', reason: 'stop' };
    hq.oldBike = { x: bike.x, y: bike.y, heading: bike.heading };
    // You get off on the left side of the moto.
    const side = bike.heading - Math.PI / 2;
    hq.walker = clampWalker({ x: bike.x + Math.cos(side) * 0.9, y: bike.y + Math.sin(side) * 0.9, dx: 1, dy: 1, moving: false });
    hq.stage = 'desk';
    return { type: 'off' };
  }
  if (hq.stage === 'desk') {
    if (distance(hq.walker, deskSpot()) > HQ.reachMetres) return { type: 'no', reason: 'desk' };
    hq.stage = 'alpha';
    return { type: 'tradeIn', cash: HQ.tradeIn };
  }
  if (hq.stage === 'alpha') {
    const a = ribbonAlpha();
    if (distance(hq.walker, a) > HQ.reachMetres) return { type: 'no', reason: 'alpha' };
    hq.stage = 'track';
    hq.walker = null;
    return { type: 'mount', x: a.x, y: a.y, heading: Math.PI / 2 };
  }
  if (hq.stage === 'track') return skipTrack(hq);
  return { type: 'no', reason: hq.stage };
}

/** The point in front of the desk, where you stand to hand in the old moto (metres). */
export function deskSpot() {
  return { x: HQ.desk.x * T, y: (HQ.desk.y + 0.45) * T };
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The walker stays in the yard, and out of the hall. */
function clampWalker(w) {
  const r = HQ.yard, b = HQ.building, m = 0.4;
  w.x = Math.min((r.x1 + 1) * T - m, Math.max(r.x0 * T + m, w.x));
  w.y = Math.min((r.y1 + 1) * T - m, Math.max(r.y0 * T + m, w.y));
  if (w.x > b.x0 * T - m && w.x < (b.x1 + 1) * T + m && w.y < (b.y1 + 1) * T + m) w.y = (b.y1 + 1) * T + m;
  return w;
}

/**
 * Walk. dir: the direction on the screen (x to the right, y down), each -1..1 (arrow keys or the touch
 * stick). The screen directions turn into world directions (the iso view: x goes to the lower right).
 */
export function stepWalk(hq, dir, dt) {
  const w = hq.walker;
  if (!w) return false;
  const a = (dir.y + dir.x / 2) / 2, b = (dir.y - dir.x / 2) / 2; // world x and y for the screen direction
  const len = Math.hypot(a, b);
  w.moving = len > 0.05;
  if (!w.moving) return false;
  const k = Math.min(1, Math.hypot(dir.x, dir.y));
  w.dx = a / len;
  w.dy = b / len;
  w.x += w.dx * HQ.walkMs * k * dt;
  w.y += w.dy * HQ.walkMs * k * dt;
  clampWalker(w);
  return true;
}

/** The test track: the clock, the cones and the gates. Returns events: cone, gate, trackDone. */
export function stepTrack(hq, bike, dt) {
  if (hq.stage !== 'track') return [];
  const events = [];
  hq.time += dt;
  for (const c of hq.cones) {
    if (c.down || Math.hypot(c.x - bike.x, c.y - bike.y) > HQ.coneMetres) continue;
    c.down = true;
    hq.penalty += HQ.conePenalty;
    events.push({ type: 'cone', cone: c });
  }
  const g = hq.gates[hq.gate];
  if (g && Math.hypot(g.x - bike.x, g.y - bike.y) < HQ.gateMetres) {
    hq.gate += 1;
    events.push({ type: 'gate', n: g.n });
    if (hq.gate >= hq.gates.length) events.push(finishTrack(hq, false));
  }
  // Out of the yard on the track: the track is over (as a skip).
  if (hq.stage === 'track' && !inYard(bike.x, bike.y)) events.push(skipTrack(hq));
  return events;
}

function finishTrack(hq, skipped) {
  const seconds = hq.time + hq.penalty;
  const cones = hq.cones.filter((c) => c.down).length;
  hq.result = { seconds, cones, skipped, bonus: !skipped && seconds < HQ.bonusSeconds ? HQ.bonus : 0 };
  hq.stage = 'exit';
  return { type: 'trackDone', ...hq.result };
}

/** Skip the track (F or Backspace on the track). */
export function skipTrack(hq) {
  if (hq.stage !== 'track') return { type: 'no', reason: hq.stage };
  return finishTrack(hq, true);
}

/** After the track: ride out of the yard. Returns { type: 'out', gate: true when through the exit gate }. */
export function stepExit(hq, bike) {
  if (hq.stage !== 'exit' || inYard(bike.x, bike.y)) return null;
  hq.stage = 'done';
  const g = HQ.gates.out;
  return { type: 'out', gate: bike.x >= g[0] * T && bike.x <= g[1] * T };
}

/** The next goal, for the prompt and the map: { text, x, y } (metres), or null. */
export function hqGoal(hq) {
  switch (hq?.stage) {
    case 'ride': { const g = HQ.gates.in; return { text: 'ride', x: ((g[0] + g[1]) / 2) * T, y: (HQ.yard.y1 + 0.6) * T }; }
    case 'desk': return { text: 'desk', ...deskSpot() };
    case 'alpha': return { text: 'alpha', ...ribbonAlpha() };
    case 'track': { const g = hq.gates[hq.gate]; return g ? { text: 'gate', x: g.x, y: g.y } : null; }
    case 'exit': { const g = HQ.gates.out; return { text: 'exit', x: ((g[0] + g[1]) / 2) * T, y: (HQ.yard.y1 + 1.4) * T }; }
    default: return null;
  }
}
