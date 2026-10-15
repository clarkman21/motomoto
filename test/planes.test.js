import { describe, it, expect } from 'vitest';
import { createPlanes, stepPlanes, jetLevel } from '../src/sim/planes.js';
import { drawPlane, drawPlaneShadow } from '../src/world/plane-sprites.js';
import { buildKigaliMap, AIRPORT } from '../src/world/maps/kigali.js';
import { World } from '../src/world/world.js';
import { PLANES, WORLD } from '../src/config.js';

// Kigali International Airport: the runway, the apron, the fence and the plane that takes off.

const T = WORLD.tileMetres;
const run = (planes, seconds, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...stepPlanes(planes, dt));
  return events;
};

describe('the airport', () => {
  const world = new World(buildKigaliMap());

  it('has a runway, an apron, a terminal place and a fence with no gate', () => {
    expect(world.airport).toBe(AIRPORT);
    const rwY = AIRPORT.runway.y0 + 1;
    expect(world.tileAt((AIRPORT.x0 + 5) * T, rwY * T).surface).toBe('runway');
    expect(world.tileAt((AIRPORT.x0 + 5) * T, (AIRPORT.y0 + 1) * T).surface).toBe('apron');
    expect(world.places.find((p) => p.id === 'airport')?.tags).toContain('airport');
    const fence = world.walls.filter((w) => w.fence);
    expect(fence.length).toBeGreaterThan(40);
    expect(fence.every((w) => !w.gate)).toBe(true);
  });

  it('the parked plane stands on the apron', () => {
    const planes = createPlanes(world.airport);
    expect(world.tileAt(planes.parked.x, planes.parked.y).surface).toBe('apron');
    expect(world.tileAt(planes.startX, planes.runwayY).surface).toBe('runway');
  });
});

describe('a take-off', () => {
  it('waits, comes into view, rolls west, lifts before the end of the runway and flies away', () => {
    const planes = createPlanes(AIRPORT);
    const f = planes.flight;
    run(planes, PLANES.firstSeconds - 1);
    expect(f.phase).toBe('wait');
    run(planes, 1.2);
    expect(f.phase).toBe('hold');
    const events = run(planes, PLANES.fadeSeconds + PLANES.holdSeconds);
    expect(events.map((e) => e.type)).toEqual(['roll']);
    expect(f.alpha).toBe(1);
    let liftX = null;
    for (let i = 0; i < 400 && f.phase !== 'wait'; i++) {
      stepPlanes(planes, 0.1);
      if (liftX === null && f.z > 0) liftX = f.x;
    }
    expect(liftX / T).toBeGreaterThan(AIRPORT.x0 + 3); // it lifts on the runway
    expect(liftX / T).toBeLessThan(AIRPORT.x1 - 3);
    expect(f.phase).toBe('wait');
    expect(f.t).toBeCloseTo(PLANES.everySeconds, 0);
  });

  it('the jet is loud near the runway during the roll, and quiet far away or when no plane moves', () => {
    const planes = createPlanes(AIRPORT);
    expect(jetLevel(planes, planes.startX, planes.runwayY)).toBe(0);
    run(planes, PLANES.firstSeconds + PLANES.fadeSeconds + PLANES.holdSeconds + 1);
    const f = planes.flight;
    expect(f.phase).toBe('roll');
    expect(jetLevel(planes, f.x, f.y + 30)).toBeGreaterThan(0.6);
    expect(jetLevel(planes, f.x + 400, f.y)).toBe(0);
  });

  it('no airport: no planes', () => {
    expect(createPlanes(null)).toBeNull();
    expect(stepPlanes(null, 1)).toEqual([]);
    expect(jetLevel(null, 0, 0)).toBe(0);
  });
});

describe('the plane sprite', () => {
  it('is drawn in Node, with the ground point inside the canvas, and the shadow has the same shape size', () => {
    for (const [gear, west] of [[true, false], [true, true], [false, true]]) {
      const { canvas, groundX, groundY } = drawPlane({ gear, west });
      expect(canvas.width).toBeGreaterThan(100);
      expect(groundX).toBeGreaterThan(0);
      expect(groundX).toBeLessThan(canvas.width);
      expect(groundY).toBeLessThan(canvas.height);
      let opaque = 0;
      for (let i = 3; i < canvas.data.length; i += 4) opaque += canvas.data[i] ? 1 : 0;
      expect(opaque).toBeGreaterThan(2000);
    }
    const s = drawPlaneShadow();
    expect(s.canvas.width).toBeGreaterThan(100);
  });

  it('has no Ampersand yellow on it', () => {
    const { canvas } = drawPlane();
    for (let i = 0; i < canvas.data.length; i += 4) {
      const [r, g, b] = [canvas.data[i], canvas.data[i + 1], canvas.data[i + 2]];
      expect(r === 0xfc && g === 0xdc && b === 0x04).toBe(false);
    }
  });
});
