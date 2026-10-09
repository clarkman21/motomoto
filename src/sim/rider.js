import { RIDER } from '../config.js';

// Rider energy (hard mode): the rider must eat. No Phaser here.
// rider = { energy (0..1), slowUntil, crashUntil (game hours), hungryWarned, weakWarned }.

export function createRider() {
  return { energy: RIDER.startEnergy, slowUntil: -1, crashUntil: -1, hungryWarned: false, weakWarned: false };
}

/** How fast energy goes down now (per game hour): ikivuguto slows it, an energy drink wears off. */
export function drainRate(rider, hour, pushing = false) {
  let r = RIDER.drainPerHour * (pushing ? RIDER.pushDrainFactor : 1);
  if (hour < rider.slowUntil) r *= RIDER.foods.ikivuguto.slowFactor;
  if (hour < rider.crashUntil) r *= RIDER.foods.drink.crashFactor;
  return r;
}

/** Advance by dHours of the game clock. Returns events: { type: 'hungry' } once below hungryAt, { type: 'weak' } at 0. */
export function stepRider(rider, hour, dHours, pushing = false) {
  rider.energy = Math.max(0, rider.energy - drainRate(rider, hour, pushing) * dHours);
  const events = [];
  if (rider.energy < RIDER.hungryAt && !rider.hungryWarned) {
    rider.hungryWarned = true;
    events.push({ type: 'hungry' });
  }
  if (rider.energy <= 0 && !rider.weakWarned) {
    rider.weakWarned = true;
    events.push({ type: 'weak' });
  }
  return events;
}

/** The engine power factor from the rider's energy: 1, less when hungry, least when weak. */
export function riderPower(rider) {
  if (!rider) return 1;
  if (rider.energy <= 0) return RIDER.weakPower;
  if (rider.energy < RIDER.hungryAt) {
    // From hungryPower at hungryAt down to weakPower at 0.
    const k = rider.energy / RIDER.hungryAt;
    return RIDER.weakPower + (RIDER.hungryPower - RIDER.weakPower) * k;
  }
  return 1;
}

/** Can you buy this food now? Returns { ok, reason: 'hours' | 'full' }. */
export function canEat(rider, food, hour) {
  const f = RIDER.foods[food];
  if (f.fromHour !== undefined && (hour < f.fromHour || hour >= f.toHour)) return { ok: false, reason: 'hours' };
  if (rider.energy > 0.97) return { ok: false, reason: 'full' };
  return { ok: true };
}

/** Eat or drink: energy goes up, and the special effects start. */
export function eat(rider, food, hour) {
  const f = RIDER.foods[food];
  rider.energy = Math.min(1, rider.energy + f.energy);
  if (f.slowHours) rider.slowUntil = hour + f.slowHours;
  if (f.crashHours) rider.crashUntil = hour + f.crashHours;
  if (rider.energy >= RIDER.hungryAt) rider.hungryWarned = false;
  if (rider.energy > 0) rider.weakWarned = false;
  return rider;
}
