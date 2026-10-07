import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { TEST_MAP } from '../src/world/map-data.js';
import { renderTerrain } from '../src/world/terrain-render.js';
import { drawBike, drawBlock, bikeFrameForHeading, BIKE_DIRECTIONS } from '../src/world/sprites.js';

const opaque = (c) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe('renderers', () => {
  const world = new World(TEST_MAP);

  it('draws the terrain into a texture that WebGL can hold', () => {
    const c = renderTerrain(world);
    expect(c.width).toBeLessThanOrEqual(4096);
    expect(c.height).toBeLessThanOrEqual(4096);
    expect(opaque(c)).toBeGreaterThan(c.width * c.height * 0.4);
  });

  it('draws every bike frame', () => {
    for (const type of ['petrol', 'electric']) {
      for (let f = 0; f < BIKE_DIRECTIONS; f++) expect(opaque(drawBike(type, f))).toBeGreaterThan(80);
    }
  });

  it('draws every block', () => {
    for (const b of world.blocks) expect(opaque(drawBlock(b, world).canvas)).toBeGreaterThan(50);
  });

  it('picks the nearest of 16 frames', () => {
    expect(bikeFrameForHeading(0)).toBe(0);
    expect(bikeFrameForHeading(-Math.PI / 2)).toBe(12);
    expect(bikeFrameForHeading(Math.PI)).toBe(8);
  });
});

import { drawGarageSign, textWidth, drawMechanic, drawOilStain } from '../src/world/garage-sprites.js';
describe('garage sprites', () => {
  it('draws the sign with the name and the garage line', () => {
    const { canvas } = drawGarageSign('KAZI NI KAZI', 'MOTO GARAGE');
    expect(canvas.width).toBeGreaterThan(textWidth('KAZI NI KAZI'));
    expect(canvas.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    expect(textWidth('N')).toBe(4); // wider than a plain letter, so it does not look like D
  });

  it('draws mechanics and oil stains', () => {
    expect(drawMechanic(0).data).not.toEqual(drawMechanic(1).data); // the arm moves
    expect(drawOilStain(1).data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });
});
