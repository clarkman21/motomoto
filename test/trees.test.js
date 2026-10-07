import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { drawBlock, treeKind } from '../src/world/sprites.js';

const world = new World(buildKigaliMap());
const trees = world.blocks.filter((b) => b.kind === 'tree');

describe('trees', () => {
  it('has acacias, jacarandas, avocados and figs, with more jacarandas in town than in Nyabugogo', () => {
    const count = (district, kind) => trees.filter((b) => world.tile(b.tx, b.ty).district === district && treeKind(world, b.tx, b.ty) === kind).length;
    const all = new Set(trees.map((b) => treeKind(world, b.tx, b.ty)));
    expect([...all].sort()).toEqual(['acacia', 'avocado', 'fig', 'jacaranda']);
    const share = (d, k) => count(d, k) / trees.filter((b) => world.tile(b.tx, b.ty).district === d).length;
    expect(share('town', 'jacaranda')).toBeGreaterThan(share('nyabugogo', 'jacaranda'));
  });

  it('draws a jacaranda with purple flowers', () => {
    const b = trees.find((t) => treeKind(world, t.tx, t.ty) === 'jacaranda');
    const c = drawBlock(b, world).canvas;
    let purple = 0;
    for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] && c.data[i + 2] > c.data[i + 1] + 40 && c.data[i] > c.data[i + 1]) purple++;
    expect(purple).toBeGreaterThan(200);
  });
});
