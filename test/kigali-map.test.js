import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap, KIGALI_W, KIGALI_H } from '../src/world/maps/kigali.js';
import { renderTerrain } from '../src/world/terrain-render.js';
import { speedLimitAt } from '../src/sim/law.js';
import { WORLD } from '../src/config.js';

const T = WORLD.tileMetres;
const data = buildKigaliMap();
const world = new World(data);

describe('Kigali map (6 districts)', () => {
  it('is 192 × 128 tiles and the same for the same seed', () => {
    expect(world.width).toBe(KIGALI_W);
    expect(world.height).toBe(KIGALI_H);
    expect(buildKigaliMap().rows).toEqual(data.rows);
  });

  it('has the 6 districts, and every tile is in one', () => {
    expect(world.districts.map((d) => d.id).sort()).toEqual(['kacyiru', 'kicukiro', 'kimihurura', 'nyabugogo', 'nyarutarama', 'town']);
    expect(world.tiles.every((t) => t.district)).toBe(true);
    expect(world.districtAt(30, 12)).toBe('nyabugogo');
    expect(world.districtAt(30, 100)).toBe('town');
  });

  it('has every place on a tile you can ride on, with a district', () => {
    for (const p of world.places) {
      expect(world.isSolidAt(p.x * T, p.y * T), p.name).toBe(false);
      expect(p.district, p.name).toBeTruthy();
    }
  });

  it('has services in every district: fuel or swap in each, two garages', () => {
    for (const d of world.districts) {
      const services = world.places.filter((p) => p.district === d.id && (p.tags.includes('fuel') || p.tags.includes('swap')));
      expect(services.length, d.id).toBeGreaterThan(0);
    }
    expect(world.placesWithTag('fuel').length).toBeGreaterThanOrEqual(6);
    expect(world.placesWithTag('swap').length).toBeGreaterThanOrEqual(4);
    expect(world.placesWithTag('garage')).toHaveLength(2);
    for (const kind of ['fuel', 'swap', 'garage', 'dome', 'fountain']) expect(world.blocks.some((b) => b.kind === kind), kind).toBe(true);
  });

  it('starts the bike on the northern road in the Nyabugogo valley', () => {
    const s = data.start;
    expect(world.tileAt(s.x * T, s.y * T).surface).toBe('tarmac');
    expect(world.heightAt(s.x * T, s.y * T)).toBe(0);
  });

  it('has the topography: a low valley, high ridges and hills, and climbs between them', () => {
    const level = (x, y) => world.heightAt(x * T, y * T) / WORLD.levelMetres;
    expect(level(30, 12)).toBe(0); // Nyabugogo bus park, valley floor
    expect(level(30, 100)).toBe(7); // Kigali town on the ridge
    expect(level(100, 30)).toBe(6); // Kacyiru hill
    expect(level(100, 110)).toBe(6); // Kimihurura hill
    expect(level(160, 100)).toBe(4); // Kicukiro plateau
    expect(level(150, 32)).toBeLessThan(level(150, 15) - 4); // Nyarutarama golf valley between two ridges
    expect(level(2, 40)).toBe(5); // Kimisagara hillside, in level 1
    // The road from Nyabugogo to Kacyiru climbs about 19%.
    const slope = world.slopeAt(70 * T, 21 * T);
    expect(slope.dx).toBeGreaterThan(0.15);
    expect(world.isSolidAt(10 * T, 1 * T)).toBe(true); // the river
  });

  it('has murram and cobblestone roads as well as tarmac', () => {
    const count = (s) => world.tiles.filter((t) => t.surface === s).length;
    expect(count('murram')).toBeGreaterThan(400);
    expect(count('cobble')).toBeGreaterThan(400);
  });

  it('closes districts: a closed district is solid', () => {
    const w = new World(buildKigaliMap());
    w.setOpenDistricts(['nyabugogo']);
    expect(w.isSolidAt(30 * T, 21 * T)).toBe(false);
    expect(w.isSolidAt(80 * T, 21 * T)).toBe(true);
    w.setOpenDistricts(['nyabugogo', 'kacyiru']);
    expect(w.isSolidAt(80 * T, 21 * T)).toBe(false);
  });

  it('has speed limit zones', () => {
    expect(speedLimitAt(world, 30 * T, 10 * T).limitKmh).toBe(30);
    expect(speedLimitAt(world, 30 * T, 105 * T).limitKmh).toBe(40);
    expect(speedLimitAt(world, 100 * T, 20 * T).limitKmh).toBe(50);
  });

  it('draws one chunk of ground small enough for phone GPUs', () => {
    const c = renderTerrain(world, { tx0: 24, ty0: 72, tx1: 48, ty1: 96 });
    expect(c.width).toBeLessThanOrEqual(2048);
    expect(c.height).toBeLessThanOrEqual(2048);
  });
});

import { openRoads, buildRoadGraph } from '../src/sim/roads.js';
describe('roads in the open districts', () => {
  it('cuts roads at the edge of closed districts', () => {
    const roads = openRoads(world.roads, world.districts, ['nyabugogo']);
    for (const r of roads) {
      if (r.y !== undefined) expect(r.x1, r.name).toBeLessThan(64);
      else expect(r.y1, r.name).toBeLessThan(64);
    }
    const graph = buildRoadGraph(roads);
    expect(graph.nodes.every((n) => n.x <= 64 * T && n.y <= 64 * T)).toBe(true);
    expect(openRoads(world.roads, world.districts, world.districts.map((d) => d.id)).length).toBeGreaterThanOrEqual(world.roads.length);
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

describe('Ampersand showroom', () => {
  it('stands on Kacyiru boulevard, and level 4 sells the electric moto there', async () => {
    const { LEVELS } = await import('../src/config.js');
    const office = world.placesWithTag('office');
    expect(office).toHaveLength(1);
    expect(world.tile(Math.floor(office[0].x), Math.floor(office[0].y)).district).toBe('kacyiru');
    expect(world.tileAt(office[0].x * T, office[0].y * T).block).toBeNull();
    const lv = LEVELS.find((l) => l.buyAt === 'office');
    expect(lv.effect).toBe('electric');
    expect(world.landmarks.find((l) => l.brand).sign).toBe('AMPERSAND');
  });
});
