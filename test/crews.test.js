import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { mulberry32 } from '../src/sim/jobs.js';
import { placeCrews, crewAt, crewFrame, sweepersOut, crewTiles, daySweepers } from '../src/sim/crews.js';
import { createPeople, stepPeople } from '../src/sim/people.js';
import { eventStage } from '../src/sim/events.js';
import { districtsForLevel } from '../src/sim/levels.js';
import { CREWS, WORLD, EVENTS } from '../src/config.js';
import { drawWorker, PERSON_LOOKS, CITY_SWEEPER_LOOKS } from '../src/world/vehicle-sprites.js';
import { drawCargoPile } from '../src/world/sprites.js';

const world = new World(buildKigaliMap());
const T = WORLD.tileMetres;
const ROADS = ['tarmac', 'murram', 'murramWet', 'cobble'];
const inCrowd = (tx, ty) => world.crowdAreas.some((a) => tx >= a.x0 && tx < a.x1 && ty >= a.y0 && ty < a.y1);

describe('Umuganda crews', () => {
  const districts = districtsForLevel(6);
  const crews = placeCrews(world, mulberry32(4), 'umuganda', { districts, looks: PERSON_LOOKS.length });

  it('many people work in every open district, with hoes and brooms', () => {
    expect(crews.length).toBeGreaterThanOrEqual(CREWS.umuganda.perDistrict * districts.length * 0.9);
    expect(crews.some((w) => w.task === 'hoe')).toBe(true);
    expect(crews.some((w) => w.task === 'sweep')).toBe(true);
    for (const d of districts) expect(crews.filter((w) => world.districtAt(Math.floor(w.x / T), Math.floor(w.y / T)) === d).length).toBeGreaterThan(10);
  });

  it('hoes in the fields beside the roads; brooms on the pavement or the road edge', () => {
    for (const w of crews) {
      const t = world.tileAt(w.x, w.y);
      if (w.task === 'hoe') expect(t.surface).toBe('grass');
      else expect(['pavement', ...ROADS]).toContain(t.surface);
      expect(t.block).toBeFalsy();
    }
  });

  it('a crew at the work site of an Umuganda run', () => {
    const site = world.places.find((p) => p.id === 'golf');
    const c = crewAt(world, mulberry32(1), site.x, site.y, CREWS.siteCrew, 500);
    expect(c.length).toBe(CREWS.siteCrew);
    for (const w of c) expect(Math.hypot(w.x / T - site.x, w.y / T - site.y)).toBeLessThan(6);
  });

  it('each worker moves the tool: two frames', () => {
    const w = crews[0];
    const frames = new Set([0, 100, 200, 300, 400, 500, 600, 700].map((ms) => crewFrame(w, ms)));
    expect(frames).toEqual(new Set([0, 1]));
    for (const task of ['hoe', 'sweep']) for (const f of [0, 1]) {
      expect(drawWorker(PERSON_LOOKS[0], task, f).width).toBeGreaterThan(0);
      expect(drawWorker(PERSON_LOOKS[7], task, f).width).toBeGreaterThan(0); // a mama in kitenge
    }
  });

  it('the Umuganda morning has no traffic (only the police patrols)', () => {
    expect(EVENTS.umuganda.trafficShare).toBe(0);
    expect(eventStage('umuganda', 8).trafficFull).toBe(false);
  });
});

describe('city road sweepers', () => {
  it('ladies in green sweep all day: all of them in the morning, half after it', () => {
    const s = placeCrews(world, mulberry32(2), 'sweepers', { districts: ['nyabugogo', 'town'] });
    expect(s.length).toBe(CREWS.sweepers.perDistrict * 2);
    expect(s.every((w) => w.task === 'sweep' && /^city[0-2]$/.test(w.look))).toBe(true);
    expect(sweepersOut(6.5)).toBe(true);
    expect(sweepersOut(15)).toBe(true);
    expect(sweepersOut(21)).toBe(false);
    expect(daySweepers(s).length).toBe(Math.ceil(s.length * CREWS.sweepers.dayShare));
    for (const look of CITY_SWEEPER_LOOKS) expect(drawWorker(look, 'sweep', 1).width).toBeGreaterThan(0);
    expect(crewTiles(world, 'sweep', ['town']).length).toBeGreaterThan(20);
  });
});

describe('walkers keep off the roads', () => {
  it('after 2 minutes, the walkers are on pavements, verges or market squares, not on the roads', () => {
    const people = createPeople(world, mulberry32(7), { districts: districtsForLevel(6), walkers: 300 });
    const bike = { x: -1000, y: -1000, vx: 0, vy: 0, heading: 0 };
    for (let i = 0; i < 1200; i++) stepPeople(people, world, bike, world.places, 0.1);
    const onRoad = people.walkers.filter((p) => {
      const t = world.tileAt(p.x, p.y);
      return t && ROADS.includes(t.surface) && !inCrowd(t.tx, t.ty);
    });
    expect(onRoad.length).toBeLessThanOrEqual(3); // a walker can stand at a road edge after a step to the side
  });
});

describe('pickup graphics', () => {
  it('the Umuganda tools and the batteries have a picture at the pickup', () => {
    for (const goods of ['tools', 'batteries']) {
      const c = drawCargoPile(goods);
      let filled = 0;
      for (let i = 3; i < c.data.length; i += 4) if (c.data[i] > 0) filled++;
      expect(filled).toBeGreaterThan(40);
    }
  });
});
