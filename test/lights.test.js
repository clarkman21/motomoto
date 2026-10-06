import { describe, it, expect } from 'vitest';
import { drawLightPool, drawHeadlightCone, drawLightDot, drawLampPost, lampHeadOffset } from '../src/world/light-sprites.js';
import { drawBlock } from '../src/world/sprites.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { World } from '../src/world/world.js';
import { LIGHTS } from '../src/config.js';

const alpha = (c, x, y) => c.alphaAt(x, y);

describe('night lights', () => {
  it('a light pool is brightest at the centre and empty at the corners', () => {
    const c = drawLightPool(LIGHTS.poolRadiusMetres, LIGHTS.poolColour, LIGHTS.poolAlpha);
    const cx = c.width >> 1, cy = c.height >> 1;
    expect(alpha(c, cx, cy)).toBe(LIGHTS.poolAlpha);
    expect(alpha(c, 0, 0)).toBe(0);
    expect(alpha(c, cx + (c.width >> 2), cy)).toBeLessThan(alpha(c, cx, cy));
  });

  it('a headlight cone points in the direction of its frame', () => {
    const c = drawHeadlightCone(0); // heading +x: screen right and down
    const cx = c.width >> 1, cy = c.height >> 1;
    expect(alpha(c, cx + 24, cy + 12)).toBeGreaterThan(0);
    expect(alpha(c, cx - 24, cy - 12)).toBe(0); // nothing behind the vehicle
  });

  it('light dots and lamp posts have pixels', () => {
    const d = drawLightDot(2, 0xffffff);
    expect(alpha(d, 2, 2)).toBe(255);
    for (const side of ['north', 'south', 'west', 'east']) {
      expect(drawLampPost(side).data.some((v) => v > 0)).toBe(true);
      expect(lampHeadOffset(side).y).toBeLessThan(-40); // the head is high above the ground
    }
  });

  it('the map has street lamps beside tarmac roads, not on buildings', () => {
    const map = buildKigaliMap();
    const world = new World(map);
    expect(map.lamps.length).toBeGreaterThan(60);
    for (const l of map.lamps) {
      const c = map.rows[Math.floor(l.y)][Math.floor(l.x)];
      expect(['.', 'p', '#', 'o', '=']).toContain(c);
    }
    expect(world.lamps).toBe(map.lamps);
  });

  it('buildings have lit windows at night, trees do not', () => {
    const world = new World(buildKigaliMap());
    const buildings = world.blocks.filter((b) => b.kind === 'building').slice(0, 40);
    const lit = buildings.filter((b) => drawBlock(b, world).glow);
    expect(lit.length).toBeGreaterThan(10);
    const tree = world.blocks.find((b) => b.kind === 'tree');
    expect(drawBlock(tree, world).glow).toBe(null);
  });
});
