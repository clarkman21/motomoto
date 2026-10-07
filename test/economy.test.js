import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world.js';
import { TEST_MAP } from '../src/world/map-data.js';
import { createBike, stepBike } from '../src/sim/bike.js';
import { createWallet, earn, buyFuel, swapBattery, fuelFillCost, repairCost, endDay, takeLoan, canTakeLoan, loanPayment, payGarage } from '../src/sim/economy.js';
import { speedLimitAt, checkCameras, createCameraState, cameraFine } from '../src/sim/law.js';
import { createJobBoard, acceptOffer, updateJob, updateBoard, jobTarget, makeOffer, mulberry32 } from '../src/sim/jobs.js';
import { MONEY, LAW, JOBS, WORLD, MAINTENANCE } from '../src/config.js';
import { serviceDue, garageQuote, rideWearKm } from '../src/sim/maintenance.js';
import { BIKES, SURFACES } from '../src/config.js';

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

  it('only a crash costs money at once', () => {
    expect(repairCost({ type: 'wall', speed: 2 })).toBe(0);
    expect(repairCost({ type: 'wall', speed: 4.5 })).toBe(MONEY.repairs.wall);
    expect(repairCost({ type: 'wall', speed: 10 })).toBeGreaterThan(repairCost({ type: 'wall', speed: 6 })); // harder hits cost more
    expect(repairCost({ type: 'pothole' })).toBe(0);
    expect(repairCost({ type: 'bumpHard' })).toBe(0);
  });

  it('the day end bill is the rent; service and pads are paid at the garage', () => {
    const wallet = createWallet(20000);
    const bike = createBike(world, 'petrol');
    earn(wallet, 'fares', 9000);
    bike.odometer = 40 * JOBS.gameKmMetres;
    const s = endDay(wallet, bike);
    expect(s.costs.rent).toBe(MONEY.dailyRent.petrol);
    expect(s.totalCosts).toBe(MONEY.dailyRent.petrol);
    expect(s.profit).toBe(9000 - MONEY.dailyRent.petrol);
    expect(bike.odometer).toBe(0);
    expect(wallet.day).toBe(2);
    expect(wallet.ledger.income.fares).toBe(0);
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
    expect(bike.loadType).toBe('passenger');
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

describe('out of cash and the loan', () => {
  it('a day that ends below zero offers one loan', () => {
    const wallet = createWallet(2000);
    const bike = createBike(world, 'petrol');
    const s = endDay(wallet, bike); // rent takes the cash below zero
    expect(s.cash).toBeLessThan(0);
    expect(s.outOfCash).toBe('loan');
  });

  it('the loan pays now and costs a payment at every day end, with interest', () => {
    const wallet = createWallet(-3000);
    expect(takeLoan(wallet)).toBe(true);
    expect(wallet.cash).toBe(-3000 + MONEY.loan.amount);
    const payment = loanPayment();
    expect(payment * MONEY.loan.days).toBe(MONEY.loan.amount * (1 + MONEY.loan.interest));
    earn(wallet, 'fares', 20000);
    const s = endDay(wallet, createBike(world, 'electric'));
    expect(s.costs.loan).toBe(payment);
    expect(wallet.loan.daysLeft).toBe(MONEY.loan.days - 1);
  });

  it('the loan ends after its last payment', () => {
    const wallet = createWallet(0);
    takeLoan(wallet);
    for (let d = 0; d < MONEY.loan.days; d++) {
      earn(wallet, 'fares', 10000);
      endDay(wallet, createBike(world, 'electric'));
    }
    expect(wallet.loan).toBeNull();
  });

  it('out of cash again is game over: only one loan', () => {
    const wallet = createWallet(0);
    takeLoan(wallet);
    expect(canTakeLoan(wallet)).toBe(false);
    wallet.cash = -50000;
    expect(endDay(wallet, createBike(world, 'petrol')).outOfCash).toBe('gameOver');
  });

  it('no loan when the debt is larger than the loan', () => {
    const wallet = createWallet(-MONEY.loan.amount - 100);
    expect(canTakeLoan(wallet)).toBe(false);
  });
});

describe('maintenance and the garage', () => {
  const ride = (ch, metres, type = 'petrol', setup = () => {}) => {
    const flat = new World({ name: 'f', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: [ch.repeat(500), ch.repeat(500), ch.repeat(500)], hills: [] });
    const bike = createBike(flat, type);
    bike.vx = 8;
    bike.gear = 2; // 3rd gear at 29 km/h: normal revs, no red zone
    setup(bike);
    const events = [];
    // Ride until the distance is done (with a time limit, so a stuck bike cannot hang the test).
    for (let t = 0; bike.odometer < metres && t < 600; t += 1 / 120) events.push(...stepBike(bike, { throttle: 0.5, brake: 0, steer: 0 }, flat, 1 / 120));
    return { bike, events };
  };
  const km = (bike) => bike.serviceWear;

  it('the service meter fills by distance × surface wear: off road 4×, murram 1.5×', () => {
    const calm = { revs: 0.5 };
    const tenKm = 10 * JOBS.gameKmMetres;
    expect(rideWearKm(calm, BIKES.petrol, SURFACES.tarmac, tenKm)).toBeCloseTo(10);
    expect(rideWearKm(calm, BIKES.petrol, SURFACES.grass, tenKm)).toBeCloseTo(40);
    expect(rideWearKm(calm, BIKES.petrol, SURFACES.murram, tenKm)).toBeCloseTo(15);
  });

  it('the petrol red zone fills the meter 3 times faster; electric has no red zone', () => {
    const d = JOBS.gameKmMetres;
    expect(rideWearKm({ revs: 0.95 }, BIKES.petrol, SURFACES.tarmac, d)).toBeCloseTo(MAINTENANCE.redlineWearFactor);
    expect(rideWearKm({ revs: 0.95 }, BIKES.electric, SURFACES.tarmac, d)).toBeCloseTo(1);
  });

  it('riding fills the meter (integrated)', () => {
    const { bike } = ride('#', 4 * JOBS.gameKmMetres);
    expect(km(bike)).toBeGreaterThan(3.9);
  });

  it('a pothole adds wear', () => {
    const flat = new World({ name: 'p', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(10), '###o######', '#'.repeat(10)], hills: [] });
    const bike = createBike(flat);
    bike.vx = 10;
    for (let t = 0; t < 0.8; t += 1 / 120) stepBike(bike, { throttle: 0, brake: 0, steer: 0 }, flat, 1 / 120);
    expect(km(bike)).toBeGreaterThan(MAINTENANCE.hazardWearKm.pothole);
  });

  it('warns at 80% and 100%, and breaks down at 150%', () => {
    const interval = MAINTENANCE.intervalKm.petrol;
    const { bike, events } = ride('#', 20, 'petrol', (b) => { b.serviceWear = interval * 0.8 - 0.1; });
    expect(events.some((e) => e.type === 'serviceSoon')).toBe(true);
    bike.serviceWear = interval - 0.01;
    const due = ride('#', 20, 'petrol', (b) => { b.serviceWear = interval - 0.1; });
    expect(due.events.some((e) => e.type === 'serviceDue')).toBe(true);
    const broken = ride('#', 20, 'petrol', (b) => { b.serviceWear = interval * 1.5 - 0.1; });
    expect(broken.events.some((e) => e.type === 'breakdown')).toBe(true);
    expect(broken.bike.brokenDown).toBe(true);
  });

  it('an overdue bike is slower and uses more fuel', () => {
    const interval = MAINTENANCE.intervalKm.petrol;
    const good = ride('#', 3 * JOBS.gameKmMetres, 'petrol', (b) => { b.gear = 2; }).bike;
    const tired = ride('#', 3 * JOBS.gameKmMetres, 'petrol', (b) => { b.gear = 2; b.serviceWear = interval * 1.45; }).bike;
    expect(1 - tired.energy).toBeGreaterThan((1 - good.energy) * 1.15);
  });

  it('a broken down bike can only be pushed', () => {
    const flat = new World({ name: 'f', start: { x: 1.5, y: 1.5, headingDeg: 0 }, rows: ['#'.repeat(100), '#'.repeat(100), '#'.repeat(100)], hills: [] });
    const bike = createBike(flat, 'petrol');
    bike.brokenDown = true;
    for (let t = 0; t < 5; t += 1 / 120) stepBike(bike, { throttle: 1, brake: 0, steer: 0 }, flat, 1 / 120);
    expect(bike.vx * 3.6).toBeLessThanOrEqual(4.1);
    expect(bike.pushing).toBe(true);
  });

  it('the garage resets the meter, fixes a breakdown and replaces worn pads', () => {
    const wallet = createWallet(10000);
    const bike = createBike(world, 'petrol');
    bike.serviceWear = 200;
    bike.brokenDown = true;
    bike.brakePads = 0.5;
    const r = payGarage(wallet, bike);
    expect(r).toEqual({ ok: true, cost: MAINTENANCE.serviceCost.petrol + MONEY.brakePads, pads: true });
    expect(wallet.cash).toBe(10000 - r.cost);
    expect(wallet.ledger.costs.garage).toBe(r.cost);
    expect(serviceDue(bike)).toBe(0);
    expect(bike.brokenDown).toBe(false);
    expect(bike.brakePads).toBe(1);
  });

  it('the garage has nothing to do on a new bike, and needs enough cash', () => {
    const bike = createBike(world, 'electric');
    expect(garageQuote(bike).nothing).toBe(true);
    bike.serviceWear = 100;
    expect(payGarage(createWallet(500), bike)).toEqual({ ok: false, cost: MAINTENANCE.serviceCost.electric, reason: 'cash' });
  });

  it('after a breakdown, the garage repairs on credit so you are never stuck', () => {
    const wallet = createWallet(1000);
    const bike = createBike(world, 'petrol');
    bike.serviceWear = 300;
    bike.brokenDown = true;
    const r = payGarage(wallet, bike);
    expect(r.ok).toBe(true);
    expect(wallet.cash).toBe(1000 - MAINTENANCE.serviceCost.petrol);
    expect(bike.brokenDown).toBe(false);
  });

  it('an electric moto needs a service 4 times less often', () => {
    const p = createBike(world, 'petrol');
    const e = createBike(world, 'electric');
    p.serviceWear = e.serviceWear = 60;
    expect(serviceDue(e)).toBeCloseTo(serviceDue(p) / 4);
  });

  it('an off road ride lowers passenger comfort', () => {
    const board = createJobBoard(world, 1);
    const job = acceptOffer(board, 0);
    job.stage = 'toDropoff';
    job.type = 'passenger';
    const bike = createBike(world);
    bike.offRoad = true;
    for (let t = 0; t < 2; t += 0.01) updateJob(board, bike, [], 0.01);
    expect(job.comfort).toBeCloseTo(100 - JOBS.comfortLoss.offRoadPerSecond * 2, 0);
  });
});

import { fuelChoices, fuelForMetres } from '../src/sim/economy.js';
import { FUEL } from '../src/config.js';
describe('buying the bare minimum of fuel', () => {
  it('offers enough for the next job, the next two jobs, or a full tank, in round amounts', () => {
    const bike = createBike(new World(TEST_MAP), 'petrol');
    bike.energy = 0.1;
    const [one, two, full] = fuelChoices(bike, 1, [{ metres: 800 }, { metres: 1000 }]);
    expect(one.cost % FUEL.roundToRwf).toBe(0);
    expect(one.cost).toBeLessThan(two.cost);
    expect(two.cost).toBeLessThan(full.cost);
    expect(one.upTo).toBeGreaterThanOrEqual(fuelForMetres(800));
    expect(full.upTo).toBe(1);
  });

  it('buys only up to the level you chose', () => {
    const bike = createBike(new World(TEST_MAP), 'petrol');
    bike.energy = 0.2;
    const wallet = createWallet(10000);
    const r = buyFuel(wallet, bike, 1, 0.5);
    expect(r.ok).toBe(true);
    expect(bike.energy).toBeCloseTo(0.5);
    expect(r.cost).toBe(MONEY.fuelFullTank * 0.3);
  });

  it('a choice that buys nothing costs nothing', () => {
    const bike = createBike(new World(TEST_MAP), 'petrol');
    bike.energy = 0.95;
    expect(fuelChoices(bike, 1, [{ metres: 100 }, { metres: 100 }])[0].cost).toBe(0);
  });
});

describe('the service at the garage', () => {
  it('lists an oil change for petrol, and brake pads when they are worn', () => {
    const bike = createBike(new World(TEST_MAP), 'petrol');
    bike.serviceWear = 100;
    bike.brakePads = 0.5;
    const q = garageQuote(bike);
    expect(q.items.map((i) => i.name)).toContain('Oil change');
    expect(q.items.map((i) => i.name)).toContain('Brake pads');
    expect(q.cost).toBe(q.items.reduce((a, i) => a + i.cost, 0));
    const e = createBike(new World(TEST_MAP), 'electric');
    e.serviceWear = 400;
    expect(garageQuote(e).items.map((i) => i.name)).not.toContain('Oil change');
  });

  it('the service items add up to the service cost', () => {
    for (const type of ['petrol', 'electric']) {
      expect(MAINTENANCE.serviceItems[type].reduce((a, i) => a + i.cost, 0)).toBe(MAINTENANCE.serviceCost[type]);
    }
  });
});
