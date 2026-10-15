import { BABBLE } from '../config.js';

// Babble: a voice that sounds like speech, but you cannot understand the words (as in Animal Crossing).
// The plan follows the text: one syllable for each vowel group of each word, with the vowel of that
// group, short gaps between words and longer pauses at commas and full stops. The voice goes down a
// little over a sentence, up at the end of a question, and a "!" is louder. No Phaser and no Web Audio
// here: audio/engine-sound.js plays the plan.

/** The two formants (Hz) of each vowel: they make the tone sound like that vowel. */
export const VOWELS = { a: [800, 1250], e: [500, 1850], i: [320, 2250], o: [520, 920], u: [360, 800] };

/**
 * The syllables of a text. Returns { syllables: [{ at, len, vowel, pitch, gain }], seconds }: at and len
 * in seconds from the start; pitch: a factor for the base pitch of the voice; gain: 0..1.2.
 * maxSeconds: when the plan is longer, it is made faster (it ends before the line goes away).
 */
export function babblePlan(text, rng = Math.random, maxSeconds = Infinity) {
  const B = BABBLE;
  const syllables = [];
  let t = 0;
  // The sentences: the pitch goes down over each one; '?' goes up at the end, '!' is louder.
  for (const sentence of text.match(/[^.!?]+[.!?]*/g) ?? []) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    const end = sentence.trim().slice(-1);
    const n = words.reduce((s, w) => s + groupsOf(w).length, 0);
    let k = 0;
    for (const word of words) {
      const groups = groupsOf(word);
      groups.forEach((vowel, i) => {
        const along = n > 1 ? k / (n - 1) : 0;
        const last = k === n - 1;
        const len = B.syllableSeconds[0] + rng() * (B.syllableSeconds[1] - B.syllableSeconds[0]);
        let pitch = 1 + B.fall * (0.5 - along) + (rng() - 0.5) * B.wobble;
        if (last && end === '?') pitch += B.questionRise;
        if (end === '!') pitch += B.shoutRise;
        const gain = (end === '!' ? 1.2 : 1) * (i === 0 ? 1 : 0.85);
        syllables.push({ at: t, len, vowel, pitch, gain });
        t += len + B.inWordGap;
        k++;
      });
      t += B.wordGap + (/,|:|;/.test(word.slice(-1)) ? B.commaPause : 0);
    }
    t += /[.!?]/.test(end) ? B.stopPause : 0;
  }
  const last = syllables[syllables.length - 1];
  let seconds = last ? last.at + last.len : 0;
  if (seconds > maxSeconds && seconds > 0) {
    const k = maxSeconds / seconds;
    for (const s of syllables) {
      s.at *= k;
      s.len *= k;
    }
    seconds = maxSeconds;
  }
  return { syllables, seconds };
}

/** The vowel of each vowel group of a word ('Muraho' gives u, a, o). A word with no vowel has one 'e'. */
function groupsOf(word) {
  const groups = (word.toLowerCase().replace(/y/g, 'i').match(/[aeiou]+/g) ?? []).map((g) => g[0]);
  return groups.length ? groups.slice(0, BABBLE.maxPerWord) : /[a-z0-9]/i.test(word) ? ['e'] : [];
}
