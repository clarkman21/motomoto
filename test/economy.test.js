import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { TEST_MAP } from '../src/world/map-data.js';
import { createBike, stepBike } from '../src/sim/bike.js';
import { createWallet, earn, buyFuel, swapBattery, fuelFillCost, repairCost, endDay } from '../src/sim/economy.js';
import { speedLimitAt, checkCameras, createCameraState, cameraFine } from '../src/sim/law.js';
import { createJobBoard, acceptOffer, updateJob, updateBoard, jobTarget, makeOffer, mulberry32 } from '../src/sim/jobs.js';
import { MONEY, LAW, JOBS, WORLD } from '../src/config.js';

const T = WORLD.tileMetres;
const world = new World(TEST_MAP);

describe('map places', () => {
  it('every place is on a tile you can ride on', () => {
    for (const p of world.places) expect(world.isSolidAt(p.x * T, p.y * T), p.name).toBe(false);
  });

  it('has a fuel station and a swap station', () => {
    expect(world.place('fuel')).not.toBeNull();
    expect(world.place('swap')).not.toBeNull();
    expect(world.blocks.some((b) => b.kind === 'fuel')).toBe(true);
    expect(world.blocks.some((b) => b.kind === 'swap')).toBe(true);
  });
});

describe('speed limits and cameras', () => {
  it('gives the zone limit inside a zone and the default outside', () => {
    expect(speedLimitAt(world, 30 * T, 3 * T).limitKmh).toBe(30);
    expect(speedLimitAt(world, 19.5 * T, 19.5 * T).limitKmh).toBe(40);
    expect(speedLimitAt(world, 2.5 * T, 30 * T).limitKmh).toBe(LAW.defaultLimitKmh);
  });

  it('fines only above the tolerance, and more when far over', () => {
    expect(cameraFine(34, 30)).toBe(0);
    expect(cameraFine(40, 30)).toBe(LAW.cameraFine);
    expect(cameraFine(50, 30)).toBe(LAW.cameraFineHigh);
  });

  it('a camera measures the bike once per pass', () => {
    const state = createCameraState(world);
    const bike = createBike(world);
    const cam = world.cameras[0];
    bike.x = cam.x * T;
    bike.y = 3 * T;
    const first = checkCameras(world, state, bike, 50);
    expect(first).toEqual([expect.objectContaining({ type: 'camera', limitKmh: 30, fine: LAW.cameraFineHigh })]);
    expect(checkCameras(world, state, bike, 50)).toEqual([]);
    bike.x += 20;
    checkCameras(world, state, bike, 50);
    bike.x -= 20;
    expect(checkCameras(world, state, bike, 20)[0].fine).toBe(0);
  });
});

describe('money', () => {
  it('fuel costs only the part of the tank that you fill', () => {
    const wallet = createWallet(10000);
    const bike = createBike(world, 'petrol');
    bike.energy = 0.25;
    expect(fuelFillCost(bike)).toBe(MONEY.fuelFullTank * 0.75);
    expect(buyFuel(wallet, bike)).toEqual({ ok: true, cost: 3000 });
    expect(bike.energy).toBe(1);
    expect(wallet.cash).toBe(7000);
  });

  it('with little cash, you get a part fill', () => {
    const wallet = createWallet(1000);
    const bike = createBike(world, 'petrol');
    bike.energy = 0;
    buyFuel(wallet, bike);
    expect(wallet.cash).toBe(0);
    expect(bike.energy).toBeCloseTo(0.25);
  });

  it('a swap is a flat fee and needs enough cash', () => {
    const bike = createBike(world, 'electric');
    bike.energy = 0.6;
    expect(swapBattery(createWallet(1000), bike).ok).toBe(false);
    const wallet = createWallet(5000);
    expect(swapBattery(wallet, bike)).toEqual({ ok: true, cost: MONEY.swapFee });
    expect(bike.energy).toBe(1);
  });

  it('charges repairs for real hits only', () => {
    expect(repairCost({ type: 'pothole' })).toBe(MONEY.repairs.pothole);
    expect(repairCost({ type: 'wall', speed: 2 })).toBe(0);
    expect(repairCost({ type: 'wall', speed: 10 })).toBe(MONEY.repairs.wall);
    expect(repairCost({ type: 'bumpSoft' })).toBe(0);
  });

  it('the day end bill has service, pads when worn, and rent', () => {
    const wallet = createWallet(20000);
    const bike = createBike(world, 'petrol');
    earn(wallet, 'fares', 9000);
    bike.odometer = 40 * JOBS.gameKmMetres; // 40 game km
    bike.brakePads = 0.4;
    const s = endDay(wallet, bike);
    expect(s.costs.service).toBe(40 * MONEY.servicePerGameKm.petrol);
    expect(s.costs.pads).toBe(MONEY.brakePads);
    expect(s.costs.rent).toBe(MONEY.dailyRent.petrol);
    expect(s.profit).toBe(9000 - s.totalCosts);
    expect(bike.brakePads).toBe(1);
    expect(bike.odometer).toBe(0);
    expect(wallet.day).toBe(2);
    expect(wallet.ledger.income.fares).toBe(0);
  });

  it('electric servicing costs less than petrol for the same distance', () => {
    const p = createBike(world, 'petrol');
    const e = createBike(world, 'electric');
    p.odometer = e.odometer = 4000;
    expect(endDay(createWallet(), e).costs.service).toBeLessThan(endDay(createWallet(), p).costs.service);
  });

  it('reports the money that regen saved today', () => {
    const bike = createBike(world, 'electric');
    bike.regenToday = 0.1;
    expect(endDay(createWallet(), bike).regenSaved).toBe(MONEY.swapFee * 0.1);
  });
});

describe('jobs', () => {
  it('offers passenger and cargo jobs; cargo starts at the market', () => {
    const rng = mulberry32(7);
    const offers = Array.from({ length: 60 }, (_, i) => makeOffer(world, rng, i));
    expect(offers.some((o) => o.type === 'passenger')).toBe(true);
    const cargo = offers.filter((o) => o.type === 'cargo');
    expect(cargo.length).toBeGreaterThan(5);
    for (const c of cargo) expect(c.from.tags).toContain('market');
    for (const o of offers) {
      expect(o.distanceMetres).toBeGreaterThanOrEqual(JOBS.minTripMetres);
      expect(o.pay).toBeGreaterThan(0);
    }
  });

  it('keeps three offers on the board', () => {
    const board = createJobBoard(world, 3);
    expect(board.offers).toHaveLength(JOBS.maxOffers);
    updateBoard(board, world, JOBS.offerLifeSeconds + 1);
    expect(board.offers).toHaveLength(JOBS.maxOffers);
  });

  it('runs a passenger job from pickup to drop off, with a tip from comfort', () => {
    const board = createJobBoard(world, 1);
    board.offers[0] = { ...makeOffer(world, mulberry32(1), 99), type: 'passenger', kg: 65, pay: 1000 };
    const job = acceptOffer(board, 0);
    const bike = createBike(world);
    // Ride to the pickup and stop there.
    const p = jobTarget(job);
    bike.x = p.x * T;
    bike.y = p.y * T;
    expect(updateJob(board, bike, [], 0.01)[0].type).toBe('pickup');
    expect(bike.loadKg).toBe(65);
    // A pothole on the way costs comfort.
    updateJob(board, bike, [{ type: 'pothole' }], 0.01);
    expect(job.comfort).toBe(100 - JOBS.comfortLoss.pothole);
    const d = jobTarget(job);
    bike.x = d.x * T;
    bike.y = d.y * T;
    const [done] = updateJob(board, bike, [], 0.01);
    expect(done.type).toBe('delivered');
    expect(done.fare).toBe(1000);
    expect(done.tip).toBe(Math.round((1000 * JOBS.passenger.maxTipFraction * 0.8) / 10) * 10);
    expect(board.active).toBeNull();
    expect(bike.loadKg).toBe(0);
  });

  it('you must stop to pick up', () => {
    const board = createJobBoard(world, 2);
    const job = acceptOffer(board, 0);
    const bike = createBike(world);
    bike.x = job.from.x * T;
    bike.y = job.from.y * T;
    bike.vx = 30 / 3.6;
    bike.heading = 0;
    expect(updateJob(board, bike, [], 0.01)).toEqual([]);
  });

  it('a load makes the bike slower to accelerate', () => {
    const flat = new World({ name: 'f', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(100), '#'.repeat(100), '#'.repeat(100)], hills: [] });
    const empty = createBike(flat, 'electric');
    const loaded = createBike(flat, 'electric');
    loaded.loadKg = 80;
    for (let t = 0; t < 3; t += 1 / 120) {
      stepBike(empty, { throttle: 1, brake: 0, steer: 0 }, flat, 1 / 120);
      stepBike(loaded, { throttle: 1, brake: 0, steer: 0 }, flat, 1 / 120);
    }
    expect(loaded.vx).toBeLessThan(empty.vx * 0.85);
  });
});
