import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { marketSpots } from '../src/world/market.js';
import { drawVendor, drawGoat, drawSheep, KITENGE, MARKET_GOODS } from '../src/world/market-sprites.js';
import { drawPerson, PERSON_LOOKS } from '../src/world/vehicle-sprites.js';
import { drawFuelSign } from '../src/world/garage-sprites.js';
import { WORLD, PEOPLE, COLOURS } from '../src/config.js';

const T = WORLD.tileMetres;
const world = new World(buildKigaliMap());
const opaque = (c) => c.data.filter((v, i) => (i & 3) === 3 && v > 0).length;
const hasColour = (c, rgb) => {
  for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] && ((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]) === rgb) return true;
  return false;
};

describe('market life', () => {
  const spots = marketSpots(world);

  it('puts vendors and animals in the markets', () => {
    const vendors = spots.filter((s) => s.kind === 'vendor');
    const animals = spots.filter((s) => s.kind !== 'vendor');
    expect(vendors.length).toBeGreaterThan(20);
    expect(animals.length).toBeGreaterThan(4);
    const inNyabugogoMarket = vendors.filter((s) => s.x / T >= 44 && s.x / T < 60 && s.y / T >= 7 && s.y / T < 18);
    expect(inNyabugogoMarket.length).toBeGreaterThan(5);
  });

  it('keeps the spots off buildings and away from job places', () => {
    for (const s of spots) {
      const t = world.tileAt(s.x, s.y);
      expect(t.block).toBeNull();
      for (const p of world.places) expect(Math.hypot(p.x * T - s.x, p.y * T - s.y)).toBeGreaterThan(1.5 * T);
    }
  });

  it('draws vendors, goats, sheep and mamas in kitenge', () => {
    for (const goods of MARKET_GOODS) expect(opaque(drawVendor(goods, 0, 0, 1))).toBeGreaterThan(150);
    expect(opaque(drawGoat(0, 0))).toBeGreaterThan(40);
    expect(opaque(drawSheep(1))).toBeGreaterThan(40);
    const mama = PERSON_LOOKS.find((l) => l.kitenge !== undefined);
    expect(hasColour(drawPerson(mama, 0, 0), KITENGE[mama.kitenge].base)).toBe(true);
    expect(PEOPLE.looks).toBe(PERSON_LOOKS.length);
  });

  it('does not use Surge Yellow (only for Ampersand)', () => {
    for (const k of KITENGE) for (const v of Object.values(k)) expect(v).not.toBe(COLOURS.ampersandYellow);
    expect(hasColour(drawVendor('pineapples', 2, 1, 2), COLOURS.ampersandYellow)).toBe(false);
  });

  it('draws the SP fuel sign: white letters on a red panel', () => {
    const { canvas } = drawFuelSign('SP');
    expect(hasColour(canvas, 0xc0392b)).toBe(true);
    expect(hasColour(canvas, 0xffffff)).toBe(true);
    expect(canvas.height).toBeGreaterThan(50);
  });
});
