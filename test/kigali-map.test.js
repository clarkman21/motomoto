import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap, KIGALI_W, KIGALI_H } from '../src/world/maps/kigali.js';
import { renderTerrain } from '../src/world/terrain-render.js';
import { speedLimitAt } from '../src/sim/law.js';
import { WORLD } from '../src/config.js';

const T = WORLD.tileMetres;
const data = buildKigaliMap();
const world = new World(data);

describe('district map (Nyabugogo to city centre)', () => {
  it('is 96 × 80 tiles and the same for the same seed', () => {
    expect(world.width).toBe(KIGALI_W);
    expect(world.height).toBe(KIGALI_H);
    expect(buildKigaliMap().rows).toEqual(data.rows);
  });

  it('has every place on a tile you can ride on', () => {
    for (const p of world.places) expect(world.isSolidAt(p.x * T, p.y * T), p.name).toBe(false);
  });

  it('has the services: fuel, two swap stations, a garage', () => {
    expect(world.placesWithTag('fuel')).toHaveLength(1);
    expect(world.placesWithTag('swap')).toHaveLength(2);
    expect(world.placesWithTag('garage')).toHaveLength(1);
    for (const kind of ['fuel', 'swap', 'garage']) expect(world.blocks.some((b) => b.kind === kind)).toBe(true);
  });

  it('starts the bike on the main road in the valley', () => {
    const s = data.start;
    expect(world.tileAt(s.x * T, s.y * T).surface).toBe('tarmac');
    expect(world.heightAt(s.x * T, s.y * T)).toBe(0);
  });

  it('puts the city on a plateau and the river is solid', () => {
    expect(world.heightAt(70 * T, 25 * T)).toBeGreaterThan(5 * WORLD.levelMetres);
    expect(world.isSolidAt(10 * T, 1 * T)).toBe(true);
  });

  it('has speed limit zones', () => {
    expect(speedLimitAt(world, 30 * T, 10 * T).limitKmh).toBe(30);
    expect(speedLimitAt(world, 70 * T, 21 * T).limitKmh).toBe(40);
  });

  it('draws one chunk of ground small enough for phone GPUs', () => {
    const c = renderTerrain(world, { tx0: 24, ty0: 24, tx1: 48, ty1: 48 });
    expect(c.width).toBeLessThanOrEqual(2048);
    expect(c.height).toBeLessThanOrEqual(2048);
  });
});

import { packShelves } from '../src/scenes/chunks.js';
describe('block atlas packing', () => {
  it('packs rectangles without overlap inside 2048 px width', () => {
    const rects = Array.from({ length: 200 }, (_, i) => ({ width: 30 + (i * 7) % 60, height: 40 + (i * 13) % 90 }));
    const { width, height, places } = packShelves(rects);
    expect(width).toBeLessThanOrEqual(2048);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = places[i], b = places[j];
        const overlap = a.x < b.x + rects[j].width && b.x < a.x + rects[i].width && a.y < b.y + rects[j].height && b.y < a.y + rects[i].height;
        expect(overlap).toBe(false);
      }
      expect(places[i].y + rects[i].height).toBeLessThanOrEqual(height);
    }
  });
});
