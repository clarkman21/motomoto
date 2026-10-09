import { TRAFFIC_LIGHTS as TL, WORLD } from '../config.js';

// Traffic lights at the big junctions. No Phaser here.
// A light: { id, x, y (metres, the centre of the junction), district, offset (seconds) }.

const T = WORLD.tileMetres;
const CYCLE = 2 * (TL.greenSeconds + TL.amberSeconds + TL.allRedSeconds);

/** The axis of a direction: 'x' (along x) or 'y'. */
export const axisOf = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y');

/**
 * Choose the junctions with lights: 4-way junctions of tarmac roads (not on a roundabout), the busiest
 * first, at most TL.perDistrict in each district, and not too near each other.
 */
export function pickLightJunctions(world, graph) {
  const tarmac = (e) => !e.road?.ring && (!e.road?.surface || e.road.surface === '#');
  const candidates = graph.nodes.filter((n) => n.out.length >= 4 && n.out.every(tarmac));
  // Busier first: wide roads (a boulevard), then more arms. Then a fixed order (no randomness).
  const score = (n) => n.out.reduce((a, e) => a + (e.road?.width ?? 2), 0) + n.out.length;
  candidates.sort((a, b) => score(b) - score(a) || a.x - b.x || a.y - b.y);
  const lights = [], perDistrict = {};
  for (const n of candidates) {
    const district = world.districtAt(Math.floor(n.x / T), Math.floor(n.y / T));
    if ((perDistrict[district] ?? 0) >= TL.perDistrict) continue;
    if (lights.some((l) => Math.hypot(l.x - n.x, l.y - n.y) < TL.minSpacingTiles * T)) continue;
    perDistrict[district] = (perDistrict[district] ?? 0) + 1;
    lights.push({ id: lights.length, x: n.x, y: n.y, district, offset: ((n.x * 7 + n.y * 13) % CYCLE + CYCLE) % CYCLE });
  }
  return lights;
}

/** The colour for each axis at a time (seconds): { x: 'green' | 'amber' | 'red', y: ... }. */
export function lightState(light, time) {
  const t = (((time + light.offset) % CYCLE) + CYCLE) % CYCLE;
  const G = TL.greenSeconds, A = TL.amberSeconds, R = TL.allRedSeconds, half = G + A + R;
  const phase = (u) => (u < G ? 'green' : u < G + A ? 'amber' : 'red');
  return t < half ? { x: phase(t), y: 'red' } : { x: 'red', y: phase(t - half) };
}

/** Put each light on the graph node at its junction (node.light), so the traffic can find it. */
export function attachLights(graph, lights) {
  for (const n of graph.nodes) n.light = null;
  for (const l of lights) {
    const n = graph.nodes.find((q) => Math.hypot(q.x - l.x, q.y - l.y) < 1);
    if (n) n.light = l;
  }
}

/**
 * A vehicle that comes to a light: the speed limit from the light (m/s), or Infinity.
 * toEnd: metres to the centre of the junction. brake: the vehicle's braking (m/s²).
 */
export function lightLimit(light, time, edge, toEnd, speed, brake) {
  const st = lightState(light, time)[axisOf(edge.dx, edge.dy)];
  const toLine = toEnd - TL.stopMetres;
  if (st === 'green' || toLine < -0.5) return Infinity; // green, or already over the line: go on
  // Amber: stop only when there is room to stop.
  if (st === 'amber' && toLine < (speed * speed) / (2 * brake)) return Infinity;
  return Math.max(0, toLine * 1.2);
}

/**
 * The bike goes into a junction box: did it go through a red light? prevInside: was it in the box
 * before. Returns 'red' or null.
 */
export function redLightCheck(light, time, bike, prevInside) {
  const inside = Math.abs(bike.x - light.x) < TL.boxMetres && Math.abs(bike.y - light.y) < TL.boxMetres;
  if (!inside || prevInside) return { inside, red: false };
  const v = Math.hypot(bike.vx, bike.vy);
  if (v < 2) return { inside, red: false };
  const st = lightState(light, time)[axisOf(bike.vx, bike.vy)];
  return { inside, red: st === 'red' };
}
