import { MISSIONS, JOBS } from '../config.js';
import { round10 } from './economy.js';
import { makeOffer, tripMetres, jobPlaces } from './jobs.js';

// The Umuganda run (Alp): a bonus mission on an Umuganda morning. Take a passenger who is late for
// Umuganda, or tools and water, to the roadside Umuganda work site against the clock. Motos may not
// ride during Umuganda: police patrol cars drive the main roads, and officers stand at the corners.
// On the murram back roads you are safe. No Phaser here.

const U = MISSIONS.umuganda;

/**
 * A new Umuganda run offer, or null when no work site is far enough. opts: the board options
 * (districts, fareMultiplier). The destination is a copy of a job place, named as the work site.
 */
export function umugandaOffer(world, rng, id, opts = {}) {
  const base = makeOffer(world, rng, id, opts);
  const places = jobPlaces(world, opts);
  // A far work site; on a small map, one of the three farthest.
  const others = places.filter((p) => p !== base.from).sort((a, b) => tripMetres(base.from, b) - tripMetres(base.from, a));
  const far = others.filter((p) => tripMetres(base.from, p) >= U.minTripMetres);
  const ends = far.length ? far : others.slice(0, 3);
  if (!ends.length) return null;
  const site = ends[Math.floor(rng() * ends.length)];
  const to = { ...site, name: `Umuganda work site, ${site.name}` };
  const passenger = base.type === 'passenger';
  const o = {
    ...base, to, life: U.offerLife,
    ...(passenger ? { kg: JOBS.passenger.kg, goods: undefined, fragile: false } : { type: 'cargo', goods: 'tools', kg: U.cargoKg, fragile: false }),
  };
  o.distanceMetres = tripMetres(o.from, o.to);
  o.gameKm = o.distanceMetres / JOBS.gameKmMetres;
  o.pay = round10(base.pay * (base.distanceMetres ? o.distanceMetres / base.distanceMetres : 1) * U.payFactor);
  o.mission = {
    kind: 'umuganda', title: 'UMUGANDA RUN', bonus: round10(o.pay * U.bonusFactor),
    limit: Math.round(o.distanceMetres / U.metresPerSecond + U.extraSeconds),
  };
  return o;
}

/** Is (x, y) on a main road (tarmac or cobblestone), where the police look for motos? */
export function onMainRoad(world, x, y) {
  const t = world.tileAt(x, y);
  return !!t && (t.surface === 'tarmac' || t.surface === 'cobble');
}

/**
 * The patrol cars, each frame. state: { spot: null | { car, t } }. cars: the police vehicles.
 * carrying: you have the passenger or the tools on the bike. mainRoad: you are on a main road.
 * A patrol car sees you within patrolSeeMetres (in front of it, or very close) on a main road. Then
 * you have patrolGraceSeconds to get patrolEscapeMetres away, else you are caught.
 * Returns events: { type: 'spotted' | 'escaped' | 'caught', car }.
 */
export function stepPatrols(state, cars, bike, carrying, mainRoad, dt) {
  const events = [];
  if (!carrying) {
    if (state.spot) state.spot.car.siren = false;
    state.spot = null;
    return events;
  }
  if (!state.spot) {
    if (!mainRoad) return events;
    for (const car of cars) {
      const dx = bike.x - car.x, dy = bike.y - car.y, d = Math.hypot(dx, dy);
      if (d > U.patrolSeeMetres) continue;
      const ahead = (dx * Math.cos(car.heading) + dy * Math.sin(car.heading)) / (d || 1);
      if (ahead < 0.3 && d > 8) continue; // the patrol looks ahead
      state.spot = { car, t: 0 };
      car.siren = true;
      events.push({ type: 'spotted', car });
      break;
    }
    return events;
  }
  const s = state.spot;
  s.t += dt;
  const d = Math.hypot(bike.x - s.car.x, bike.y - s.car.y);
  if (d > U.patrolEscapeMetres) {
    s.car.siren = false;
    state.spot = null;
    events.push({ type: 'escaped', car: s.car });
  } else if (s.t >= U.patrolGraceSeconds) {
    s.car.siren = false;
    state.spot = null;
    events.push({ type: 'caught', car: s.car });
  }
  return events;
}

/** How many patrol cars for these districts. */
export function patrolCount(districts) {
  return U.patrolsPerDistrict * districts.length;
}
