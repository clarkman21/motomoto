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

import { drawRetroFontSheet, RETRO_CHARS, retroText, wrapRetro } from '../src/world/retro-font.js';
describe('retro menu font', () => {
  it('has a glyph for every character in the sheet', () => {
    const c = drawRetroFontSheet();
    expect(c.width).toBe(16 * 6);
    expect([...RETRO_CHARS].length).toBeGreaterThan(60);
  });

  it('shows text in capitals and wraps it at spaces', () => {
    expect(retroText('Go to Kiyovu')).toBe('GO TO KIYOVU');
    expect(retroText('−3,000 RWF · Lycée')).toBe('-3,000 RWF · LYCEE');
    const lines = wrapRetro('one two three four five', 9);
    expect(lines.every((l) => l.length <= 9)).toBe(true);
    expect(lines.join(' ')).toBe('ONE TWO THREE FOUR FIVE');
  });
});

describe('HUD icons', () => {
  it('draws every icon 9 × 9, and only the battery uses Surge Yellow', async () => {
    const { drawIconSheet, ICONS } = await import('../src/world/hud-icons.js');
    const { COLOURS } = await import('../src/config.js');
    const { canvas, frames } = drawIconSheet();
    expect(Object.keys(frames)).toEqual(Object.keys(ICONS));
    for (const [name, f] of Object.entries(frames)) {
      let surge = 0, opaque = 0;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const i = (y * canvas.width + f.x + x) * 4;
        if (!canvas.data[i + 3]) continue;
        opaque++;
        if (((canvas.data[i] << 16) | (canvas.data[i + 1] << 8) | canvas.data[i + 2]) === COLOURS.ampersandYellow) surge++;
      }
      expect(opaque).toBeGreaterThan(15);
      if (name !== 'battery') expect(surge).toBe(0);
    }
  });
});

describe('lane markings', () => {
  it('mark both rows of a road, but not the tiles where two roads cross', async () => {
    const { laneMarkings } = await import('../src/world/terrain-render.js');
    const world = { roads: [{ y: 5, x0: 0, x1: 20 }, { x: 10, y0: 0, y1: 20 }] };
    const m = laneMarkings(world);
    expect(m.get('3,5')).toEqual({ alongX: true, edge: 'high' });
    expect(m.get('3,6')).toEqual({ alongX: true, edge: 'low' });
    expect(m.get('10,2')).toEqual({ alongX: false, edge: 'high' });
    for (const k of ['10,5', '11,5', '10,6', '11,6']) expect(m.has(k)).toBe(false);
  });
});
