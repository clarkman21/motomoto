import { POLICE, LAW, WORLD } from '../config.js';

// Traffic police on the junction corners. No Phaser here.
// - Speeding past an officer: the officer blows the whistle (no fine).
// - Riding on the pavement or off road near an officer: the officer blows the whistle and runs
//   after you. If the officer gets to you, you pay a fine. If you get far enough away (or the
//   chase takes too long), the officer gives up and walks back to the corner.

/** spots: [{ x, y, phase }] in metres. Returns the police state. */
export function createPolice(spots) {
  return {
    cooldown: 0, // seconds: after a fine, no new chase for a while
    officers: spots.map((p) => ({ ...p, home: { x: p.x, y: p.y }, state: 'post', t: 0, whistleCooldown: 0, facing: 1 })),
  };
}

/**
 * Call each frame. bike: { x, y }. ctx: { speedKmh, limitKmh, illegal: null | 'pavement' | 'offRoad' }.
 * isSolid(x, y): true where an officer cannot run (buildings). Returns events:
 * { type: 'whistle' | 'chase' | 'caught' | 'escaped', officer, reason? }.
 */
export function stepPolice(police, bike, ctx, dt, isSolid = () => false) {
  const events = [];
  police.cooldown = Math.max(0, police.cooldown - dt);
  const chasing = police.officers.some((o) => o.state === 'chase');
  for (const o of police.officers) {
    o.whistleCooldown = Math.max(0, o.whistleCooldown - dt);
    const dist = Math.hypot(bike.x - o.x, bike.y - o.y);
    if (o.state === 'post') {
      if (ctx.illegal && !chasing && police.cooldown === 0 && dist < POLICE.seeMetres) {
        o.state = 'chase';
        o.t = 0;
        o.reason = ctx.illegal;
        events.push({ type: 'chase', officer: o, reason: ctx.illegal });
      } else if (dist < POLICE.whistleRange && o.whistleCooldown === 0 && ctx.speedKmh > ctx.limitKmh + Math.max(POLICE.whistleKmh, LAW.toleranceKmh)) {
        o.whistleCooldown = 6;
        events.push({ type: 'whistle', officer: o });
      }
    } else if (o.state === 'chase') {
      o.t += dt;
      follow(o, bike, (POLICE.runKmh / 3.6) * dt, isSolid, dt);
      const d = Math.hypot(bike.x - o.x, bike.y - o.y);
      if (d < POLICE.catchMetres) {
        o.state = 'return';
        police.cooldown = POLICE.cooldownSeconds;
        events.push({ type: 'caught', officer: o, reason: o.reason });
      } else if (d > POLICE.giveUpMetres || o.t > POLICE.maxChaseSeconds) {
        o.state = 'return';
        events.push({ type: 'escaped', officer: o });
      }
    } else if (o.state === 'return') {
      follow(o, o.home, (POLICE.walkKmh / 3.6) * dt, isSolid, dt); // back to the corner, around the buildings
      if (Math.hypot(o.home.x - o.x, o.home.y - o.y) < 0.05) {
        Object.assign(o, { x: o.home.x, y: o.home.y, state: 'post' });
      }
    }
  }
  return events;
}

/**
 * Move an officer toward a target, around buildings: straight when the way is clear, else along a
 * path of tiles (found again every POLICE.repathSeconds, because the bike moves).
 */
function follow(o, target, step, isSolid, dt) {
  if (clearLine(o, target, isSolid)) {
    o.path = null;
    move(o, target, step, isSolid);
    return;
  }
  o.repath = (o.repath ?? 0) - dt;
  if (!o.path || o.repath <= 0) {
    o.path = findPath(o, target, isSolid) ?? [];
    o.repath = POLICE.repathSeconds;
  }
  // Skip the waypoints that are already reached, then go to the next one.
  while (o.path.length && Math.hypot(o.path[0].x - o.x, o.path[0].y - o.y) < 0.3) o.path.shift();
  move(o, o.path.length ? o.path[0] : target, step, isSolid);
}

/** True when nothing solid is on the straight line from a to b (checked every half metre). */
export function clearLine(a, b, isSolid) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / 0.5);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (isSolid(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

/**
 * A path around buildings, from a to b (metres): the centres of free tiles, or null. A* on the tiles,
 * 8 directions (no cutting of corners), inside a box of POLICE.pathTiles around a and b.
 */
export function findPath(a, b, isSolid) {
  const T = WORLD.tileMetres;
  const tile = (p) => ({ x: Math.floor(p.x / T), y: Math.floor(p.y / T) });
  const s = tile(a), g = tile(b);
  const free = (x, y) => !isSolid((x + 0.5) * T, (y + 0.5) * T);
  const m = POLICE.pathTiles;
  const x0 = Math.min(s.x, g.x) - m, x1 = Math.max(s.x, g.x) + m, y0 = Math.min(s.y, g.y) - m, y1 = Math.max(s.y, g.y) + m;
  const key = (x, y) => (y - y0) * (x1 - x0 + 1) + (x - x0);
  const h = (x, y) => Math.hypot(x - g.x, y - g.y);
  const open = [{ x: s.x, y: s.y, f: h(s.x, s.y) }];
  const cost = new Map([[key(s.x, s.y), 0]]);
  const prev = new Map();
  const done = new Set();
  let found = false;
  while (open.length && done.size < POLICE.pathMaxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const n = open.splice(bi, 1)[0];
    const k = key(n.x, n.y);
    if (done.has(k)) continue;
    done.add(k);
    if (n.x === g.x && n.y === g.y) { found = true; break; }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = n.x + dx, y = n.y + dy;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const goal = x === g.x && y === g.y;
        if (!goal && !free(x, y)) continue;
        if (dx && dy && (!free(n.x + dx, n.y) || !free(n.x, n.y + dy))) continue; // no corner cutting
        const c = cost.get(k) + (dx && dy ? Math.SQRT2 : 1);
        const nk = key(x, y);
        if (c < (cost.get(nk) ?? Infinity)) {
          cost.set(nk, c);
          prev.set(nk, k);
          open.push({ x, y, f: c + h(x, y) });
        }
      }
    }
  }
  if (!found) return null;
  const path = [];
  for (let k = key(g.x, g.y); k !== key(s.x, s.y); k = prev.get(k)) {
    const x = (k % (x1 - x0 + 1)) + x0, y = Math.floor(k / (x1 - x0 + 1)) + y0;
    path.unshift({ x: (x + 0.5) * T, y: (y + 0.5) * T });
  }
  path[path.length - 1] = { x: b.x, y: b.y }; // the last point is the target itself
  return path;
}

/** Move an officer toward a target by up to `step` metres. Slide along a wall when the way is blocked. */
function move(o, target, step, isSolid) {
  const dx = target.x - o.x, dy = target.y - o.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const k = Math.min(1, step / d);
  const nx = o.x + dx * k, ny = o.y + dy * k;
  if (!isSolid(nx, ny)) Object.assign(o, { x: nx, y: ny });
  else if (!isSolid(nx, o.y)) o.x = nx;
  else if (!isSolid(o.x, ny)) o.y = ny;
  o.facing = dx - dy; // the direction on the screen (for the sprite)
}
