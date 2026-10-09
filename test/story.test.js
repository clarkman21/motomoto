import { describe, it, expect } from 'vitest';
import { smogAt } from '../src/sim/story.js';

describe('the story arc: petrol to electric', () => {
  it('the smog is thick at level 1, thinner at each level, and gone at the end', () => {
    for (let l = 1; l < 11; l++) expect(smogAt(l + 1)).toBeLessThan(smogAt(l));
    expect(smogAt(1)).toBeGreaterThan(0.25);
    expect(smogAt(11)).toBe(0);
    expect(smogAt(12)).toBe(0);
  });
});
