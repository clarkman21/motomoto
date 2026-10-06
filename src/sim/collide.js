import { COLLISION, LOAD, PEOPLE } from '../config.js';

// Collisions between the bike and moving or small things: vehicles, rival motos, people and
// poles (street lamps, signs, cameras). No Phaser here.
// The bike is a circle. A vehicle is a rectangle turned to its heading; a person or a pole is a circle.
// At a contact, the bike moves out, and an impulse changes the speeds by mass: a bike that hits a
// truck bounces back, a truck that hits the bike pushes it away. Vehicles stay in their lane, so
// a hit only changes their speed along the lane.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Contact between a circle (x, y, r) and an agent: { nx, ny (from the agent to the circle), depth }, or null. */
export function contact(agent, x, y, r) {
  if (agent.kind === 'person' || agent.kind === 'pole') {
    const rad = agent.radius ?? PEOPLE.radius;
    const dx = x - agent.x, dy = y - agent.y;
    const d = Math.hypot(dx, dy);
    if (d >= rad + r) return null;
    return d > 1e-6 ? { nx: dx / d, ny: dy / d, depth: rad + r - d } : { nx: 1, ny: 0, depth: rad + r };
  }
  const fx = Math.cos(agent.heading), fy = Math.sin(agent.heading);
  const rx = x - agent.x, ry = y - agent.y;
  const lx = rx * fx + ry * fy, ly = -rx * fy + ry * fx; // in the vehicle's frame
  const hx = agent.length / 2, hy = agent.width / 2;
  const dx = lx - clamp(lx, -hx, hx), dy = ly - clamp(ly, -hy, hy);
  const d = Math.hypot(dx, dy);
  let nlx, nly, depth;
  if (d > 1e-6) {
    if (d >= r) return null;
    nlx = dx / d;
    nly = dy / d;
    depth = r - d;
  } else {
    // The centre is inside the rectangle: push out through the nearest side.
    const px = hx - Math.abs(lx), py = hy - Math.abs(ly);
    if (px < py) [nlx, nly, depth] = [Math.sign(lx) || 1, 0, px + r];
    else [nlx, nly, depth] = [0, Math.sign(ly) || 1, py + r];
  }
  return { nx: nlx * fx - nly * fy, ny: nlx * fy + nly * fx, depth };
}

/** Velocity (m/s) of an agent. */
export function agentVelocity(a) {
  if (a.kind === 'pole') return { vx: 0, vy: 0 };
  if (a.kind === 'person') return { vx: a.vx ?? 0, vy: a.vy ?? 0 };
  const s = a.speed ?? 0;
  return { vx: Math.cos(a.heading) * s, vy: Math.sin(a.heading) * s };
}

export const massOf = (a) => COLLISION.massKg[a.kind] ?? 1000;

/**
 * Resolve the contacts of the bike with a list of agents. Moves the bike (and a person) apart,
 * changes the speeds with an impulse, and returns events { type: 'wall', speed (impact speed, m/s), hit: agent }.
 */
export function collideBike(bike, agents) {
  const r = COLLISION.bikeRadius;
  const mb = LOAD.baseMassKg + (bike.loadKg ?? 0);
  const events = [];
  for (const a of agents) {
    const c = contact(a, bike.x, bike.y, r);
    if (!c) continue;
    const ma = massOf(a);
    const inv = 1 / mb + (Number.isFinite(ma) ? 1 / ma : 0);
    // Push apart. A person moves too (by mass); vehicles and poles do not move sideways.
    const bikeShare = a.kind === 'person' ? 1 / mb / inv : 1;
    bike.x += c.nx * c.depth * bikeShare;
    bike.y += c.ny * c.depth * bikeShare;
    if (a.kind === 'person') {
      a.x -= c.nx * c.depth * (1 - bikeShare);
      a.y -= c.ny * c.depth * (1 - bikeShare);
    }
    const va = agentVelocity(a);
    const vn = (bike.vx - va.vx) * c.nx + (bike.vy - va.vy) * c.ny; // < 0: they move into each other
    if (vn >= 0) continue;
    const j = (-(1 + COLLISION.restitution) * vn) / inv;
    bike.vx += (j / mb) * c.nx;
    bike.vy += (j / mb) * c.ny;
    if (Number.isFinite(ma) && a.kind !== 'person' && a.speed !== undefined) {
      // The vehicle stays in its lane: only its speed along the lane changes.
      const along = (-(j / ma) * c.nx) * Math.cos(a.heading) + (-(j / ma) * c.ny) * Math.sin(a.heading);
      a.speed = Math.max(0, a.speed + along);
    }
    events.push({ type: 'wall', speed: -vn, hit: a });
  }
  return events;
}
