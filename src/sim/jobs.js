import { JOBS, WORLD } from '../config.js';
import { forwardSpeed } from './bike.js';
import { round10 } from './economy.js';

// Jobs: passenger and cargo trips between places on the map. No Phaser here.
// An offer becomes the active job when you accept it. The active job has two stages:
// 'toPickup' (ride to the start place and stop) and 'toDropoff' (ride to the end place and stop).

/** Small seeded random number generator, so a test or a replay gets the same jobs. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Road distance estimate between two places (metres): the grid distance, because roads follow the grid. */
export function tripMetres(a, b) {
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * WORLD.tileMetres;
}

const jobPlaces = (world) => world.places.filter((p) => !p.tags.includes('fuel') && !p.tags.includes('swap'));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export function makeOffer(world, rng, id) {
  const places = jobPlaces(world);
  const passenger = rng() < JOBS.passengerChance;
  const starts = passenger ? places : places.filter((p) => p.tags.includes('market'));
  const ends = passenger ? places : places.filter((p) => !p.tags.includes('market'));
  let from, to;
  for (let i = 0; i < 30; i++) {
    from = pick(rng, starts);
    to = pick(rng, ends);
    if (from !== to && tripMetres(from, to) >= JOBS.minTripMetres) break;
  }
  const distanceMetres = tripMetres(from, to);
  const gameKm = distanceMetres / JOBS.gameKmMetres;
  if (passenger) {
    const p = JOBS.passenger;
    return { id, type: 'passenger', from, to, distanceMetres, gameKm, kg: p.kg, fragile: false, pay: round10(p.base + p.perGameKm * gameKm), age: 0 };
  }
  const c = JOBS.cargo;
  const kg = Math.round((c.kgMin + rng() * (c.kgMax - c.kgMin)) / 5) * 5;
  const fragile = rng() < c.fragileChance;
  return { id, type: 'cargo', from, to, distanceMetres, gameKm, kg, fragile, pay: round10(c.base + c.perGameKm * gameKm + c.perKg * kg), age: 0 };
}

export function createJobBoard(world, seed = 1) {
  const board = { rng: mulberry32(seed), offers: [], active: null, nextId: 1 };
  refill(board, world);
  return board;
}

function refill(board, world) {
  while (board.offers.length < JOBS.maxOffers) board.offers.push(makeOffer(world, board.rng, board.nextId++));
}

/** Age the offers, remove old ones and add new ones. */
export function updateBoard(board, world, dt) {
  for (const o of board.offers) o.age += dt;
  board.offers = board.offers.filter((o) => o.age < JOBS.offerLifeSeconds);
  refill(board, world);
}

/** Accept offer number index (0-based). Returns the active job, or null. */
export function acceptOffer(board, index) {
  if (board.active || !board.offers[index]) return null;
  const [offer] = board.offers.splice(index, 1);
  board.active = { ...offer, stage: 'toPickup', comfort: 100, damage: 0 };
  return board.active;
}

/** Give up the active job (no pay). The passenger or the cargo leaves the bike. */
export function cancelJob(board, bike) {
  board.active = null;
  bike.loadKg = 0;
  bike.loadType = null;
}

/** The place the rider must go to now. */
export function jobTarget(job) {
  return job.stage === 'toPickup' ? job.from : job.to;
}

/**
 * Update the active job for one physics step. bikeEvents are the events from stepBike.
 * Returns events: { type: 'pickup', job } or { type: 'delivered', job, fare, tip }.
 */
export function updateJob(board, bike, bikeEvents, dt) {
  const job = board.active;
  if (!job) return [];
  // Ride quality while the passenger or the cargo is on the bike.
  if (job.stage === 'toDropoff') {
    for (const e of bikeEvents) {
      if (e.type === 'wall' && e.speed < 4) continue;
      if (job.type === 'passenger') job.comfort -= JOBS.comfortLoss[e.type] ?? 0;
      else if (job.fragile) job.damage += JOBS.cargoDamage[e.type] ?? 0;
    }
    if (job.type === 'passenger' && (bike.netAccel ?? 0) < -JOBS.hardBrakeMs2) job.comfort -= JOBS.comfortLoss.hardBrakePerSecond * dt;
    // Off road is a rough ride: the passenger is unhappy and fragile cargo gets damaged.
    if (bike.offRoad) {
      if (job.type === 'passenger') job.comfort -= JOBS.comfortLoss.offRoadPerSecond * dt;
      else if (job.fragile) job.damage += JOBS.cargoDamage.offRoadPerSecond * dt;
    }
    job.comfort = Math.max(0, Math.min(100, job.comfort));
    job.damage = Math.max(0, Math.min(1, job.damage));
  }
  const target = jobTarget(job);
  const d = Math.hypot(bike.x - target.x * WORLD.tileMetres, bike.y - target.y * WORLD.tileMetres);
  const slow = Math.abs(forwardSpeed(bike)) * 3.6 < JOBS.stopSpeedKmh;
  if (d > JOBS.arriveRadiusMetres || !slow) return [];
  if (job.stage === 'toPickup') {
    job.stage = 'toDropoff';
    bike.loadKg = job.kg;
    bike.loadType = job.type;
    return [{ type: 'pickup', job }];
  }
  board.active = null;
  bike.loadKg = 0;
  bike.loadType = null;
  if (job.type === 'passenger') {
    const tip = round10(job.pay * JOBS.passenger.maxTipFraction * (job.comfort / 100));
    return [{ type: 'delivered', job, fare: job.pay, tip }];
  }
  return [{ type: 'delivered', job, fare: round10(job.pay * (1 - job.damage)), tip: 0 }];
}
