import { JOBS, WORLD, RIVALS, DISTRICTS } from '../config.js';
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

const SERVICE_TAGS = ['fuel', 'swap', 'garage', 'office'];
// Places for jobs. opts.districts limits them to the districts of the level (places without a district always count).
const jobPlaces = (world, opts = {}) =>
  world.places.filter((p) => !p.tags.some((t) => SERVICE_TAGS.includes(t)) && (!opts.districts || !p.district || opts.districts.includes(p.district)));
export { jobPlaces };
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
// Pick by weight: busy places (the bus park, markets) start more jobs.
function pickWeighted(rng, list) {
  const total = list.reduce((a, p) => a + (p.weight ?? 1), 0);
  let r = rng() * total;
  for (const p of list) if ((r -= p.weight ?? 1) <= 0) return p;
  return list[list.length - 1];
}
/** Fare factor of the district where a job starts (rich districts pay more). */
const districtFares = (place) => DISTRICTS[place?.district]?.fares ?? 1;

/** How long an app offer stays: rivals take offers, so some go fast. */
function offerLife(rng, range = RIVALS.offerLifeSeconds) {
  const [lo, hi] = range;
  return lo + rng() * (hi - lo);
}

/**
 * opts: { fareMultiplier, offerLife: [lo, hi], districts } from the level (all optional).
 */
export function makeOffer(world, rng, id, opts = {}) {
  const places = jobPlaces(world, opts);
  const passenger = rng() < JOBS.passengerChance;
  const starts = passenger ? places : places.filter((p) => p.tags.includes('market'));
  const ends = passenger ? places : places.filter((p) => !p.tags.includes('market'));
  let from, to;
  for (let i = 0; i < 30; i++) {
    from = pickWeighted(rng, starts);
    to = pick(rng, ends);
    if (from !== to && tripMetres(from, to) >= JOBS.minTripMetres) break;
  }
  const distanceMetres = tripMetres(from, to);
  const gameKm = distanceMetres / JOBS.gameKmMetres;
  const fare = (opts.fareMultiplier ?? 1) * districtFares(from);
  if (passenger) {
    const p = JOBS.passenger;
    return { id, type: 'passenger', from, to, distanceMetres, gameKm, kg: p.kg, fragile: false, pay: round10((p.base + p.perGameKm * gameKm) * fare), age: 0, life: offerLife(rng, opts.offerLife) };
  }
  const c = JOBS.cargo;
  const kg = Math.round((c.kgMin + rng() * (c.kgMax - c.kgMin)) / 5) * 5;
  const fragile = rng() < c.fragileChance;
  // What the cargo is: a bunch of bananas (fragile: they bruise) or a big sack of rice.
  const goods = fragile ? 'bananas' : 'rice';
  return { id, type: 'cargo', goods, from, to, distanceMetres, gameKm, kg, fragile, pay: round10((c.base + c.perGameKm * gameKm + c.perKg * kg) * fare), age: 0, life: offerLife(rng, opts.offerLife) };
}

/** A street hail: a passenger who waves at the roadside. It starts at the drop off stage (the customer gets on at once). */
export function makeHailJob(hail, id, fareMultiplier = 1) {
  const distanceMetres = tripMetres(hail.from, hail.to);
  const gameKm = distanceMetres / JOBS.gameKmMetres;
  const p = JOBS.passenger;
  return { id, type: 'passenger', hail: true, from: hail.from, to: hail.to, distanceMetres, gameKm, kg: p.kg, fragile: false, pay: round10((p.base + p.perGameKm * gameKm) * fareMultiplier), age: 0 };
}

/** Take a street hail: the customer is on the bike, go to the drop off. */
export function acceptHail(board, hail, bike) {
  if (board.active) return null;
  board.active = { ...makeHailJob(hail, board.nextId++, board.opts.fareMultiplier ?? 1), stage: 'toDropoff', comfort: 100, damage: 0, clean: true };
  bike.loadKg = board.active.kg;
  bike.loadType = 'passenger';
  return board.active;
}

/** opts: { fareMultiplier, offerLife, districts, maxOffers } from the level (all optional). */
export function createJobBoard(world, seed = 1, opts = {}) {
  const board = { rng: mulberry32(seed), offers: [], active: null, nextId: 1, opts };
  refill(board, world);
  return board;
}

function refill(board, world) {
  while (board.offers.length < (board.opts.maxOffers ?? JOBS.maxOffers)) board.offers.push(makeOffer(world, board.rng, board.nextId++, board.opts));
}

/** Age the offers, remove old ones and add new ones. */
export function updateBoard(board, world, dt) {
  for (const o of board.offers) o.age += dt;
  board.offers = board.offers.filter((o) => o.age < (o.life ?? JOBS.offerLifeSeconds));
  refill(board, world);
}

/** Accept offer number index (0-based). Returns the active job, or null. */
export function acceptOffer(board, index) {
  if (board.active || !board.offers[index]) return null;
  const [offer] = board.offers.splice(index, 1);
  board.active = { ...offer, stage: 'toPickup', comfort: 100, damage: 0, clean: true };
  return board.active;
}

/** Give up the active job (no pay). The passenger or the cargo leaves the bike. */
export function cancelJob(board, bike) {
  board.active = null;
  bike.loadKg = 0;
  bike.loadType = null;
}

/**
 * Out of fuel (or charge), or a breakdown, during a job: when the bike has rolled to a stop, the
 * passenger gets off and takes another moto, or the customer sends the cargo with another moto.
 * You lose the fare. speed: the bike speed in m/s. Returns the lost job, or null.
 */
export function loseJobWhenEmpty(board, bike, speed) {
  const stuck = bike.energy <= 0 || bike.brokenDown;
  if (!board.active || !stuck || Math.abs(speed) * 3.6 > JOBS.loseJobBelowKmh) return null;
  const lost = board.active;
  cancelJob(board, bike);
  return lost;
}

/** The place the rider must go to now. */
/**
 * The passenger waits on the bike (a station stop, or you push the bike): comfort goes down.
 * start: true at the start of a stop. Returns true if a passenger is on the bike.
 */
export function passengerWaits(board, dt, start = false) {
  const job = board.active;
  if (!job || job.type !== 'passenger' || job.stage !== 'toDropoff') return false;
  job.comfort = Math.max(0, job.comfort - (start ? JOBS.waitComfort.atStop : JOBS.waitComfort.perSecond * dt));
  return true;
}

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
    bike.loadType = job.type === 'cargo' ? job.goods ?? 'rice' : job.type;
    return [{ type: 'pickup', job }];
  }
  board.active = null;
  bike.loadKg = 0;
  bike.loadType = null;
  // A job pays only once, whatever happens (a guard against double payments).
  if (job.paid) return [];
  job.paid = true;
  if (job.type === 'passenger') {
    const tip = round10(job.pay * JOBS.passenger.maxTipFraction * (job.comfort / 100));
    return [{ type: 'delivered', job, fare: job.pay, tip }];
  }
  return [{ type: 'delivered', job, fare: round10(job.pay * (1 - job.damage)), tip: 0 }];
}
