import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { shopFronts, shopPlaces, drawShopSign, drawMannequin, SHOP_KINDS, MANNEQUIN_CANVAS } from '../src/world/shops.js';
import { COLOURS } from '../src/config.js';

const world = new World(buildKigaliMap());
const shops = shopFronts(world);

describe('shops and street life', () => {
  it('gives many shop buildings a sign, barbershops the most', () => {
    expect(shops.length).toBeGreaterThan(40);
    const count = (k) => shops.filter((s) => s.kind === k).length;
    for (const k of Object.keys(SHOP_KINDS)) expect(count(k), k).toBeGreaterThan(0);
    expect(count('barber')).toBe(Math.max(...Object.keys(SHOP_KINDS).map(count)));
    for (const s of shops) expect(SHOP_KINDS[s.kind].names).toContain(s.name);
  });

  it('each shop faces an open tile; customers stand on a road or a pavement', () => {
    for (const s of shops) {
      const f = world.tile(Math.floor(s.front.x), Math.floor(s.front.y));
      expect(f && !f.block, s.id).toBe(true);
      if (!s.stand) continue;
      const t = world.tile(Math.floor(s.stand.x), Math.floor(s.stand.y));
      expect(['pavement', 'tarmac', 'murram', 'cobble']).toContain(t.surface);
    }
  });

  it('some shops are job places, and every buffet is a place to eat', () => {
    const places = shopPlaces(shops);
    expect(places.length).toBeGreaterThan(10);
    const buffets = shops.filter((s) => s.kind === 'buffet');
    expect(places.filter((p) => p.tags.includes('buffet')).length).toBe(buffets.filter((b) => b.stand).length);
    expect(places.find((p) => p.tags.includes('shop')).name).not.toMatch(/^[A-Z ]+$/); // "Good Vibes Saloon", not all capitals
  });

  it('draws a sign with the name and a picture, and mannequins with strange proportions', () => {
    const sign = drawShopSign('bar', 'NTA KIBAZO BAR').canvas;
    expect(sign.width).toBeGreaterThan(50);
    let surge = 0;
    for (let i = 0; i < sign.data.length; i += 4) if (((sign.data[i] << 16) | (sign.data[i + 1] << 8) | sign.data[i + 2]) === COLOURS.ampersandYellow) surge++;
    expect(surge).toBe(0); // Surge Yellow is only for Ampersand
    const tall = drawMannequin(0), big = drawMannequin(1);
    expect(tall.width).toBe(MANNEQUIN_CANVAS.width);
    const topRow = (c) => { for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.data[(y * c.width + x) * 4 + 3]) return y; return -1; };
    expect(topRow(tall)).toBeLessThan(topRow(big) + 6);
  });
});
