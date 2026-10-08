import { MISSIONS, JOBS, WORLD } from '../config.js';
import { round10 } from './economy.js';
import { tripMetres, jobPlaces } from './jobs.js';

// Daily app quests, side missions and secret places. No Phaser here.
// - Quests: one or two goals each day on the phone, with a bonus that grows with the level.
// - Side missions: special offers on the job board (a VIP passenger, a rush delivery, ikivuguto from
//   the milk bar, a hotel guest in a hurry). They pay more, and a bonus when you meet the condition.
// - Secret places: hidden spots on the map (some only at night, or when the fountain sprays). Each
//   gives a small bonus once in a game.

// ---------------------------------------------------------------------------
// Daily quests
// ---------------------------------------------------------------------------

/** The quest kinds. progress(stats) gives a number; the quest is done when it reaches goal. */
const QUESTS = {
  morning: { text: (q) => `${q.goal} JOBS BEFORE 12:00`, goal: (lv) => 2 + Math.floor(lv / 3), progress: (s) => s.jobsBeforeNoon },
  jobs: { text: (q) => `${q.goal} JOBS TODAY`, goal: (lv) => 3 + Math.floor(lv / 2), progress: (s) => s.jobs },
  cargo: { text: (q) => `${q.goal} CARGO DELIVERIES`, goal: (lv) => 2 + Math.floor(lv / 4), progress: (s) => s.cargo },
  earn: { text: (q) => `EARN ${q.goal.toLocaleString('en')} RWF IN FARES`, goal: (lv) => round10(6000 + lv * 2500), progress: (s) => s.fares },
  clean: { text: (q) => `${q.goal} CLEAN RIDES IN A ROW`, goal: (lv) => 3 + Math.floor(lv / 3), progress: (s) => s.bestCleanRun },
  noFines: { text: () => 'NO FINES TODAY (4 JOBS)', goal: () => 4, progress: (s) => (s.fines ? 0 : s.jobs) },
  hotel: { text: (q) => `${q.goal} HOTEL GUESTS`, goal: () => 2, progress: (s) => s.hotel, needs: 'hotel' },
};

/** New stats for a day (the quests read them). */
export function dayStats() {
  return { jobs: 0, jobsBeforeNoon: 0, cargo: 0, fares: 0, cleanRun: 0, bestCleanRun: 0, fines: 0, hotel: 0 };
}

/**
 * Pick the quests for a day (seeded: the same day gives the same quests). level: the level number.
 * hasHotels: hotel places are open. Returns [{ kind, goal, reward, text, done }].
 */
export function pickQuests(level, rng, hasHotels = false) {
  if (level < MISSIONS.fromLevel) return [];
  const kinds = Object.keys(QUESTS).filter((k) => !QUESTS[k].needs || (QUESTS[k].needs === 'hotel' && hasHotels));
  const out = [];
  while (out.length < MISSIONS.questsPerDay && kinds.length) {
    const kind = kinds.splice(Math.floor(rng() * kinds.length), 1)[0];
    const goal = QUESTS[kind].goal(level);
    const q = { kind, goal, reward: round10(MISSIONS.questReward.base + MISSIONS.questReward.perLevel * level), done: false };
    q.text = QUESTS[kind].text(q);
    out.push(q);
  }
  return out;
}

/** A short line for the HUD: the progress and the goal (about 30 characters). */
export function questLabel(q, stats) {
  const p = questProgress(q, stats);
  const n = (x) => Math.round(x).toLocaleString('en');
  if (q.done) return `DONE: ${q.text}`;
  if (q.kind === 'earn') return `${n(p)}/${n(q.goal)} RWF IN FARES`;
  if (q.kind === 'noFines') return `NO FINES · ${p}/${q.goal} JOBS`;
  return `${p}/${q.text}`;
}

/** The progress of a quest (0..goal). */
export function questProgress(q, stats) {
  return Math.min(q.goal, QUESTS[q.kind].progress(stats));
}

/**
 * Record a delivery in the day stats. job: the delivered job; hour: the game hour; clean: a clean ride.
 */
export function recordDelivery(stats, job, fare, hour, clean) {
  stats.jobs++;
  if (hour < 12) stats.jobsBeforeNoon++;
  if (job.type === 'cargo') stats.cargo++;
  else stats.fares += fare;
  if (job.from?.tags?.includes('hotel')) stats.hotel++;
  stats.cleanRun = clean ? stats.cleanRun + 1 : 0;
  stats.bestCleanRun = Math.max(stats.bestCleanRun, stats.cleanRun);
}

/** A fine today. */
export function recordFine(stats) {
  stats.fines++;
  stats.cleanRun = 0;
}

/** Quests that are done now (and were not before). They are marked done; pay their reward. */
export function checkQuests(quests, stats) {
  const done = [];
  for (const q of quests) {
    if (q.done || questProgress(q, stats) < q.goal) continue;
    q.done = true;
    done.push(q);
  }
  return done;
}

// ---------------------------------------------------------------------------
// Side missions
// ---------------------------------------------------------------------------

export const MISSION_TITLES = { vip: 'VIP PASSENGER', rush: 'RUSH DELIVERY', ikivuguto: 'IKIVUGUTO', hotel: 'HOTEL GUEST' };

/**
 * Maybe turn a new offer into a side mission (at most one on the board). Returns the offer (changed
 * or not). world: for the places (milk bars, hotels); level: the level number; rng: the board's rng.
 */
export function maybeMission(offer, board, world, level, rng) {
  if (level < MISSIONS.fromLevel || board.offers.some((o) => o.mission) || board.active?.mission) return offer;
  if (rng() >= MISSIONS.sideChance) return offer;
  const places = jobPlaces(world, board.opts);
  const milkBars = places.filter((p) => p.tags.includes('milk'));
  const hotels = places.filter((p) => p.tags.includes('hotel'));
  const kinds = ['vip', 'rush'];
  if (milkBars.length) kinds.push('ikivuguto');
  if (hotels.length) kinds.push('hotel');
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const far = (from, list) => list.filter((p) => p !== from && tripMetres(from, p) >= JOBS.minTripMetres * 1.5);
  const o = { ...offer };
  if (kind === 'ikivuguto') {
    const from = milkBars[Math.floor(rng() * milkBars.length)];
    const ends = far(from, places.filter((p) => !p.tags.includes('milk')));
    if (!ends.length) return offer;
    Object.assign(o, { type: 'cargo', goods: 'ikivuguto', from, to: ends[Math.floor(rng() * ends.length)], kg: MISSIONS.ikivuguto.kg, fragile: true });
  } else if (kind === 'hotel') {
    const from = hotels[Math.floor(rng() * hotels.length)];
    const ends = far(from, places);
    if (!ends.length) return offer;
    Object.assign(o, { type: 'passenger', from, to: ends[Math.floor(rng() * ends.length)], kg: JOBS.passenger.kg, fragile: false, goods: undefined });
  }
  o.distanceMetres = tripMetres(o.from, o.to);
  o.gameKm = o.distanceMetres / JOBS.gameKmMetres;
  const rule = MISSIONS[kind];
  o.pay = round10(offer.pay * (offer.distanceMetres ? o.distanceMetres / offer.distanceMetres : 1) * rule.payFactor);
  o.mission = { kind, title: MISSION_TITLES[kind], bonus: round10(o.pay * rule.bonusFactor) };
  if (rule.metresPerSecond) o.mission.limit = Math.round(o.distanceMetres / rule.metresPerSecond + rule.extraSeconds);
  o.life = (o.life ?? 30) + 15; // a special job stays a little longer on the board
  return o;
}

/** The condition text of a mission (for the HUD). */
export function missionRule(m) {
  switch (m.kind) {
    case 'vip': return `NO FINE, NO CRASH, COMFORT ${MISSIONS.vip.minComfort}%+`;
    case 'rush': return 'ARRIVE BEFORE THE TIME RUNS OUT';
    case 'ikivuguto': return `DO NOT SPILL IT (UNDER ${Math.round(MISSIONS.ikivuguto.maxDamage * 100)}%)`;
    case 'hotel': return 'THE GUEST IS IN A HURRY';
    default: return '';
  }
}

/** The mission clock runs while the passenger or the cargo is on the bike. */
export function stepMission(job, dt) {
  if (!job?.mission?.limit || job.stage !== 'toDropoff') return;
  job.mission.timeLeft = (job.mission.timeLeft ?? job.mission.limit) - dt;
}

/**
 * The result of a delivered mission job: { ok, bonus, farePenalty, text }. farePenalty: RWF taken off
 * the fare (a late rush). The scene pays the bonus.
 */
export function missionResult(job) {
  const m = job.mission;
  if (!m) return null;
  const late = m.limit && (m.timeLeft ?? m.limit) < 0;
  let ok = true, why = '';
  if (m.kind === 'vip') {
    ok = job.clean && job.comfort >= MISSIONS.vip.minComfort;
    why = 'the VIP was not happy';
  } else if (m.kind === 'rush') {
    ok = !late;
    why = 'too late';
  } else if (m.kind === 'ikivuguto') {
    ok = job.damage <= MISSIONS.ikivuguto.maxDamage;
    why = 'the ikivuguto spilled';
  } else if (m.kind === 'hotel') {
    ok = !late;
    why = 'the guest missed the meeting';
  }
  const farePenalty = m.kind === 'rush' && late ? round10(job.pay * (1 - MISSIONS.rush.latePayFactor)) : 0;
  return ok
    ? { ok, bonus: m.bonus, farePenalty: 0, text: `${m.title} DONE! +${m.bonus.toLocaleString('en')} RWF bonus` }
    : { ok, bonus: 0, farePenalty, text: `${m.title}: no bonus, ${why}.` };
}

// ---------------------------------------------------------------------------
// Secret places
// ---------------------------------------------------------------------------

/**
 * Check the secret places near the bike. secrets: the map's list [{ id, name, x, y, radius, when }];
 * found: the ids found before (wallet.secrets). ctx: { night, spraying }. Returns the newly found place, or null.
 */
export function findSecret(secrets, found, bike, ctx = {}) {
  for (const s of secrets ?? []) {
    if (found.includes(s.id)) continue;
    if (s.when === 'night' && !ctx.night) continue;
    if (s.when === 'spray' && !ctx.spraying) continue;
    if (Math.hypot(bike.x - s.x * WORLD.tileMetres, bike.y - s.y * WORLD.tileMetres) > (s.radius ?? 1.2) * WORLD.tileMetres) continue;
    return s;
  }
  return null;
}
