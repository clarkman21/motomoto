import { POLICE, LAW } from '../config.js';

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
      move(o, bike, (POLICE.runKmh / 3.6) * dt, isSolid);
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
      move(o, o.home, (POLICE.walkKmh / 3.6) * dt, () => false); // back to the corner (through the crowd)
      if (Math.hypot(o.home.x - o.x, o.home.y - o.y) < 0.05) {
        Object.assign(o, { x: o.home.x, y: o.home.y, state: 'post' });
      }
    }
  }
  return events;
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
