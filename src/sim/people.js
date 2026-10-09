import { PEOPLE, WORLD, JOBS } from '../config.js';
import { tripMetres } from './jobs.js';

// People: walkers and customers who wave for a ride (street hails). No Phaser here.
// Walkers move between points on pavements and in the market area, in straight lines that
// do not go through buildings, so some cross roads. They step aside from a fast bike.

const T = WORLD.tileMetres;

/**
 * opts.hailEvery: multiplier on the time between street hails (below 1 = more customers).
 * opts.districts: people only in these districts. opts.walkers: how many walkers (default PEOPLE.walkers).
 */
export function createPeople(world, rng, opts = {}) {
  const open = (t) => !opts.districts || !t.district || opts.districts.includes(t.district);
  const walkTiles = world.tiles.filter((t) => open(t) && isWalkTile(world, t));
  const roadsideTiles = walkTiles.filter((t) => t.surface === 'pavement' && nextToRoad(world, t));
  const people = { walkers: [], hails: [], rng, walkTiles, roadsideTiles, nextId: 1, hailTimer: 2, hailEvery: opts.hailEvery ?? 1, districts: opts.districts ?? null };
  const count = walkTiles.length ? opts.walkers ?? PEOPLE.walkers : 0;
  for (let i = 0; i < count; i++) {
    const t = walkTiles[Math.floor(rng() * walkTiles.length)];
    const p = newPerson(people, (t.tx + 0.2 + rng() * 0.6) * T, (t.ty + 0.2 + rng() * 0.6) * T);
    pickTarget(people, world, p);
    people.walkers.push(p);
  }
  return people;
}

/** A new walker at (x, y) metres (not yet in people.walkers). */
export function newPerson(people, x, y) {
  const rng = people.rng;
  return {
    id: people.nextId++, kind: 'person', x, y, tx: x, ty: y,
    speed: PEOPLE.walkSpeed[0] + rng() * (PEOPLE.walkSpeed[1] - PEOPLE.walkSpeed[0]),
    look: Math.floor(rng() * PEOPLE.looks), wait: 0, dodge: 0, dodgeX: 0, dodgeY: 0, hurt: 0,
    vx: 0, vy: 0, length: 0.7, width: 0.7,
  };
}

function isWalkTile(world, t) {
  if (t.block || t.solid) return false;
  if (t.surface === 'pavement') return true;
  // Markets and the bus park (the map's crowd areas): people walk everywhere there.
  return (world.crowdAreas ?? []).some((a) => t.tx >= a.x0 && t.tx < a.x1 && t.ty >= a.y0 && t.ty < a.y1);
}

function nextToRoad(world, t) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const n = world.tile(t.tx + dx, t.ty + dy);
    return n && !n.block && (n.surface === 'tarmac' || n.surface === 'murram' || n.surface === 'cobble');
  });
}

/** A clear straight line (no buildings, water or trees) between two points. */
function clearLine(world, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.5);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (world.isSolidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, false)) return false;
  }
  return true;
}

function pickTarget(people, world, p) {
  const rng = people.rng;
  for (let tries = 0; tries < 12; tries++) {
    const t = people.walkTiles[Math.floor(rng() * people.walkTiles.length)];
    const x = (t.tx + 0.2 + rng() * 0.6) * T, y = (t.ty + 0.2 + rng() * 0.6) * T;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 3 || d > 40) continue;
    if (clearLine(world, p.x, p.y, x, y)) {
      p.tx = x;
      p.ty = y;
      return;
    }
  }
  p.wait = 1 + rng() * 2; // nowhere to go now: stand and try again later
}

/**
 * Advance people by dt. bike = { x, y, vx, vy }. Returns events:
 * { type: 'hailNew', hail } when a customer starts to wave, { type: 'hailGone', hail } when one gives up.
 */
export function stepPeople(people, world, bike, places, dt) {
  const events = [];
  const rng = people.rng;
  people.yellTimer = Math.max(0, (people.yellTimer ?? 0) - dt);
  for (const p of people.walkers) {
    p.vx = p.vy = 0;
    if (p.yellCooldown > 0) p.yellCooldown -= dt;
    if (p.hurt > 0) {
      p.hurt -= dt;
      continue;
    }
    // Step aside from a fast bike that comes at you.
    const bx = p.x - bike.x, by = p.y - bike.y;
    const bd = Math.hypot(bx, by);
    const bs = Math.hypot(bike.vx, bike.vy);
    // A near miss: the person yells at you (not too often).
    if (bd < PEOPLE.yellDistance && bs > PEOPLE.yellSpeed && !(p.yellCooldown > 0) && people.yellTimer <= 0) {
      p.yellCooldown = PEOPLE.yellCooldown;
      people.yellTimer = PEOPLE.yellGap;
      events.push({ type: 'nearMiss', person: p, word: PEOPLE.yells[Math.floor(rng() * PEOPLE.yells.length)] });
    }
    if (p.dodge <= 0 && bd < PEOPLE.dodgeDistance && bs > 2 && (bike.vx * bx + bike.vy * by) > 0) {
      // Move at right angles to the bike's direction, on the side where the person already is.
      const nx = -bike.vy / bs, ny = bike.vx / bs;
      const side = nx * bx + ny * by >= 0 ? 1 : -1;
      p.dodgeX = nx * side;
      p.dodgeY = ny * side;
      p.dodge = 0.7;
    }
    if (p.dodge > 0) {
      p.dodge -= dt;
      const nx = p.x + p.dodgeX * 2.2 * dt, ny = p.y + p.dodgeY * 2.2 * dt;
      if (!world.isSolidAt(nx, ny, false)) {
        p.vx = p.dodgeX * 2.2;
        p.vy = p.dodgeY * 2.2;
        p.x = nx;
        p.y = ny;
      }
      continue;
    }
    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait <= 0) pickTarget(people, world, p);
      continue;
    }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.3) {
      p.wait = rng() * 3;
      continue;
    }
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // Customers who wave for a ride.
  for (const h of people.hails) {
    h.life -= dt;
    if (h.life <= 0) events.push({ type: 'hailGone', hail: h });
  }
  people.hails = people.hails.filter((h) => h.life > 0 && !h.taken);
  people.hailTimer -= dt;
  // people.noHails: nobody waves for a moto (the Umuganda morning).
  if (people.hailTimer <= 0 && !people.noHails && people.hails.length < PEOPLE.maxHails && people.roadsideTiles.length) {
    people.hailTimer = PEOPLE.hailEverySeconds * people.hailEvery * (0.6 + rng() * 0.8);
    const h = makeHail(people, places, bike);
    if (h) {
      people.hails.push(h);
      events.push({ type: 'hailNew', hail: h });
    }
  }
  return events;
}

/**
 * The horn: people in front of the bike (and near it) step out of the way, to the side.
 * Returns the number of people who move.
 */
export function honkAt(people, bike) {
  const hx = Math.cos(bike.heading), hy = Math.sin(bike.heading);
  let moved = 0;
  for (const p of people.walkers) {
    if (p.hurt > 0) continue;
    const bx = p.x - bike.x, by = p.y - bike.y;
    if (Math.hypot(bx, by) > PEOPLE.honkRadius || bx * hx + by * hy < -1) continue; // behind you: they do not move
    // Step at right angles to the bike's heading, on the side where the person already is.
    const side = -hy * bx + hx * by >= 0 ? 1 : -1;
    p.dodgeX = -hy * side;
    p.dodgeY = hx * side;
    p.dodge = PEOPLE.honkDodgeSeconds;
    p.wait = 0;
    moved++;
  }
  return moved;
}

/**
 * Customers from a bus that arrives (at the bus park): count hails close to (x, y) in metres.
 * They come on top of the normal street hails. Returns the new hails.
 */
export function busArrivalHails(people, world, places, x, y, count) {
  const near = people.walkTiles.filter((t) => Math.hypot((t.tx + 0.5) * T - x, (t.ty + 0.5) * T - y) < 16);
  const made = [];
  for (let i = 0; i < count && near.length; i++) {
    const h = makeHail(people, places, null, near);
    if (h) {
      h.fromBus = true;
      h.from.name = 'Bus park';
      people.hails.push(h);
      made.push(h);
    }
  }
  return made;
}

function makeHail(people, places, bike, tiles = people.roadsideTiles) {
  const rng = people.rng;
  for (let tries = 0; tries < 20; tries++) {
    const t = tiles[Math.floor(rng() * tiles.length)];
    const x = (t.tx + 0.5) * T, y = (t.ty + 0.5) * T;
    if (bike && Math.hypot(x - bike.x, y - bike.y) < 25) continue; // not right next to you
    const from = { name: 'Street', x: x / T, y: y / T };
    const dests = places.filter((p) =>
      !p.tags.some((tag) => ['fuel', 'swap', 'garage'].includes(tag)) && tripMetres(from, p) >= JOBS.minTripMetres &&
      (!people.districts || !p.district || people.districts.includes(p.district)));
    if (!dests.length) continue;
    const to = dests[Math.floor(rng() * dests.length)];
    const [lo, hi] = PEOPLE.hailLifeSeconds;
    return { id: people.nextId++, kind: 'person', x, y, from, to, look: Math.floor(rng() * PEOPLE.looks), life: lo + rng() * (hi - lo), taken: false, length: 0.7, width: 0.7 };
  }
  return null;
}

/** The customer within reach of a slow bike, or null. */
export function hailInReach(people, bike, speed) {
  if (speed > JOBS.stopSpeedKmh / 3.6) return null;
  let best = null, bestD = PEOPLE.hailRange;
  for (const h of people.hails) {
    const d = Math.hypot(h.x - bike.x, h.y - bike.y);
    if (d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

/** True if a point is inside a person (for collisions). */
export function insidePerson(p, x, y) {
  return Math.hypot(p.x - x, p.y - y) < PEOPLE.radius;
}
