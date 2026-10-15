import { LESSON } from '../config.js';
import { newCall, stepCall, lineSeconds, lineShown } from './phone.js';

export { lineSeconds, lineShown };

// The Motari lesson (level 1): Rukundo Thacien, an older motari, phones you on your first night shift and
// gives tips as things happen, as at the start of Half-Life: no tutorial screen, the game goes on while he
// talks. English, with Kinyarwanda words and moto park lingo in it. No Phaser here: the scene gives a
// context each frame and tells about events (a crash, the first fare); the HUD shows the call.
//
// Kinyarwanda and Kigali words (a guess; to check with Alp): Muraho = hello; mukuru = big brother (an older
// one); buhoro buhoro = slowly, slowly; komera = be strong; murakoze = thank you; urakomeye? = are you OK?;
// polisi = police; afande = what you call a police officer; oya = no; yego = yes; nta kibazo = no problem;
// kabisa = totally (Kigali slang); sha = friend, man; twende = let us go; amafaranga = money;
// ugire akazi keza = have a good work (shift). Moto park lingo: "chef" = a customer; "Maria" = a speed camera.

/** The tips, in the order of the first shift. when(ctx): it starts now; event: it starts with lessonEvent(). */
export const TIPS = [
  {
    id: 'hello', when: (c) => c.t > LESSON.helloAfterSeconds,
    lines: ['Allo? Muraho! It is Rukundo. Rukundo Thacien, the old lion of the moto park.', 'Your first night on the moto, eh? Nta kibazo, your mukuru will help you.'],
    keys: ['Jobs come on your phone. Press 1 to 4 to take one.'], touch: ['Jobs come on your phone. Tap one to take it.'],
  },
  {
    id: 'pickup', when: (c) => c.jobStage === 'toPickup',
    lines: ['Good! Ride to the customer. Follow the pin.', 'To a motari, every customer is "chef". Even a small child: chef!', 'Stop beside them and wait. Buhoro buhoro...'],
  },
  { id: 'passenger', when: (c) => c.passenger, lines: ['A chef on the back! Ride smooth, no tricks.', 'If you fall, the chef goes and does not pay. Komera!'] },
  { id: 'paid', event: true, lines: ['Murakoze! Your first amafaranga.', 'Keep some for fuel and the garage. The family counts on you, kabisa.'] },
  {
    id: 'murram', when: (c) => c.murram && c.kmh > 8,
    lines: ['Ah, murram! The red dirt road.', 'It shakes the moto, and it shakes your head. Go slow.', 'When it rains, it is red soap. Turn gently, sha!'],
  },
  { id: 'bump', when: (c) => c.bumpAhead && c.kmh > 15, lines: ['Speed bump! Slow down, or you break the moto and your back.', 'The garage sells parts for the moto. For your back, no.'] },
  {
    id: 'police', when: (c) => c.officerNear,
    lines: ['Eh! Polisi. You see the afande?', 'No pavement, no short cuts off the road near them.', 'Smile, ride clean. The fine hurts more than a crash.'],
  },
  {
    id: 'speed', when: (c) => c.overLimitSeconds > 2,
    lines: ['Too fast, too fast! Watch the round signs.', 'And watch for Maria. Maria? The speed camera, sha.', 'Maria takes your photo, and she never smiles back. Then she sends the bill!'],
  },
  {
    id: 'fuel', when: (c) => c.petrol && c.energy < LESSON.fuelBelow,
    lines: ['Your tank goes down. Find an SP station.'], keys: ['Stop beside the pumps and press F.', 'Empty? Old motari trick: stop and press F.', 'You rock the moto on its side for the last fuel. One time only!'],
    touch: ['Stop beside the pumps and tap the station button.', 'Empty? Old motari trick: stop and tap TILT.', 'You rock the moto on its side for the last fuel. One time only!'],
    after: ['Push a moto up a Kigali hill? Oya, not fun! Your legs cry.'],
  },
  {
    id: 'service', when: (c) => c.service > LESSON.serviceFrom,
    lines: ['The moto needs a service soon.', 'A moto is like a cow, sha: care for it, and it feeds you.', 'The garages are orange on the map. Do not wait for a breakdown.'],
  },
  {
    id: 'crash', event: true,
    lines: ['Ouch! Urakomeye? Are you OK?', 'Every motari falls one time. A good motari falls one time only!', 'Get up and look at the moto. Repairs cost money. Buhoro buhoro!'],
  },
  { id: 'night', when: (c) => c.night > 0.6 && c.t > 30, lines: ['It is dark now. Cars do not see you well.', 'At night the potholes hide. They wait for you.', 'The night pays, but be careful.'] },
  { id: 'bye', when: (c, l) => l.seen.size >= LESSON.byeAfterTips, lines: ['OK, I must go. My chef waits, and he is not patient.', 'Ugire akazi keza! Have a good shift. Twende!'] },
];
const BY_ID = Object.fromEntries(TIPS.map((t) => [t.id, t]));

/** A new lesson. seen: the tips you had before (a saved game), so they do not play again. */
export function createLesson(seen = [], touch = false) {
  return { seen: new Set(seen), queue: [], call: null, gap: 0, done: seen.includes('bye'), skipped: false, touch, events: [] };
}

/** The lines of a tip for this device (keys or touch). */
export function tipLines(tip, touch) {
  return [...tip.lines, ...((touch ? tip.touch : tip.keys) ?? []), ...(tip.after ?? [])];
}

/** Something happened that has a tip: 'paid' (the first fare) or 'crash'. It plays next. */
export function lessonEvent(lesson, id) {
  if (!lesson || lesson.done || lesson.seen.has(id) || lesson.queue.includes(id) || lesson.call?.tip.id === id) return;
  lesson.queue.unshift(id);
}

/**
 * Advance the lesson by dt. ctx: { t, kmh, jobStage, passenger, murram, bumpAhead, officerNear,
 * overLimitSeconds, petrol, energy, service, night, busy }. busy: another call is on the phone (no new call
 * starts). Returns events for the sound: { type: 'ring' } when a call starts, { type: 'line' } when a new
 * line starts, { type: 'hangUp' } at the end of a call.
 * lesson.call is { tip, caller, lines, line, lineTime, ringing } while Rukundo talks (the HUD shows it).
 */
export function stepLesson(lesson, ctx, dt) {
  const out = [];
  if (!lesson || lesson.done) return out;
  // New tips: when their moment comes (one time each).
  for (const tip of TIPS) {
    if (tip.event || lesson.seen.has(tip.id) || lesson.queue.includes(tip.id) || lesson.call?.tip.id === tip.id) continue;
    if (tip.id !== 'hello' && !lesson.seen.has('hello')) continue; // he says hello first
    if (tip.when(ctx, lesson)) lesson.queue.push(tip.id);
  }
  const call = lesson.call;
  if (!call) {
    lesson.gap = Math.max(0, lesson.gap - dt);
    if (lesson.queue.length && lesson.gap <= 0 && !ctx.busy) {
      const tip = BY_ID[lesson.queue.shift()];
      lesson.seen.add(tip.id);
      lesson.call = newCall(tip, tipLines(tip, lesson.touch));
      out.push({ type: 'ring' });
    }
    return out;
  }
  // The phone rings, then he talks: one line at a time.
  const e = stepCall(call, dt);
  if (e === 'line') out.push({ type: 'line' });
  else if (e === 'end') {
    lesson.call = null;
    lesson.gap = LESSON.gapSeconds;
    out.push({ type: 'hangUp' });
    if (call.tip.id === 'bye') lesson.done = true;
  }
  return out;
}

/** Skip the lesson (L key or the SKIP button): he says a short goodbye, and no more tips. */
export function skipLesson(lesson) {
  if (!lesson || lesson.done) return;
  lesson.queue = [];
  lesson.skipped = true;
  lesson.done = true;
  lesson.call = newCall({ id: 'skip' }, ['OK, OK, mister know-it-all. Komera!'], 0);
  lesson.closing = true;
}

/** After a skip, the short goodbye still shows; advance it (returns true while it shows). */
export function stepClosing(lesson, dt) {
  if (!lesson?.closing || !lesson.call) return false;
  lesson.call.lineTime += dt;
  if (lesson.call.lineTime >= lineSeconds(lesson.call.lines[0])) {
    lesson.call = null;
    lesson.closing = false;
    return false;
  }
  return true;
}
