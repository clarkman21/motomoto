import { CROSSINGS as CR, WORLD } from '../config.js';
import { crossings } from '../world/road-signs.js';
import { newPerson } from './people.js';

// People on the zebra crossings. No Phaser here. A crosser is a walker (people.walkers) that starts at
// one kerb with the far kerb as its target; then it walks on as a normal walker, and it goes away later.

const T = WORLD.tileMetres;

/**
 * The crossings of the map as paths: [{ id, a, b (metres: the kerbs at the two ends), cx, cy (the middle),
 * across ('x' or 'y': the direction people walk), district }].
 */
export function crossingPaths(world) {
  const groups = new Map();
  for (const [key, c] of crossings(world)) {
    const [x, y] = key.split(',').map(Number);
    // A road along x: people walk along y, over a column of tiles (and the other way round).
    const gk = c.alongX ? `x${x}` : `y${y}`;
    const list = groups.get(gk) ?? [];
    list.push({ x, y, alongX: c.alongX });
    groups.set(gk, list);
  }
  const paths = [];
  for (const list of groups.values()) {
    const alongX = list[0].alongX;
    list.sort((p, q) => (alongX ? p.y - q.y : p.x - q.x));
    // Split into runs of tiles next to each other (one run = one crossing).
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const f = run[0], l = run[run.length - 1];
      const a = alongX ? { x: (f.x + 0.5) * T, y: (f.y - 0.4) * T } : { x: (f.x - 0.4) * T, y: (f.y + 0.5) * T };
      const b = alongX ? { x: (l.x + 0.5) * T, y: (l.y + 1.4) * T } : { x: (l.x + 1.4) * T, y: (l.y + 0.5) * T };
      const ok = (p) => { const t = world.tileAt(p.x, p.y); return t && !t.block && !t.solid && t.surface !== 'water'; };
      if (ok(a) && ok(b)) {
        paths.push({ id: paths.length, a, b, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, across: alongX ? 'y' : 'x', district: world.districtAt(f.x, f.y) });
      }
      run = [];
    };
    for (const p of list) {
      const last = run[run.length - 1];
      if (last && (alongX ? p.y - last.y : p.x - last.x) !== 1) flush();
      run.push(p);
    }
    flush();
  }
  return paths;
}

/** Is a vehicle (or the bike) coming to this crossing? Within clearMetres, and moving. */
function traffic(path, movers) {
  return movers.some((m) => (m.speed ?? Math.hypot(m.vx ?? 0, m.vy ?? 0)) > 2 && Math.hypot(m.x - path.cx, m.y - path.cy) < CR.clearMetres);
}

/**
 * One step. state: { timers: Map, seen: Set }. ctx: { bike, movers (vehicles and the bike), mode, districts }.
 * Adds crossers to people.walkers and removes old ones. Returns events: { type: 'ranCrossing', person }.
 */
export function stepCrossers(state, people, paths, ctx, dt) {
  const { bike, mode } = ctx;
  const rng = people.rng;
  const events = [];
  const crossers = people.walkers.filter((p) => p.crosser);
  for (const path of paths) {
    if (ctx.districts && !ctx.districts.includes(path.district)) continue;
    if (Math.hypot(path.cx - bike.x, path.cy - bike.y) > CR.nearMetres) continue;
    const t = (state.timers.get(path.id) ?? rng() * CR.everySeconds) - dt * mode.crossers;
    if (t > 0) {
      state.timers.set(path.id, t);
      continue;
    }
    state.timers.set(path.id, CR.everySeconds * (0.6 + rng() * 0.8));
    if (crossers.length >= CR.maxCrossers) continue;
    // People wait for a gap in the traffic; in hard mode some step out anyway.
    if (traffic(path, ctx.movers) && rng() >= mode.crossStepOut) continue;
    const [from, to] = rng() < 0.5 ? [path.a, path.b] : [path.b, path.a];
    const p = newPerson(people, from.x, from.y);
    Object.assign(p, { tx: to.x, ty: to.y, crosser: true, path: path.id, life: 40 });
    people.walkers.push(p);
    crossers.push(p);
  }
  // On the crossing: you must stop for the people on it.
  const v = Math.hypot(bike.vx, bike.vy);
  for (const p of crossers) {
    p.life -= dt;
    const onRoad = Math.hypot(p.tx - p.x, p.ty - p.y) > 0.8 && !state.seen.has(p.id);
    if (onRoad && v * 3.6 > CR.passKmh && Math.hypot(p.x - bike.x, p.y - bike.y) < CR.passMetres) {
      state.seen.add(p.id);
      events.push({ type: 'ranCrossing', person: p });
    }
  }
  // Old crossers go away when you cannot see them (far from the bike).
  people.walkers = people.walkers.filter((p) => !p.crosser || p.life > 0 || Math.hypot(p.x - bike.x, p.y - bike.y) < 60);
  return events;
}
