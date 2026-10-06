import { BIKES, PHYSICS, HAZARDS, WORLD, GEARBOX, BRAKES, LOAD } from '../config.js';
import { wrapAngle } from '../world/iso.js';
import { addWear, rideWearKm, hitWearKm, powerFactor, energyFactor } from './maintenance.js';

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
    gear: 0, // index into spec.gears (petrol only)
    autoShift: false,
    shiftTimer: 0, // seconds left of a gear change (no engine pull)
    revs: 0, // 0..1 of the rev limit (electric: fraction of top speed)
    brakePads: 1, // 1 = new, 0 = fully worn
    brakesWarned: false,
    loadKg: 0, // passenger or cargo
    odometer: 0, // metres ridden today
    offRoadMetres: 0, // metres ridden off road today
    serviceWear: 0, // game km on the service meter since the last service (see maintenance.js)
    brokenDown: false, // true after a breakdown: push the bike to the garage
    offRoad: false,
    pushing: false, // true when you push an empty bike
    regenToday: 0, // energy that regen put back today, as a fraction of a full battery
  };
}

/**
 * Shift up (dir = +1) or down (dir = -1). Returns an event, or null when the
 * gear is already at the end of the box.
 */
export function shiftGear(bike, dir) {
  const gears = BIKES[bike.type].gears;
  if (!gears) return { type: 'noGears' };
  const next = bike.gear + dir;
  if (next < 0 || next >= gears.length) return null;
  const v = Math.max(0, forwardSpeed(bike));
  if (dir < 0 && v / (gears[next].topKmh * KMH) > 1.05) return { type: 'overRev' };
  bike.gear = next;
  bike.shiftTimer = GEARBOX.shiftSeconds;
  return { type: 'shift', gear: next };
}

/** The lowest gear that is not near its rev limit at speed v (m/s). */
export function bestGear(gears, v) {
  const i = gears.findIndex((g) => v / (g.topKmh * KMH) < GEARBOX.autoUpRevs);
  return i === -1 ? gears.length - 1 : i;
}

/** Engine revs 0..1. Petrol: fraction of the gear's top speed. Electric: fraction of top speed. */
export function revsFor(spec, gear, v) {
  const top = spec.gears ? spec.gears[gear].topKmh : spec.topSpeedKmh;
  return clamp(Math.abs(v) / (top * KMH), 0, 1.2);
}

/** How hard the engine pulls (m/s²) at full throttle, before the throttle factor. */
export function enginePull(spec, bike, v) {
  // A slow surface does not cut the engine pull directly. Its rolling resistance does the work.
  if (!spec.gears) return spec.accelMs2 * clamp(1 - v / (spec.topSpeedKmh * KMH * 1.1), 0, 1);
  if (bike.shiftTimer > 0) return 0;
  const g = spec.gears[bike.gear];
  const r = Math.max(0, v) / (g.topKmh * KMH);
  let curve = 1;
  if (r >= 1) curve = 0;
  else if (r > GEARBOX.peakRevsEnd) curve = (1 - r) / (1 - GEARBOX.peakRevsEnd);
  else if (r < GEARBOX.lugRevs && bike.gear > 0) curve = GEARBOX.lugPull + (1 - GEARBOX.lugPull) * (r / GEARBOX.lugRevs);
  return spec.accelMs2 * g.pull * curve;
}

/** Stopping power of the friction brakes for a pad level 0..1. */
export function brakeEfficiency(pads) {
  return BRAKES.wornEfficiency + (1 - BRAKES.wornEfficiency) * pads;
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

  // Gearbox.
  const vStart = v;
  const vmax = topSpeed * surface.speedFactor;
  const hasEnergy = bike.energy > 0;
  const engineRuns = hasEnergy && !bike.brokenDown;
  const throttle = engineRuns ? clamp(input.throttle, 0, 1) : 0;
  const brake = clamp(input.brake, 0, 1);
  bike.shiftTimer = Math.max(0, bike.shiftTimer - dt);
  if (spec.gears && bike.autoShift && bike.shiftTimer === 0) {
    const r = revsFor(spec, bike.gear, v);
    if (r > GEARBOX.autoUpRevs && throttle > 0) shiftGear(bike, 1);
    else if (r < GEARBOX.autoDownRevs) shiftGear(bike, -1);
  }
  bike.revs = revsFor(spec, bike.gear, v);

  // Engine. A load makes the bike heavier, so the same engine force gives less acceleration.
  const massFactor = 1 + bike.loadKg / LOAD.baseMassKg;
  let accel = slopeAccel;
  if (throttle > 0) accel += (throttle * enginePull(spec, bike, v) * powerFactor(bike)) / massFactor;
  // No energy left, or a breakdown: you can only push the bike at walking speed.
  bike.pushing = !engineRuns && input.throttle > 0;
  if (bike.pushing && v < PHYSICS.pushSpeedKmh * KMH) accel += 1.2;
  if (v > vmax) accel -= (v - vmax) * 1.5; // never faster than top speed; a slow surface pulls you down to its limit

  // Brakes. Electric: regen brakes first and charges the battery. Friction brakes do the rest and wear.
  let regenBrake = 0;
  let frictionBrake = 0;
  if (brake > 0 && v > 0.05) {
    const demand = (brake * spec.brakeMs2) / massFactor;
    regenBrake = v > 1 ? Math.min(demand, spec.regenBrakeMs2) : 0;
    frictionBrake = (demand - regenBrake) * brakeEfficiency(bike.brakePads);
    accel -= regenBrake + frictionBrake;
  }
  const reversing = brake > 0 && throttle === 0 && v < 0.3;
  if (reversing) {
    // Walk the bike backwards slowly, to get away from a wall.
    const target = -spec.reverseSpeedKmh * KMH;
    accel += v > target ? -1.5 : 0;
  }
  v += accel * dt;

  // Drag always works against motion and never flips its direction.
  let drag = surface.rollingMs2 + PHYSICS.airDragPerMs * Math.abs(v);
  if (throttle === 0 && !bike.pushing) {
    // Petrol: engine braking grows with revs, so a downshift slows you without the brakes.
    if (spec.gears && bike.shiftTimer === 0 && v > 0.5) drag += PHYSICS.engineBrakeMs2 * Math.min(1.2, bike.revs) ** 2;
    else drag += PHYSICS.coastDragMs2;
  }
  if (brake > 0 && v < 0 && !reversing) drag += spec.brakeMs2 * brake;
  // On a slope the bike stays still if drag can hold it. This stops a slow creep down gentle ramps.
  const dv = drag * dt;
  if (Math.abs(v) <= dv) v = 0;
  else v -= Math.sign(v) * dv;
  if (reversing) v = Math.max(v, -spec.reverseSpeedKmh * KMH);

  // Brake wear: proportional to the speed that the friction brakes remove (v · a · dt = change of v²/2).
  if (frictionBrake > 0) {
    bike.brakePads = Math.max(0, bike.brakePads - frictionBrake * Math.abs(v) * dt * BRAKES.wearPerUnit);
    if (!bike.brakesWarned && bike.brakePads < BRAKES.warnBelow) {
      bike.brakesWarned = true;
      events.push({ type: 'brakesWorn' });
    }
  }

  // Net forward acceleration this step (negative = slowing down). Passengers feel hard braking.
  const netAccel = (v - vStart) / dt;
  bike.netAccel = netAccel;

  // Petrol: warn when the engine struggles in a gear that is too high (lugs, or loses speed at full throttle).
  if (spec.gears) {
    const struggling = throttle > 0.5 && bike.gear > 0 && bike.shiftTimer === 0 &&
      (bike.revs < GEARBOX.lugRevs || (netAccel < -0.2 && bike.revs < 0.7));
    bike.lugTime = struggling ? (bike.lugTime ?? 0) + dt : 0;
    if (bike.lugTime > GEARBOX.lugWarnSeconds && !bike.lugWarned) {
      bike.lugWarned = true;
      events.push({ type: 'lugging' });
    }
    if (bike.lugTime === 0) bike.lugWarned = false;
  }

  // Grip removes sideways speed. Low grip lets the bike slide.
  lateral *= Math.exp(-PHYSICS.lateralGripRate * surface.grip * dt);

  bike.vx = fwdX * v + rightX * lateral;
  bike.vy = fwdY * v + rightY * lateral;

  // Move in small steps and stop at walls.
  const speedBefore = Math.hypot(bike.vx, bike.vy);
  const dist = speedBefore * dt;
  const steps = Math.max(1, Math.ceil(dist / PHYSICS.maxStepMetres));
  const x0 = bike.x, y0 = bike.y;
  for (let i = 0; i < steps; i++) {
    if (moveWithCollision(bike, world, (bike.vx * dt) / steps, (bike.vy * dt) / steps)) {
      events.push({ type: 'wall', speed: speedBefore });
      break;
    }
  }
  const moved = Math.hypot(bike.x - x0, bike.y - y0);
  bike.odometer += moved;
  if (surface.offRoad) bike.offRoadMetres += moved;
  // Tell the rider once each time the bike leaves the road.
  const offRoad = !!surface.offRoad && Math.abs(v) > 1;
  if (offRoad && !bike.offRoad) events.push({ type: 'offRoad' });
  if (!surface.offRoad) bike.offRoad = false;
  else if (offRoad) bike.offRoad = true;
  bike.z = world.heightAt(bike.x, bike.y);

  // Hazards trigger once when you enter their tile.
  const tile = world.tileAt(bike.x, bike.y);
  const key = tile ? tile.tx + ',' + tile.ty : null;
  if (key !== bike.tileKey) {
    bike.tileKey = key;
    if (tile?.hazard) events.push(...hitHazard(bike, tile.hazard));
  }
  bike.bump = Math.max(0, bike.bump - dt);

  // Maintenance: the service meter fills with distance (more on bad roads and in the red zone) and with hits.
  let wearKm = rideWearKm(bike, spec, surface, moved);
  for (const e of events) wearKm += hitWearKm(e);
  events.push(...addWear(bike, wearKm));

  // Energy. Regen braking puts a part of the braking energy back into the battery.
  const fuelRevs = spec.gears ? GEARBOX.fuelAtIdle + GEARBOX.fuelPerRev * Math.min(1, bike.revs) : 1;
  let use = energyUse(spec, surface, grade, throttle, v, topSpeed) * (throttle > 0 ? fuelRevs * massFactor * energyFactor(bike) : 1);
  if (regenBrake > 0) use -= (spec.regenBrakeFraction * regenBrake * Math.abs(v)) / barInKinetic(spec);
  bike.energyRate = use; // fraction of a full bar per second (negative = charging)
  const before = bike.energy;
  bike.energy = clamp(bike.energy - use * dt, 0, 1);
  if (bike.energy > before) bike.regenToday += bike.energy - before;
  if (hasEnergy && bike.energy === 0) events.push({ type: 'empty' });
  return events;
}

/**
 * A full energy bar expressed as kinetic energy per kg (m²/s²): full throttle
 * power at half top speed for the full bar time. Used to convert regen braking.
 */
function barInKinetic(spec) {
  return spec.energySeconds * spec.accelMs2 * spec.topSpeedKmh * KMH * 0.5;
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
