import { describe, it, expect } from 'vitest';
import { babblePlan, VOWELS } from '../src/sim/babble.js';
import { mulberry32 } from '../src/sim/jobs.js';

// The babble voice: speech sounds without words (sim/babble.js).

describe('the babble plan', () => {
  it('has one syllable for each vowel group, with the vowels of the words', () => {
    const plan = babblePlan('Muraho', mulberry32(1));
    expect(plan.syllables.map((s) => s.vowel)).toEqual(['u', 'a', 'o']);
    for (const s of plan.syllables) expect(VOWELS[s.vowel]).toBeDefined();
  });

  it('syllables come one after the other, with a pause at a comma or a full stop', () => {
    const rng = mulberry32(2);
    const plain = babblePlan('go go go go', rng).seconds;
    const paused = babblePlan('go, go. go go', mulberry32(2)).seconds;
    expect(paused).toBeGreaterThan(plain + 0.3);
    const { syllables } = babblePlan('Allo? Muraho! It is Rukundo.', mulberry32(3));
    for (let i = 1; i < syllables.length; i++) expect(syllables[i].at).toBeGreaterThan(syllables[i - 1].at);
  });

  it('a question goes up at the end, a "!" is louder', () => {
    const q = babblePlan('are you OK?', () => 0.5).syllables;
    const flat = babblePlan('are you OK.', () => 0.5).syllables;
    expect(q.at(-1).pitch).toBeGreaterThan(flat.at(-1).pitch + 0.2);
    expect(babblePlan('Komera!', () => 0.5).syllables[0].gain).toBeGreaterThan(flat[0].gain);
  });

  it('a long line is made faster so it ends in time; empty text is silent', () => {
    const long = 'Empty? Old motari trick: stop and press F. You rock the moto on its side for the last fuel. One time only!';
    const plan = babblePlan(long, mulberry32(4), 3);
    expect(plan.seconds).toBeLessThanOrEqual(3);
    const last = plan.syllables.at(-1);
    expect(last.at + last.len).toBeLessThanOrEqual(3.001);
    expect(babblePlan('', mulberry32(5)).syllables).toEqual([]);
  });
});
