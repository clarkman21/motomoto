import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { drawMinimap, minimapSize, minimapPoint, minimapDirection, districtLabels } from '../src/world/minimap.js';
import { WORLD } from '../src/config.js';

const T = WORLD.tileMetres;
const world = new World(buildKigaliMap());
const pixel = (c, x, y) => {
  const i = (Math.floor(y) * c.width + Math.floor(x)) * 4;
  return [c.data[i], c.data[i + 1], c.data[i + 2], c.data[i + 3]];
};

describe('minimap', () => {
  it('is a diamond of 320 × 160 px for the Kigali map at 1 px per tile', () => {
    expect(minimapSize(world, 1)).toEqual({ width: 320, height: 160 });
    const c = drawMinimap(world, 1);
    expect(pixel(c, 0, 0)[3]).toBe(0); // outside the map: transparent
    expect(pixel(c, 160, 80)[3]).toBe(255);
  });

  it('puts the map corners at the diamond corners', () => {
    expect(minimapPoint(world, 1, 0, 0)).toEqual({ x: 128, y: 0 });
    expect(minimapPoint(world, 1, 192 * T, 0)).toEqual({ x: 320, y: 96 });
    expect(minimapPoint(world, 1, 0, 128 * T)).toEqual({ x: 0, y: 64 });
  });

  it('turns a world heading into the same screen direction as the game view', () => {
    const east = minimapDirection(0); // world +x: to the lower right
    expect(east.x).toBeGreaterThan(0);
    expect(east.y).toBeGreaterThan(0);
    const north = minimapDirection(-Math.PI / 2); // world −y: to the upper right
    expect(north.x).toBeGreaterThan(0);
    expect(north.y).toBeLessThan(0);
  });

  it('makes closed districts dark and names every district', () => {
    world.setOpenDistricts(['nyabugogo']);
    const c = drawMinimap(world, 1);
    const kic = world.districts.find((d) => d.id === 'kicukiro');
    const p = minimapPoint(world, 1, ((kic.x0 + kic.x1) / 2) * T, ((kic.y0 + kic.y1) / 2) * T);
    const [r, g, b] = pixel(c, p.x, p.y);
    expect(Math.max(r, g, b)).toBeLessThan(90);
    expect(Math.abs(r - b)).toBeLessThan(12); // grey
    const labels = districtLabels(world, 1);
    expect(labels).toHaveLength(6);
    expect(labels.find((l) => l.id === 'nyabugogo').open).toBe(true);
    expect(labels.find((l) => l.id === 'kicukiro').open).toBe(false);
    world.setOpenDistricts(world.districts.map((d) => d.id));
  });
});
