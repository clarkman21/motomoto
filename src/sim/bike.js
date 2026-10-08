import { BIKES, PHYSICS, HAZARDS, WORLD, GEARBOX, BRAKES, LOAD, FUEL, COLLISION } from '../config.js';
import { wrapAngle } from '../world/iso.js';
import { addWear, rideWearKm, hitWearKm, powerFactor, energyFactor, brakeFactor } from './maintenance.js';
import { collideBike } from './collide.js';

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
    brakeWearKm: 0, // the part of the service meter that came from the brakes (since the last service)
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
  // After a crash the rider is on the ground: no control, and the bike slides to a stop.
  const crashed = bike.crashed > 0;
  if (crashed) {
    bike.crashed = Math.max(0, bike.crashed - dt);
    input = { throttle: 0, brake: 0, steer: 0 };
  }
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
  bike.engineDead = !engineRuns; // out of fuel or charge, or broken down: you push the bike
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
  // Pushing: you walk the bike at walking speed on any ground (grass and sand too) and up moderate
  // hills (slower uphill). The push beats the rolling resistance and the slope.
  if (bike.pushing) {
    const target = PHYSICS.pushSpeedKmh * KMH * Math.max(0.4, Math.min(1, 1 - grade * 2));
    if (v < target) accel += surface.rollingMs2 + Math.max(0, -slopeAccel) + PHYSICS.pushMs2;
  }
  if (v > vmax) accel -= (v - vmax) * 1.5; // never faster than top speed; a slow surface pulls you down to its limit

  // Brakes. Electric: regen brakes first and charges the battery. Friction brakes do the rest and wear.
  let regenBrake = 0;
  let frictionBrake = 0;
  if (brake > 0 && v > 0.05) {
    const demand = (brake * spec.brakeMs2) / massFactor;
    regenBrake = v > 1 ? Math.min(demand, spec.regenBrakeMs2) : 0;
    frictionBrake = (demand - regenBrake) * brakeFactor(bike);
    accel -= regenBrake + frictionBrake;
  }
  // input.hold: the bike stands at a station (fuel, swap, garage). The brake holds it; it never walks back.
  const reversing = brake > 0 && throttle === 0 && v < 0.3 && !input.hold;
  bike.reversing = reversing; // the rider gets off and walks the bike backwards (see the ride scene)
  if (reversing) {
    // Walk the bike backwards slowly, to get away from a wall. The push must beat the rolling
    // resistance (murram, sand, grass) and a slope behind the bike, like pushing with no fuel.
    const target = -spec.reverseSpeedKmh * KMH;
    if (v > target) accel -= surface.rollingMs2 + Math.max(0, slopeAccel) + PHYSICS.reverseMs2;
  }
  v += accel * dt;

  // Drag always works against motion and never flips its direction.
  let drag = surface.rollingMs2 + PHYSICS.airDragPerMs * Math.abs(v);
  if (throttle === 0 && !bike.pushing && !reversing) {
    // Petrol: engine braking grows with revs, so a downshift slows you without the brakes.
    // With no fuel the engine does not turn: no engine braking, the bike rolls on and slows down slowly.
    if (!engineRuns) drag += PHYSICS.deadEngineDragMs2;
    else if (spec.gears && bike.shiftTimer === 0 && v > 0.5) drag += PHYSICS.engineBrakeMs2 * Math.min(1.2, bike.revs) ** 2;
    else drag += PHYSICS.coastDragMs2;
  }
  if (brake > 0 && v < 0 && !reversing) drag += spec.brakeMs2 * brake;
  if (crashed) drag += COLLISION.slideMs2;
  // On a slope the bike stays still if drag can hold it. This stops a slow creep down gentle ramps.
  const dv = drag * dt;
  if (Math.abs(v) <= dv) v = 0;
  else v -= Math.sign(v) * dv;
  if (reversing) v = Math.max(v, -spec.reverseSpeedKmh * KMH);

  // Brake wear goes on the service meter: proportional to the speed that the friction brakes
  // remove (v · a · dt = change of v²/2). Engine braking and regen do not wear the pads.
  let brakeWearKm = 0;
  if (frictionBrake > 0) {
    brakeWearKm = frictionBrake * Math.abs(v) * dt * BRAKES.serviceKmPerUnit;
    bike.brakeWearKm += brakeWearKm;
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
    // In the red zone too long (manual shift, not in top gear): a hint to shift up and save fuel.
    const red = throttle > 0.5 && !bike.autoShift && bike.gear < spec.gears.length - 1 && bike.revs > GEARBOX.peakRevsEnd;
    bike.redTime = red ? (bike.redTime ?? 0) + dt : 0;
    bike.redHintIn = Math.max(0, (bike.redHintIn ?? 0) - dt);
    if (bike.redTime > GEARBOX.redWarnSeconds && bike.redHintIn === 0) {
      bike.redHintIn = GEARBOX.redWarnEverySeconds;
      events.push({ type: 'redZone' });
    }
  }

  // Grip removes sideways speed. Low grip lets the bike slide.
  lateral *= Math.exp(-PHYSICS.lateralGripRate * surface.grip * dt);

  bike.vx = fwdX * v + rightX * lateral;
  bike.vy = fwdY * v + rightY * lateral;

  // Move in small steps and stop at walls (buildings, trees, water, closed districts).
  const dist = Math.hypot(bike.vx, bike.vy) * dt;
  const steps = Math.max(1, Math.ceil(dist / PHYSICS.maxStepMetres));
  const x0 = bike.x, y0 = bike.y;
  const hits = [];
  for (let i = 0; i < steps; i++) {
    const impact = moveWithCollision(bike, world, (bike.vx * dt) / steps, (bike.vy * dt) / steps);
    if (impact > 0) {
      hits.push({ type: 'wall', speed: impact, hit: null });
      break;
    }
  }
  // Moving things and poles near the bike (set by the game): vehicles, rival motos, people, lamps.
  // Their push must not move the bike into a wall (it would be stuck there).
  const bx = bike.x, by = bike.y, wasFree = !blocked(world, bx, by);
  hits.push(...collideBike(bike, world.dynamicAgents ?? []));
  if (wasFree && blocked(world, bike.x, bike.y)) {
    bike.x = bx;
    bike.y = by;
  }
  for (const h of hits) {
    events.push(h);
    // A hard hit throws the rider off the bike.
    if (h.speed * 3.6 > COLLISION.crashSpeedKmh && !(bike.crashed > 0)) {
      bike.crashed = COLLISION.crashSeconds;
      events.push({ type: 'crash', speed: h.speed, hit: h.hit });
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
  let wearKm = rideWearKm(bike, spec, surface, moved) + brakeWearKm;
  for (const e of events) wearKm += hitWearKm(e);
  events.push(...addWear(bike, wearKm));

  // Energy. Regen braking puts a part of the braking energy back into the battery.
  const fuelRevs = spec.gears ? revsFuelFactor(bike.revs, bike.gear) : 1;
  let use = energyUse(spec, surface, grade, throttle, v, topSpeed) * (throttle > 0 ? fuelRevs * massFactor * energyFactor(bike) : 1);
  if (regenBrake > 0) use -= (spec.regenBrakeFraction * regenBrake * Math.abs(v)) / barInKinetic(spec);
  // A petrol engine uses fuel at idle too: when you coast, wait for a customer or stand in a queue.
  if (spec.gears && throttle === 0 && engineRuns) use += FUEL.idleUse / spec.energySeconds;
  bike.energyRate = use; // fraction of a full bar per second (negative = charging)
  const before = bike.energy;
  bike.energy = clamp(bike.energy - use * dt, 0, 1);
  if (bike.energy > before) bike.regenToday += bike.energy - before;
  if (hasEnergy && bike.energy === 0) events.push({ type: 'empty' });
  return events;
}

/**
 * Petrol: how much more (or less) fuel the engine uses at these revs. Low revs save fuel, the red zone
 * wastes it, and lugging (gear 2 and up, revs too low) wastes it too. 1.0 at about revs 0.74.
 */
export function revsFuelFactor(revs, gear = 1) {
  const r = Math.min(1, Math.max(0, revs));
  const lug = gear > 1 && r < GEARBOX.lugRevs ? GEARBOX.lugFuel * (GEARBOX.lugRevs - r) : 0;
  return GEARBOX.fuelAtIdle + GEARBOX.fuelPerRev * r * r + lug;
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
  return overlap(world, x, y) > 0;
}

/** How many of the probe points around (x, y) (and the centre) are in a wall. 0 = free. */
function overlap(world, x, y) {
  let n = world.isSolidAt(x, y, false) ? 1 : 0;
  for (let i = 0; i < PROBES; i++) {
    const a = (i / PROBES) * Math.PI * 2;
    if (world.isSolidAt(x + Math.cos(a) * COLLISION_RADIUS, y + Math.sin(a) * COLLISION_RADIUS, false)) n++;
  }
  return n;
}

/**
 * Move by (dx, dy). Slide along walls: the speed into the wall bounces back a little.
 * Returns the impact speed (m/s into the wall), or 0 when the bike did not hit anything.
 */
function moveWithCollision(bike, world, dx, dy) {
  if (!blocked(world, bike.x + dx, bike.y + dy)) {
    bike.x += dx;
    bike.y += dy;
    return 0;
  }
  // Already touching a wall (for example pushed there by a crowd): a move that does not go deeper
  // into the wall is free, so the bike can always get away from it.
  const now = overlap(world, bike.x, bike.y);
  if (now > 0 && overlap(world, bike.x + dx, bike.y + dy) <= now) {
    bike.x += dx;
    bike.y += dy;
    return 0;
  }
  const k = PHYSICS.wallBounce;
  let impact;
  if (!blocked(world, bike.x + dx, bike.y)) {
    bike.x += dx;
    impact = Math.abs(bike.vy);
    bike.vy *= -k;
  } else if (!blocked(world, bike.x, bike.y + dy)) {
    bike.y += dy;
    impact = Math.abs(bike.vx);
    bike.vx *= -k;
  } else {
    impact = Math.hypot(bike.vx, bike.vy);
    bike.vx *= -k;
    bike.vy *= -k;
  }
  return Math.max(impact, 1e-3);
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

const ROAD_SURFACES = ['tarmac', 'cobble', 'murram', 'murramWet'];

/**
 * The reset (R) when the bike is stuck: put the bike on the centre of the nearest open road tile
 * and stop it. All other state stays: fuel, wear, brake pads, the load and a breakdown.
 * Returns false if there is no road tile near.
 */
export function resetToRoad(world, bike, maxTiles = 40) {
  const T = WORLD.tileMetres;
  const ox = Math.floor(bike.x / T), oy = Math.floor(bike.y / T);
  const isRoad = (t) => t && ROAD_SURFACES.includes(t.surface) && !t.block && !t.solid && !world.isClosedTile(t);
  for (let r = 0; r <= maxTiles; r++) {
    let best = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // only the ring at distance r
        const t = world.tile(ox + dx, oy + dy);
        if (!isRoad(t)) continue;
        const d = Math.hypot((t.tx + 0.5) * T - bike.x, (t.ty + 0.5) * T - bike.y);
        if (d < bestD) { best = t; bestD = d; }
      }
    }
    if (best) {
      const x = (best.tx + 0.5) * T, y = (best.ty + 0.5) * T;
      Object.assign(bike, { x, y, z: world.heightAt(x, y), vx: 0, vy: 0, surface: world.surfaceAt(x, y), tileKey: null });
      return true;
    }
  }
  return false;
}
