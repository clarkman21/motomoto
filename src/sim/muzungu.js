import { MUZUNGU, JOBS, DISTRICTS, WORLD } from '../config.js';
import { round10 } from './economy.js';
import { tripMetres, jobPlaces } from './jobs.js';

// The muzungu passenger: a foreign visitor who pays 4 times the fare. No Phaser here.
// - Offers: about 1 new offer in 15 is a visitor, from a hotel or a landmark to a place a visitor wants to see.
// - On the ride: happy lines over the bike ("OH WOW!"), Kinyarwanda words said wrong, and photo stops.
// - Kind, not cruel: the joke is on the tourist who pays too much and loves everything. No lines near
//   the quiet places (MUZUNGU.quietIds and quietTags).
// The Kinyarwanda words are a guess. Alp checks them.

/** The lines. who: 'visitor' (the passenger) or 'rider' (you). */
export const VISITOR_LINES = {
  hello: 'MOO-RAH-HO!', // muraho: hello
  morning: 'MWARA... MWARA-MOOSE?', // mwaramutse: good morning
  afternoon: 'MWEE-REE-WAY!', // mwiriwe: good afternoon or evening
  start: 'OH WOW! A MOTO TAXI!',
  bump: 'OH! OH! OH!',
  bumpReply: 'BUHORO BUHORO, SHA.', // the rider: slowly, slowly, friend
  fast: 'BOO-HORO BOO-HORO, PLEASE!', // buhoro buhoro: slowly, slowly
  police: 'HELLO, OFFICER!',
  market: 'EE-GEE-TOH-KEE! BANANA!', // igitoki: a banana
  uphill: 'KO-MAY-ZAH!', // komeza: keep going
  photo: 'CAN I TAKE A PHOTO? SMILE!',
  howAreYou: 'AMA-KOO-ROO?', // amakuru: how are you?
  howAreYouReply: 'YEGO, NI MEZA!', // the rider: yes, it is good
  chatter: ['THIS IS AMAZING!', 'IT IS SO CLEAN HERE!', 'OH WOW, THE HILLS!', 'OH WOW!', 'I LOVE IT HERE!'],
  pay: ['HOW MUCH? ... OH, KEEP THE CHANGE!', 'AMAFARANGA ANGAHE? ... KEEP THE CHANGE!'], // amafaranga angahe: how much money?
  thanks: 'MURA-COZY CHA-NAY!', // murakoze cyane: thank you very much
  riderThanks: 'MURAKOZE, MUZUNGU!', // the rider: thank you, visitor
  calls: ['MOTO! MOTO, PLEASE!', 'TAXI? MOTO TAXI?', 'HELLO! MOTO!'], // a visitor who waves at the roadside
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/**
 * Maybe turn a new offer into a visitor (at most MUZUNGU.maxOnBoard on the board). Side missions stay
 * as they are. Returns the offer (changed or not).
 */
export function maybeVisitor(offer, board, world, level, rng) {
  if (level < MUZUNGU.fromLevel || offer.mission || offer.visitor) return offer;
  if (board.offers.filter((o) => o.visitor).length >= MUZUNGU.maxOnBoard) return offer;
  if (rng() >= MUZUNGU.chance) return offer;
  const places = jobPlaces(world, board.opts);
  const starts = places.filter((p) => MUZUNGU.startIds.includes(p.id));
  if (!starts.length) return offer;
  const from = pick(rng, starts);
  const ends = places.filter((p) => MUZUNGU.endIds.includes(p.id) && p !== from && tripMetres(from, p) >= JOBS.minTripMetres);
  if (!ends.length) return offer;
  const to = pick(rng, ends);
  const distanceMetres = tripMetres(from, to);
  const gameKm = distanceMetres / JOBS.gameKmMetres;
  const p = JOBS.passenger;
  const fare = (board.opts.fareMultiplier ?? 1) * (DISTRICTS[from.district]?.fares ?? 1) * MUZUNGU.fareFactor;
  return {
    ...offer, type: 'passenger', goods: undefined, heavy: undefined, from, to, distanceMetres, gameKm,
    kg: p.kg, fragile: false, pay: round10((p.base + p.perGameKm * gameKm) * fare), visitor: true,
  };
}

/**
 * Maybe make a new street hail a visitor: only near a start place (a hotel or a landmark), at most
 * MUZUNGU.maxHails at a time. places: the map's places; hails: all hails now (with the new one).
 * opts: { level, districts }. Returns true when the hail is now a visitor.
 */
export function maybeVisitorHail(hail, places, hails, opts, rng) {
  if (opts.level < MUZUNGU.fromLevel || hail.fromBus) return false;
  if (hails.filter((h) => h.visitor).length >= MUZUNGU.maxHails) return false;
  const T = WORLD.tileMetres;
  const open = (p) => !opts.districts || !p.district || opts.districts.includes(p.district);
  const start = places.find((p) => MUZUNGU.startIds.includes(p.id) && open(p) && Math.hypot(p.x * T - hail.x, p.y * T - hail.y) < MUZUNGU.hailMetres);
  if (!start || rng() >= MUZUNGU.hailChance) return false;
  const ends = places.filter((p) => MUZUNGU.endIds.includes(p.id) && open(p) && p !== start && tripMetres(hail.from, p) >= JOBS.minTripMetres);
  if (!ends.length) return false;
  hail.visitor = true;
  hail.from = { ...hail.from, name: start.name, district: start.district };
  hail.to = pick(rng, ends);
  return true;
}

/** The state of a visitor on the bike (on the job). */
export function visitorState() {
  return { gap: 0, chatter: MUZUNGU.chatterSeconds[0], used: [], seen: [], wowed: [], photos: 0, photoTip: 0, bumpWait: 0, fastWait: 0 };
}

/** The greeting at the pickup: by the time of day, then "OH WOW! A MOTO TAXI!". */
export function greeting(hour) {
  return [hour < 12 ? VISITOR_LINES.morning : hour >= 15 ? VISITOR_LINES.afternoon : VISITOR_LINES.hello, VISITOR_LINES.start];
}

/** The lines at the drop off: [visitor, visitor, rider]. */
export function dropOffLines(rng) {
  return [pick(rng, VISITOR_LINES.pay), VISITOR_LINES.thanks, VISITOR_LINES.riderThanks];
}

/** The sight within MUZUNGU.sightMetres of (x, y) metres, or null. */
export function sightNear(x, y) {
  const T = WORLD.tileMetres;
  return MUZUNGU.sights.find((s) => Math.hypot(s.x * T - x, s.y * T - y) < MUZUNGU.sightMetres) ?? null;
}

/** True near a quiet place (no visitor lines there). places: the map's places. */
export function quietNear(places, x, y) {
  const T = WORLD.tileMetres;
  return places.some((p) => (MUZUNGU.quietIds.includes(p.id) || p.tags.some((t) => MUZUNGU.quietTags.includes(t)))
    && Math.hypot(p.x * T - x, p.y * T - y) < MUZUNGU.quietMetres);
}

/**
 * One step of a visitor on the bike. ctx: { kmh, bump, sight, quiet, police, market, uphill }.
 * Returns events: { type: 'say', who, text } and { type: 'photo', sight, tip }.
 */
export function stepVisitor(job, ctx, dt, rng) {
  const v = job?.visitor === true ? (job.visitorState ??= visitorState()) : null;
  if (!v || job.stage !== 'toDropoff') return [];
  v.gap = Math.max(0, v.gap - dt);
  v.bumpWait = Math.max(0, v.bumpWait - dt);
  v.fastWait = Math.max(0, v.fastWait - dt);
  v.chatter -= dt;
  if (ctx.quiet) return [];
  const out = [];
  const say = (text, who = 'visitor') => out.push({ type: 'say', who, text });
  const once = (key) => (v.used.includes(key) ? false : (v.used.push(key), true));
  // A sight: a photo if you are slow, else "OH WOW!" (once for each sight).
  const s = ctx.sight;
  // No free photo: a sight next to the pickup place does not count.
  if (s && job.from && Math.hypot(s.x - job.from.x, s.y - job.from.y) * WORLD.tileMetres < MUZUNGU.sightMetres * 1.5 && !v.seen.includes(s.id)) v.seen.push(s.id);
  if (s && !v.seen.includes(s.id)) {
    if (ctx.kmh <= MUZUNGU.photoKmh) {
      v.seen.push(s.id);
      if (v.photos < MUZUNGU.maxPhotos) {
        v.photos++;
        const tip = round10(job.pay * MUZUNGU.photoTipFactor);
        v.photoTip += tip;
        out.push({ type: 'photo', sight: s, tip });
        say(VISITOR_LINES.photo);
        v.gap = MUZUNGU.gapSeconds;
        return out;
      }
    } else if (!v.wowed.includes(s.id) && v.gap <= 0) {
      v.wowed.push(s.id);
      say(s.line);
      v.gap = MUZUNGU.gapSeconds;
      return out;
    }
  }
  if (v.gap > 0) return out;
  if (ctx.bump && v.bumpWait <= 0) {
    say(VISITOR_LINES.bump);
    if (rng() < 0.5) say(VISITOR_LINES.bumpReply, 'rider');
    v.bumpWait = MUZUNGU.bumpSeconds;
  } else if (ctx.kmh > MUZUNGU.fastKmh && v.fastWait <= 0) {
    say(VISITOR_LINES.fast);
    v.fastWait = MUZUNGU.fastSeconds;
  } else if (ctx.police && once('police')) say(VISITOR_LINES.police);
  else if (ctx.market && once('market')) say(VISITOR_LINES.market);
  else if (ctx.uphill && once('uphill')) say(VISITOR_LINES.uphill);
  else if (v.chatter <= 0) {
    if (once('howAreYou')) {
      say(VISITOR_LINES.howAreYou);
      say(VISITOR_LINES.howAreYouReply, 'rider');
    } else say(pick(rng, VISITOR_LINES.chatter));
    const [lo, hi] = MUZUNGU.chatterSeconds;
    v.chatter = lo + rng() * (hi - lo);
  }
  if (out.length) v.gap = MUZUNGU.gapSeconds;
  return out;
}
