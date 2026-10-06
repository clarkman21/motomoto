import { describe, it, expect } from 'vitest';
import { World, hillLevelAt } from '../src/world/world.js';
import { TEST_MAP } from '../src/world/map-data.js';
import { WORLD } from '../src/config.js';

const T = WORLD.tileMetres;

describe('World', () => {
  const world = new World(TEST_MAP);

  it('loads the test map', () => {
    expect(world.width).toBe(40);
    expect(world.height).toBe(40);
    expect(world.blocks.length).toBeGreaterThan(20);
  });

  it('rejects rows of different length', () => {
    expect(() => new World({ rows: ['##', '#'], hills: [] })).toThrow(/row 1/);
  });

  it('rejects unknown map characters', () => {
    expect(() => new World({ rows: ['#?'], hills: [] })).toThrow(/Unknown map character/);
  });

  it('puts the plateau 4 levels up', () => {
    expect(world.heightAt(20 * T, 20 * T)).toBeCloseTo(4 * WORLD.levelMetres);
  });

  it('has a steep east ramp (37%) and a gentle west ramp (19%)', () => {
    const steep = world.slopeAt(28 * T, 19.5 * T);
    expect(steep.dx).toBeCloseTo(-WORLD.levelMetres / T, 5);
    const gentle = world.slopeAt(10 * T, 19.5 * T);
    expect(gentle.dx).toBeCloseTo(WORLD.levelMetres / (2 * T), 5);
  });

  it('is flat on the outer ring road', () => {
    const s = world.slopeAt(2.5 * T, 26.5 * T);
    expect(s.dx).toBe(0);
    expect(s.dy).toBe(0);
  });

  it('knows solid blocks and the map edge', () => {
    expect(world.isSolidAt(15.5 * T, 15.5 * T)).toBe(true); // building
    expect(world.isSolidAt(6.5 * T, 5.5 * T)).toBe(true); // tree trunk
    expect(world.isSolidAt(6.05 * T, 5.05 * T)).toBe(false); // tree tile corner
    expect(world.isSolidAt(-1, 10)).toBe(true);
    expect(world.isSolidAt(2.5 * T, 26.5 * T)).toBe(false);
  });

  it('gives the surface of a tile', () => {
    expect(world.surfaceAt(2.5 * T, 26.5 * T).name).toBe('Tarmac');
    expect(world.surfaceAt(19.5 * T, 6.5 * T).name).toBe('Murram, dry');
    expect(world.surfaceAt(30.5 * T, 25.5 * T).name).toBe('Murram, wet');
  });
});

describe('hillLevelAt', () => {
  const hill = { x0: 10, y0: 10, x1: 12, y1: 12, level: 2, run: { west: 1, east: 2, north: 1, south: 1 } };
  it('is full height on the plateau and falls with the ramp run', () => {
    expect(hillLevelAt(hill, 11, 11)).toBe(2);
    expect(hillLevelAt(hill, 9, 11)).toBe(1);
    expect(hillLevelAt(hill, 14, 11)).toBe(1);
    expect(hillLevelAt(hill, 20, 11)).toBe(0);
  });
});
