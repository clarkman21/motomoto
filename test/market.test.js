import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { marketSpots } from '../src/world/market.js';
import { drawVendor, drawGoat, drawSheep, KITENGE, MARKET_GOODS } from '../src/world/market-sprites.js';
import { drawPerson, PERSON_LOOKS } from '../src/world/vehicle-sprites.js';
import { drawFuelSign } from '../src/world/garage-sprites.js';
import { WORLD, PEOPLE, COLOURS } from '../src/config.js';
import { createPeople, stepPeople, honkAt } from '../src/sim/people.js';

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

  it('draws the SP fuel sign: yellow letters on a blue panel, not Surge Yellow', () => {
    const { canvas } = drawFuelSign('SP');
    expect(hasColour(canvas, COLOURS.spBlue)).toBe(true);
    expect(hasColour(canvas, COLOURS.spYellow)).toBe(true);
    expect(hasColour(canvas, COLOURS.ampersandYellow)).toBe(false);
    expect(canvas.height).toBeGreaterThan(50);
  });
});

describe('people react to the bike', () => {
  const flat = new World({ name: 'flat', start: { x: 1.5, y: 5.5, headingDeg: 0 }, rows: Array.from({ length: 12 }, () => 'p'.repeat(40)) });
  const make = () => {
    const people = createPeople(flat, () => 0.5, { count: 0 });
    people.walkers = [
      { id: 1, x: 30, y: 23, tx: 30, ty: 23, speed: 1.2, look: 7, wait: 0, dodge: 0, hurt: 0 }, // ahead, a little to the side
      { id: 2, x: 2, y: 22, tx: 2, ty: 22, speed: 1.2, look: 0, wait: 0, dodge: 0, hurt: 0 }, // behind
    ];
    return people;
  };

  it('the horn makes the people in front step aside, not the people behind', () => {
    const people = make();
    const bike = { x: 20, y: 22, heading: 0, vx: 0, vy: 0 };
    expect(honkAt(people, bike)).toBe(1);
    const [front, back] = people.walkers;
    expect(front.dodge).toBeGreaterThan(0);
    expect(front.dodgeY).toBeGreaterThan(0); // away from the bike's path (the person is on the +y side)
    expect(back.dodge).toBe(0);
    for (let i = 0; i < 60; i++) stepPeople(people, flat, { x: 0, y: 0, vx: 0, vy: 0 }, [], 1 / 60);
    expect(front.y).toBeGreaterThan(23.5);
  });

  it('a person yells when a fast bike passes close, then not again at once', () => {
    const people = make();
    const bike = { x: 29, y: 22, vx: 8, vy: 0 };
    const first = stepPeople(people, flat, bike, [], 1 / 60).filter((e) => e.type === 'nearMiss');
    expect(first).toHaveLength(1);
    expect(PEOPLE.yells).toContain(first[0].word);
    const again = stepPeople(people, flat, bike, [], 1 / 60).filter((e) => e.type === 'nearMiss');
    expect(again).toHaveLength(0);
  });
});
