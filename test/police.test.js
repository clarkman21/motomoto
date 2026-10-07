import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { policeSpots, drawOfficer } from '../src/world/police.js';
import { VEST } from '../src/world/sprites.js';
import { WORLD } from '../src/config.js';

const T = WORLD.tileMetres;
const world = new World(buildKigaliMap());
const graph = buildRoadGraph(world.roads);

describe('traffic police', () => {
  const spots = policeSpots(world, graph);

  it('stand on the corners of most junctions, in every district, off the road', () => {
    const junctions = graph.nodes.filter((n) => new Set(n.out.map((e) => `${Math.round(e.dx)},${Math.round(e.dy)}`)).size >= 3);
    expect(spots.length).toBeGreaterThan(junctions.length * 0.5);
    expect(new Set(spots.map((s) => world.tileAt(s.x, s.y).district)).size).toBe(6);
    for (const s of spots) {
      const t = world.tileAt(s.x, s.y);
      expect(['pavement', 'grass']).toContain(t.surface);
      expect(t.block).toBeNull();
      // Close to a junction (within 3 tiles of a node with 3 or more ways).
      expect(junctions.some((n) => Math.hypot(n.x - s.x, n.y - s.y) < 3 * T)).toBe(true);
    }
  });

  it('wear a high visibility vest over a dark blue uniform', () => {
    const c = drawOfficer(1);
    let vest = 0, blue = 0;
    for (let i = 0; i < c.data.length; i += 4) {
      const rgb = (c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2];
      if (rgb === VEST.colour) vest++;
      if (rgb === 0x1c2a5a) blue++;
    }
    expect(vest).toBeGreaterThan(10);
    expect(blue).toBeGreaterThan(10);
  });
});
