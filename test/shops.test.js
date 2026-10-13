import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { shopFronts, shopPlaces, drawShopSign, drawMannequin, shopSignArt, drawMural, drawPorch, SHOP_KINDS, MANNEQUIN_CANVAS, MURAL_CANVAS } from '../src/world/shops.js';
import { COLOURS, SHOPS } from '../src/config.js';

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

  it('a sign is painted on the wall when it fits, else it stands on a board with legs (design review)', () => {
    let wall = 0, board = 0;
    for (const s of shops) {
      const art = shopSignArt(s);
      const sign = drawShopSign(s.kind, s.name).canvas;
      if (art.mount === 'wall') {
        wall++;
        expect(art.canvas.width).toBeLessThanOrEqual(s.wallTiles * 32 - SHOPS.wallMarginPx);
        expect(art.canvas.height).toBe(sign.height + Math.ceil(sign.width / 2)); // sheared 2:1
      } else {
        board++;
        expect(art.groundY).toBe(art.canvas.height - 1); // the legs reach the ground
      }
    }
    expect(wall).toBeGreaterThan(10);
    expect(board).toBeGreaterThan(10);
  });

  it('each shop kind has a hand-painted wall picture, on a side wall that no building hides', () => {
    for (const kind of Object.keys(SHOP_KINDS)) {
      const c = drawMural(kind);
      expect(c.width).toBe(MURAL_CANVAS.width);
      let opaque = 0;
      for (let i = 0; i < c.data.length; i += 4) {
        if (!c.data[i + 3]) continue;
        opaque++;
        expect((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]).not.toBe(COLOURS.ampersandYellow);
      }
      expect(opaque).toBeGreaterThan(60);
    }
    const withMural = shops.filter((s) => s.muralFace);
    expect(withMural.length).toBeGreaterThan(shops.length / 3);
    for (const s of withMural) expect(s.muralFace).not.toBe(s.sign.face);
  });

  it('the shop walls are bright paint, never Surge Yellow (Alp: only for Ampersand)', () => {
    for (const w of [...SHOPS.walls, ...SHOPS.brandWalls]) {
      expect(w.wall).not.toBe(COLOURS.ampersandYellow);
      expect(w.band).not.toBe(COLOURS.ampersandYellow);
    }
  });

  it('a porch has two poles that reach the ground', () => {
    for (const face of ['south', 'east']) {
      const p = drawPorch(face, 8, SHOPS.porchLevel);
      expect(p.canvas.height).toBeGreaterThan(Math.round(SHOPS.porchLevel * 16));
      expect(p.groundX).toBeGreaterThanOrEqual(0);
    }
  });
});
