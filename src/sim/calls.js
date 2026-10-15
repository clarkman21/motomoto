import { LESSON } from '../config.js';
import { newCall, stepCall } from './phone.js';

// First-time calls: Rukundo phones you the first time a new kind of job or day comes, at any level (the
// first muzungu, a VIP, a rush delivery, an Umuganda morning ...). Each call plays one time in a game.
// The same phone window as the Motari lesson (sim/lesson.js, sim/phone.js). No Phaser here.
// Words: see sim/lesson.js.

/** The calls. id: a side mission kind (sim/missions.js), 'muzungu', or a day event. */
export const CALLS = {
  muzungu: [
    'Allo? Rukundo here. Eh! You go to pick up a muzungu?',
    'Today God loves you, sha. A muzungu pays four times. Kabisa!',
    'Ride slow, like a wedding car. They want photos of everything.',
    'Slow past the sights: photo, photo, tip!',
    'They say "moo-rah-ho". You say "yego" and smile. Twende!',
  ],
  vip: ['A VIP, chef? Big shoes, big tip.', 'No fine, no crash. Ride smooth like ikivuguto.', 'One bad bump and the bonus goes. Courage!'],
  rush: ['A rush delivery? Fast fast, eh!', 'But Maria waits on the corners. Fast, not stupid.', 'Late, and they pay half. Twende!'],
  ikivuguto: ['Ikivuguto in cans! Careful, sha.', 'Spill the milk, and the mama finds you. She knows your number plate.', 'Soft on the bumps. Buhoro buhoro.'],
  hotel: ['A hotel guest in a hurry. Their plane does not wait.', 'Take the short way, and do not get lost in the back roads. Komera!'],
  batteries: [
    'Ampersand batteries to a swap station? Wow, you are a big man now.',
    'Do not drop them. They are not bananas!',
    'Each delivery, more motos go electric. The air says murakoze.',
  ],
  umuganda: [
    'Muraho! Today is Umuganda. Everybody works for the community.',
    'No motos on the main roads this morning. The afande are everywhere.',
    'Murram back roads only, sha. Or take a hoe and help!',
  ],
  carFree: ['Eh, a car free road! People walk, run and do sport there.', 'No motos, no cars. Go round, or the afande stop you.'],
};

/** The first-time calls of a game. seen: the ids from a saved game (they do not play again). */
export function createCalls(seen = []) {
  return { seen: new Set(seen), queue: [], call: null, gap: 0 };
}

/** The first time of something: its call plays when the phone is free (one time in a game). */
export function callEvent(calls, id) {
  if (!calls || !CALLS[id] || calls.seen.has(id) || calls.queue.includes(id)) return false;
  calls.queue.push(id);
  return true;
}

/**
 * Advance the calls by dt. busy: another call is on the phone (no new call starts). Returns events for
 * the sound: { type: 'ring' }, { type: 'line' }, { type: 'hangUp' } (as stepLesson).
 */
export function stepCalls(calls, dt, busy = false) {
  const out = [];
  if (!calls) return out;
  const call = calls.call;
  if (!call) {
    calls.gap = Math.max(0, calls.gap - dt);
    if (calls.queue.length && calls.gap <= 0 && !busy) {
      const id = calls.queue.shift();
      calls.seen.add(id);
      calls.call = newCall({ id }, CALLS[id]);
      out.push({ type: 'ring' });
    }
    return out;
  }
  const e = stepCall(call, dt);
  if (e === 'line') out.push({ type: 'line' });
  else if (e === 'end') {
    calls.call = null;
    calls.gap = LESSON.gapSeconds;
    out.push({ type: 'hangUp' });
  }
  return out;
}

/** L or the SKIP button during a first-time call: hang up now (the call counts as heard). */
export function hangUp(calls) {
  if (!calls?.call) return false;
  calls.call = null;
  calls.gap = LESSON.gapSeconds;
  return true;
}
