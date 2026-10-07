import { WORLD, FUEL, LOAD } from '../config.js';
import { tripMetres } from './jobs.js';

// Fuel estimates for jobs. No Phaser here.
// The bike uses more fuel with more weight (a passenger or cargo), uphill, on murram and at
// high revs (see bike.js). These estimates use the distance, the climb on the way and the load,
// so each job card can say how much fuel it needs.

const T = WORLD.tileMetres;

/** Metres of climb (the sum of the rises) on a road path from a to b (tile positions): along x, then along y. */
export function routeClimb(world, a, b) {
  const corner = { x: b.x, y: a.y };
  let climb = 0;
  for (const [p, q] of [[a, corner], [corner, b]]) {
    const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y)));
    let z = world.heightAt(p.x * T, p.y * T);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const z2 = world.heightAt((p.x + (q.x - p.x) * t) * T, (p.y + (q.y - p.y) * t) * T);
      if (z2 > z) climb += z2 - z;
      z = z2;
    }
  }
  return climb;
}

/** Tank fraction for one leg: distance (metres), climb (metres) and the load (kg). */
export function legFuel(type, metres, climb, kg = 0) {
  const mass = 1 + kg / LOAD.baseMassKg;
  return ((metres / 1000) * FUEL.flatTankPerKm[type] + climb * FUEL.tankPerClimbMetre[type]) * mass * FUEL.margin;
}

/**
 * Fuel (tank fraction) for a job from where the bike is now: the ride to the pickup with no load
 * (if you have not picked up yet), then the trip with the passenger or cargo.
 * bike: { type, x, y } (metres). job: { from, to, kg, stage? }.
 */
export function jobFuel(world, bike, job) {
  const here = { x: bike.x / T, y: bike.y / T };
  const loaded = job.stage === 'toDropoff';
  let fuel = 0;
  if (!loaded) fuel += legFuel(bike.type, tripMetres(here, job.from), routeClimb(world, here, job.from), 0);
  const start = loaded ? here : job.from;
  fuel += legFuel(bike.type, tripMetres(start, job.to), routeClimb(world, start, job.to), job.kg ?? 0);
  return fuel;
}
