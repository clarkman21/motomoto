import { describe, it, expect } from 'vitest';
import { drawBicycleTaxi, drawGameOverBackdrop, drawJailCell, BICYCLE_CANVAS, BACKDROP_ROAD } from '../src/world/bicycle-sprites.js';
import { COLOURS, GAME_OVER } from '../src/config.js';

const opaque = (c) => { let n = 0; for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++; return n; };
const hasColour = (c, rgb) => {
  for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] && ((c.data[i] << 16) | (c.data[i + 1] << 8) | c.data[i + 2]) === rgb) return true;
  return false;
};

describe('game over picture: the bicycle taxi', () => {
  it('draws each pedal frame, and the frames are different', () => {
    const frames = Array.from({ length: GAME_OVER.bicycleFrames }, (_, f) => drawBicycleTaxi(f, GAME_OVER.bicycleFrames));
    for (const c of frames) {
      expect(c.width).toBe(BICYCLE_CANVAS.width);
      expect(opaque(c)).toBeGreaterThan(400);
    }
    expect(Buffer.from(frames[0].data).equals(Buffer.from(frames[1].data))).toBe(false);
  });

  it('the wheels touch the ground line', () => {
    const c = drawBicycleTaxi(0);
    let low = 0;
    for (let x = 0; x < c.width; x++) if (c.alphaAt(x, BICYCLE_CANVAS.groundY - 1)) low++;
    expect(low).toBeGreaterThan(2);
  });

  it('the backdrop fills its size and has a road at the bottom', () => {
    const c = drawGameOverBackdrop(200, 70);
    expect(opaque(c)).toBe(200 * 70);
    expect(BACKDROP_ROAD).toBeLessThan(70);
  });

  it('does not use Surge Yellow (only for Ampersand)', () => {
    expect(hasColour(drawBicycleTaxi(1), COLOURS.ampersandYellow)).toBe(false);
    expect(hasColour(drawGameOverBackdrop(120, 60), COLOURS.ampersandYellow)).toBe(false);
  });

  it('draws the jail cell: two frames (head down, head up), full size', () => {
    const a = drawJailCell(200, 70, 0), b = drawJailCell(200, 70, 1);
    expect(opaque(a)).toBe(200 * 70);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(false);
    expect(hasColour(a, COLOURS.ampersandYellow)).toBe(false);
  });
});
