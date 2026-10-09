import { EVENTS } from '../config.js';
import { mulberry32 } from './jobs.js';

// Day events: Umuganda (the community work morning) and rain. No Phaser here.
// The event of a day comes from the level's `events` chances and a seed from the day, so a reload gives the same event.

export const EVENT_NAMES = { umuganda: 'UMUGANDA', rain: 'RAIN' };

/** The event of a day: 'umuganda', 'rain' or null. One event at most. */
export function pickDayEvent(level, day) {
  const chances = level.events ?? {};
  const rng = mulberry32(day * 7919 + level.n * 131 + 17);
  rng(); // the first number of a new seed is not well mixed
  let roll = rng();
  for (const kind of ['umuganda', 'rain']) {
    const p = chances[kind] ?? 0;
    if (roll < p) return kind;
    roll -= p;
  }
  return null;
}

/**
 * The stage of an event at an hour, and its effects.
 * Returns { stage, fare, hailEvery, extraOffers, customers, trafficFull }.
 * stage: 'morning' (Umuganda, before endHour), 'rush' (Umuganda, until rushEndHour), 'rain', or null.
 */
export function eventStage(event, hour) {
  const none = { stage: null, fare: 1, hailEvery: 1, extraOffers: 0, customers: true, trafficFull: true };
  if (event === 'umuganda') {
    const u = EVENTS.umuganda;
    if (hour < u.endHour) return { ...none, stage: 'morning', customers: false, trafficFull: false };
    if (hour < u.rushEndHour) return { ...none, stage: 'rush', fare: u.rushFare, hailEvery: u.rushHailEvery, extraOffers: u.rushExtraOffers };
    return none;
  }
  if (event === 'rain') return { ...none, stage: 'rain', fare: EVENTS.rain.fare, hailEvery: EVENTS.rain.hailEvery };
  return none;
}

/** The short text for the HUD clock. */
export function eventLabel(event, hour) {
  const s = eventStage(event, hour).stage;
  if (s === 'morning') return 'UMUGANDA';
  if (s === 'rush') return 'UMUGANDA RUSH';
  if (s === 'rain') return 'RAIN';
  return '';
}

const pct = (f) => Math.round((f - 1) * 100);

/** The line for the jobs window of the HUD: { text, tone } ('warn', 'good', 'info'), or null. */
export function eventLine(event, hour) {
  const s = eventStage(event, hour);
  if (s.stage === 'morning') return { text: `UMUGANDA · JOBS AT ${EVENTS.umuganda.endHour}:00`, tone: 'warn' };
  if (s.stage === 'rush') return { text: `UMUGANDA RUSH · FARES +${pct(s.fare)}%`, tone: 'good' };
  if (s.stage === 'rain') return { text: `RAIN · FARES +${pct(s.fare)}%`, tone: 'info' };
  return null;
}

/** The bark when the stage of the event changes (from: the stage before, or undefined at the start of the day). */
export function eventBark(event, from, to) {
  const u = EVENTS.umuganda;
  if (to === 'morning') return `Umuganda today: everybody does community work until ${u.endHour}:00. No customers, and the roads are almost empty.`;
  if (to === 'rush') return `Umuganda is over! Everybody wants a moto now: more jobs, and fares +${pct(u.rushFare)}% until ${u.rushEndHour}:00.`;
  if (to === null && from === 'rush') return 'The Umuganda rush is over. Fares are normal again.';
  if (to === 'rain' && from === undefined) return `Rain today: the murram roads are wet and slippery. More people want a moto, and fares are +${pct(EVENTS.rain.fare)}%.`;
  return null;
}

/** One line for the day end summary, or null on a normal day. */
export function eventSummary(event) {
  if (event === 'umuganda') return `Umuganda day: community work until ${EVENTS.umuganda.endHour}:00, then the rush.`;
  if (event === 'rain') return 'A rainy day: wet murram, more customers and higher fares.';
  return null;
}

/** Rain: the daylight tint gets grey (a colour multiplier on 0xRRGGBB). */
export function rainTint(tint) {
  const k = EVENTS.rain.tint;
  const r = Math.round(((tint >> 16) & 255) * k[0]), g = Math.round(((tint >> 8) & 255) * k[1]), b = Math.round((tint & 255) * k[2]);
  return (r << 16) | (g << 8) | b;
}

/** Move a share of the traffic off the road (Umuganda morning). The vehicles wait in traffic.dormant. */
export function parkTraffic(traffic, share, rng) {
  traffic.dormant = traffic.dormant ?? [];
  const keep = [];
  for (const v of traffic.vehicles) (rng() < share ? keep : traffic.dormant).push(v);
  traffic.vehicles = keep;
}

/**
 * Bring dormant vehicles back on the road, but only the ones far from (x, y), so they do not pop up in view.
 * which: the vehicles to wake (default: all but the rush hour vehicles, see sim/rush.js).
 */
export function wakeTraffic(traffic, x, y, minMetres, which = (v) => !v.rush) {
  if (!traffic.dormant?.length) return 0;
  const stay = [];
  let woke = 0;
  for (const v of traffic.dormant) {
    if (which(v) && Math.hypot(v.x - x, v.y - y) >= minMetres) {
      traffic.vehicles.push(v);
      woke++;
    } else stay.push(v);
  }
  traffic.dormant = stay;
  return woke;
}
