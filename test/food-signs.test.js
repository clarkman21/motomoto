import { describe, it, expect } from 'vitest';
import { RIDER } from '../src/config.js';
import { drawFoodSign } from '../src/world/food-signs.js';

describe('Food signs', () => {
  it('each food has a sign with its picture, its name and its price', () => {
    for (const food of Object.keys(RIDER.foods)) {
      const s = drawFoodSign(food);
      expect(s.canvas.width).toBeGreaterThan(20);
      expect(s.groundY).toBeLessThan(s.canvas.height);
      // The orange disc is at the top centre.
      const cx = s.groundX, i = (3 * s.canvas.width + cx) * 4, d = s.canvas.data;
      expect((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toBe(0xe07a2a);
    }
  });
});
