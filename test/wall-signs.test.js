import { describe, it, expect } from 'vitest';
import { drawWallSign } from '../src/world/garage-sprites.js';

// Building signs lie flat on their wall (Alp, 14 October 2026): the board is sheared 2:1, the letters stay upright.

const opaqueRows = (c, x) => {
  const rows = [];
  for (let y = 0; y < c.height; y++) if (c.data[(y * c.width + x) * 4 + 3]) rows.push(y);
  return rows;
};

describe('wall signs', () => {
  it('the board follows the wall: on a south wall it goes down to the right, on an east wall down to the left', () => {
    for (const face of ['south', 'east']) {
      const s = drawWallSign('IBIRO', 'KA NYARUGENGE', 'wall', face);
      const c = s.canvas;
      const left = opaqueRows(c, 2)[0], right = opaqueRows(c, c.width - 3)[0];
      if (face === 'south') expect(right - left).toBeGreaterThan(c.width / 2 - 4);
      else expect(left - right).toBeGreaterThan(c.width / 2 - 4);
      expect(c.height).toBeGreaterThanOrEqual(s.boardHeight + Math.floor(c.width / 2));
      expect(s.groundY).toBeLessThan(c.height);
    }
  });

  it('a long wall gets the big font; a short wall the small one', () => {
    const big = drawWallSign('POLISI', '', 'wall', 'south', 200), small = drawWallSign('POLISI', '', 'wall', 'south', 30);
    expect(big.boardHeight).toBeGreaterThan(small.boardHeight);
    expect(big.canvas.width).toBeGreaterThan(small.canvas.width);
  });

  it('the roof names of towers and hotels use the big font', () => {
    const s = drawWallSign('KIGALI CITY TOWER', '', 'roof', 'south');
    expect(s.canvas.width).toBeGreaterThanOrEqual('KIGALI CITY TOWER'.length * 6);
  });
});
