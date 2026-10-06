import { BIKES, PHYSICS, HAZARDS, WORLD } from '../config.js';
import { wrapAngle } from '../world/iso.js';

// Arcade bike physics. No Phaser here, so the tests can run it.
// Position is in metres, speed in m/s, heading in radians (0 = +x).

const KMH = 1 / 3.6;
const COLLISION_RADIUS = 0.55; // metres
const PROBES = 8;

export function createBike(world, type = 'petrol') {
  const s = world.start;
  return {
    type,
    x: s.x * WORLD.tileMetres,
    y: s.y * WORLD.tileMetres,
    z: world.heightAt(s.x * WORLD.tileMetres, s.y * WORLD.tileMetres),
    heading: (s.headingDeg * Math.PI) / 180,
    vx: 0,
    vy: 0,
    energy: 1, // 0..1
    grade: 0, // rise per metre along the heading, + is uphill
    surface: world.surfaceAt(s.x * WORLD.tileMetres, s.y * WORLD.tileMetres),
    tileKey: null,
    bump: 0, // seconds left of the bump bounce animation
  };
}

/** Forward speed in m/s (negative when you roll backwards). */
export function forwardSpeed(bike) {
  return bike.vx * Math.cos(bike.heading) + bike.vy * Math.sin(bike.heading);
}

/**
 * Advance the bike by dt seconds.
 * input: { throttle 0..1, brake 0..1, steer -1..1 (+ turns clockwise on screen) }
 * Returns a list of events, for example { type: 'pothole' }.
 */
export function stepBike(bike, input, world, dt) {
  const spec = BIKES[bike.type];
  const events = [];
  const topSpeed = spec.topSpeedKmh * KMH;
  const surface = world.surfaceAt(bike.x, bike.y);
  bike.surface = surface;

  // Split velocity into forward and sideways parts.
  let fwdX = Math.cos(bike.heading), fwdY = Math.sin(bike.heading);
  let v = bike.vx * fwdX + bike.vy * fwdY;

  // Steering. Turn rate falls with speed, and you cannot turn when you stand still.
  const speedFrac = Math.min(1, Math.abs(v) / topSpeed);
  const lowSpeedFactor = Math.min(1, Math.abs(v) / PHYSICS.minSpeedToTurnMs);
  const turnRate = PHYSICS.maxTurnRateRad * (1 - (1 - PHYSICS.turnRateAtTopSpeed) * speedFrac) * lowSpeedFactor;
  bike.heading = wrapAngle(bike.heading + clamp(input.steer, -1, 1) * turnRate * Math.sign(v || 1) * dt);
  fwdX = Math.cos(bike.heading);
  fwdY = Math.sin(bike.heading);
  const rightX = -fwdY, rightY = fwdX;
  v = bike.vx * fwdX + bike.vy * fwdY;
  let lateral = bike.vx * rightX + bike.vy * rightY;

  // Slope along the heading. Positive grade = uphill.
  const slope = world.slopeAt(bike.x, bike.y);
  const grade = slope.dx * fwdX + slope.dy * fwdY;
  bike.grade = grade;
  const slopeAccel = -PHYSICS.gravity * Math.sin(Math.atan(grade)) * PHYSICS.hillFactor;

  // Engine and brakes.
  const vmax = topSpeed * surface.speedFactor;
  const hasEnergy = bike.energy > 0;
  const throttle = hasEnergy ? clamp(input.throttle, 0, 1) : 0;
  const brake = clamp(input.brake, 0, 1);
  let accel = slopeAccel;
  // The engine force falls to zero a little above top speed, so drag cannot hold you far below it.
  if (throttle > 0) accel += throttle * spec.accelMs2 * clamp(1 - v / (vmax * 1.1), 0, 1);
  if (v > vmax) accel -= (v - vmax) * 1.5; // never faster than top speed; a slow surface pulls you down to its limit
  const reversing = brake > 0 && throttle === 0 && v < 0.3;
  if (brake > 0 && v > 0.05) accel -= brake * spec.brakeMs2;
  if (reversing) {
    // Walk the bike backwards slowly, to get away from a wall.
    const target = -spec.reverseSpeedKmh * KMH;
    accel += v > target ? -1.5 : 0;
  }
  v += accel * dt;

  // Drag always works against motion and never flips its direction.
  let drag = PHYSICS.rollingDragMs2 + PHYSICS.airDragPerMs * Math.abs(v);
  if (throttle === 0) drag += PHYSICS.coastDragMs2;
  if (brake > 0 && v < 0 && !reversing) drag += spec.brakeMs2 * brake;
  // On a slope the bike stays still if drag can hold it. This stops a slow creep down gentle ramps.
  const dv = drag * dt;
  if (Math.abs(v) <= dv) v = 0;
  else v -= Math.sign(v) * dv;
  if (reversing) v = Math.max(v, -spec.reverseSpeedKmh * KMH);

  // Grip removes sideways speed. Low grip lets the bike slide.
  lateral *= Math.exp(-PHYSICS.lateralGripRate * surface.grip * dt);

  bike.vx = fwdX * v + rightX * lateral;
  bike.vy = fwdY * v + rightY * lateral;

  // Move in small steps and stop at walls.
  const speedBefore = Math.hypot(bike.vx, bike.vy);
  const dist = speedBefore * dt;
  const steps = Math.max(1, Math.ceil(dist / PHYSICS.maxStepMetres));
  for (let i = 0; i < steps; i++) {
    if (moveWithCollision(bike, world, (bike.vx * dt) / steps, (bike.vy * dt) / steps)) {
      events.push({ type: 'wall', speed: speedBefore });
      break;
    }
  }
  bike.z = world.heightAt(bike.x, bike.y);

  // Hazards trigger once when you enter their tile.
  const tile = world.tileAt(bike.x, bike.y);
  const key = tile ? tile.tx + ',' + tile.ty : null;
  if (key !== bike.tileKey) {
    bike.tileKey = key;
    if (tile?.hazard) events.push(...hitHazard(bike, tile.hazard));
  }
  bike.bump = Math.max(0, bike.bump - dt);

  // Energy.
  bike.energy = clamp(bike.energy - energyUse(spec, surface, grade, throttle, v, topSpeed) * dt, 0, 1);
  if (hasEnergy && bike.energy === 0) events.push({ type: 'empty' });
  return events;
}

/** Energy per second as a fraction of a full bar. Negative = regen. */
export function energyUse(spec, surface, grade, throttle, v, topSpeed) {
  const base = 1 / spec.energySeconds;
  const steep = Math.min(1, Math.abs(grade) / PHYSICS.fullUphillGrade);
  if (grade < 0 && spec.regenFraction > 0 && throttle === 0 && v > 1) {
    // Regen gives back a fraction of what the same climb would cost.
    const climbCost = base * spec.uphillEnergyFactor * steep;
    return -spec.regenFraction * climbCost * Math.min(1, v / (topSpeed * 0.4));
  }
  let slopeFactor = 1;
  if (grade > 0) slopeFactor = 1 + (spec.uphillEnergyFactor - 1) * steep;
  else if (grade < 0) slopeFactor = 1 + (spec.downhillEnergyFactor - 1) * steep;
  return base * throttle * slopeFactor * surface.energyFactor;
}

function hitHazard(bike, hazard) {
  const v = Math.hypot(bike.vx, bike.vy);
  if (hazard === 'pothole') {
    scaleSpeed(bike, 1 - HAZARDS.pothole.speedCut);
    bike.bump = 0.3;
    return [{ type: 'pothole' }];
  }
  if (hazard === 'speedBump') {
    bike.bump = 0.25;
    if (v > HAZARDS.speedBump.safeSpeedKmh * KMH) {
      scaleSpeed(bike, 1 - HAZARDS.speedBump.speedCut);
      return [{ type: 'bumpHard' }];
    }
    return [{ type: 'bumpSoft' }];
  }
  return [];
}

function scaleSpeed(bike, k) {
  bike.vx *= k;
  bike.vy *= k;
}

function blocked(world, x, y) {
  if (world.isSolidAt(x, y)) return true;
  for (let i = 0; i < PROBES; i++) {
    const a = (i / PROBES) * Math.PI * 2;
    if (world.isSolidAt(x + Math.cos(a) * COLLISION_RADIUS, y + Math.sin(a) * COLLISION_RADIUS)) return true;
  }
  return false;
}

/** Move by (dx, dy). Slide along walls. Returns true when the bike hit a wall. */
function moveWithCollision(bike, world, dx, dy) {
  if (!blocked(world, bike.x + dx, bike.y + dy)) {
    bike.x += dx;
    bike.y += dy;
    return false;
  }
  const k = PHYSICS.wallBounce;
  if (!blocked(world, bike.x + dx, bike.y)) {
    bike.x += dx;
    bike.vy *= -k;
  } else if (!blocked(world, bike.x, bike.y + dy)) {
    bike.y += dy;
    bike.vx *= -k;
  } else {
    bike.vx *= -k;
    bike.vy *= -k;
  }
  return true;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}
