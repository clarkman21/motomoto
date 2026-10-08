import { BALANCE, JOBS, MONEY, MAINTENANCE, LAW, SAVINGS_FLOAT, LEVELS, FLEET } from '../config.js';
import { makeOffer, mulberry32, tripMetres } from './jobs.js';
import { legFuel } from './fuel.js';
import { districtsForLevel } from './levels.js';

// A model of the money in one day, to see if the levels can be passed and how long each takes.
// It samples real job offers from the map, and uses a player profile (BALANCE.players): how fast the
// player rides on average, the time lost at each job, the tips, the fines and the crashes.
// It is a model, not a real ride: use it to compare levels and to see the effect of a change.
// No Phaser here. `npm run balance` prints the table.

/**
 * Sample n jobs for a level: the average pay, the average trip and the average ride from the last
 * drop off to the next pickup (the player takes the jobs one after the other).
 */
export function sampleJobs(world, level, n = BALANCE.sampleJobs, seed = 7) {
  const rng = mulberry32(seed);
  const opts = { fareMultiplier: level.fare, districts: districtsForLevel(level.n) };
  let pay = 0, trip = 0, approach = 0, kg = 0, last = null;
  for (let i = 0; i < n; i++) {
    const o = makeOffer(world, rng, i, opts);
    pay += o.pay;
    trip += o.distanceMetres;
    kg += o.kg;
    if (last) approach += tripMetres(last, o.from);
    last = o.to;
  }
  return { pay: pay / n, tripMetres: trip / n, approachMetres: approach / Math.max(1, n - 1), kg: kg / n };
}

/** The expected money from one hired rider in one day (rent, less costs and bad days). */
export function fleetDayNet() {
  const avgRepair = (FLEET.repair[0] + FLEET.repair[1]) / 2;
  return FLEET.rentPerDay * (1 - FLEET.badDayChance / 2) - FLEET.costPerDay - (FLEET.badDayChance / 2) * avgRepair;
}

/** The money of one day at a level, for a player profile. jobs: from sampleJobs. riders: hired riders. */
export function dayEstimate(level, jobs, player, bikeType = 'petrol', riders = 0) {
  const metresPerJob = jobs.tripMetres + jobs.approachMetres;
  const rideSeconds = metresPerJob / (player.kmh / 3.6);
  const jobSeconds = rideSeconds + player.overheadSeconds;
  const jobsPerDay = level.shift.realSeconds / jobSeconds;
  const income = jobsPerDay * jobs.pay * (1 + player.tip);
  // Energy: the empty ride to the pickup, then the trip with the load. A fill costs fuelFullTank for a
  // full tank; a swap costs swapFee for a full battery (whatever is left).
  const tank = legFuel(bikeType, jobs.approachMetres, 0, 0) + legFuel(bikeType, jobs.tripMetres, 0, jobs.kg);
  const energy = jobsPerDay * tank * (bikeType === 'electric' ? MONEY.swapFee : MONEY.fuelFullTank * level.petrol);
  const gameKm = (jobsPerDay * metresPerJob) / JOBS.gameKmMetres;
  const service = (gameKm / MAINTENANCE.intervalKm[bikeType]) * MAINTENANCE.serviceCost[bikeType];
  const fines = player.finesPerDay * (level.cameras ? LAW.cameraFine : BALANCE.policeFine);
  const repairs = player.crashesPerDay * BALANCE.crashCost;
  const costs = level.rent + energy + service + fines + repairs;
  const fleet = riders * fleetDayNet();
  return { jobsPerDay, income, energy, service, fines, repairs, rent: level.rent, costs, fleet, profit: income + fleet - costs };
}

/**
 * How many days to pass each level: save the goal plus SAVINGS_FLOAT, from the cash you have at
 * the start of the level. Returns one row for each level and player: { level, player, profit, days }.
 * days is Infinity when the profit is 0 or less (the level cannot be passed: game over).
 */
export function levelReport(world, players = BALANCE.players) {
  const rows = [];
  for (const [name, player] of Object.entries(players)) {
    let cash = MONEY.startCash;
    for (const level of LEVELS) {
      if (level.freePlay) continue;
      const bikeType = level.n > 4 ? 'electric' : 'petrol';
      const riders = LEVELS.filter((l) => l.n < level.n && (l.effect === 'rider1' || l.effect === 'rider2')).length;
      const day = dayEstimate(level, sampleJobs(world, level), player, bikeType, riders);
      const need = level.goal + SAVINGS_FLOAT - cash;
      const days = day.profit > 0 ? Math.max(1, Math.ceil(need / day.profit)) : Infinity;
      rows.push({ level: level.n, player: name, ...day, days });
      cash = Number.isFinite(days) ? cash + days * day.profit - level.goal : cash;
    }
  }
  return rows;
}
