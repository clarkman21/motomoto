import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { buildRoadGraph } from '../src/sim/roads.js';
import { rescueOffer, createRescue, stepRescue } from '../src/sim/rescue.js';
import { MONEY, FUEL, RESCUE, WORLD } from '../src/config.js';

const T = WORLD.tileMetres;

describe('the emergency fuel moto (T)', () => {
  it('brings 1 litre of petrol for the station price plus 20%', () => {
    const o = rescueOffer('petrol', 1);
    expect(o.energy).toBeCloseTo(1 / FUEL.tankLitres);
    expect(o.cost).toBe(Math.round(((MONEY.fuelFullTank / FUEL.tankLitres) * (1 + RESCUE.premium)) / 10) * 10);
    expect(o.cost).toBeGreaterThan((MONEY.fuelFullTank / FUEL.tankLitres));
  });

  it('brings a charged battery to the electric moto for the swap fee plus 20%', () => {
    expect(rescueOffer('electric').energy).toBe(1);
    expect(rescueOffer('electric').cost).toBe(MONEY.swapFee * (1 + RESCUE.premium));
  });

  it('rides from the nearest station along the roads to you, hands over the fuel, and leaves', () => {
    const world = new World(buildKigaliMap());
    const graph = buildRoadGraph(world.roads);
    const stations = world.placesWithTag('fuel');
    const bike = { x: 10 * T, y: 21 * T }; // on the northern road
    const r = createRescue(graph, stations, bike);
    expect(r).not.toBeNull();
    expect(r.eta).toBeGreaterThan(RESCUE.answerSeconds);
    const events = [];
    for (let t = 0; t < 300 && r.state !== 'gone'; t += 1 / 30) events.push(...stepRescue(r, bike, 1 / 30));
    expect(events).toEqual(['arrived', 'delivered', 'gone']);
  });

  it('there is no moto when there is no station', () => {
    const world = new World(buildKigaliMap());
    expect(createRescue(buildRoadGraph(world.roads), [], { x: 0, y: 0 })).toBeNull();
  });
});
