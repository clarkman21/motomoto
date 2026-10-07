import { MONEY, JOBS, COLLISION, FUEL } from '../config.js';
import { garageQuote, serviceBike, serviceDue } from './maintenance.js';

// Money: everything the rider earns and spends. No Phaser here.
// Income: fares, tips, cargo. Costs: fuel, swaps, fines, crash repairs, garage, rent, loan.

export const INCOME = { fares: 'Fares', tips: 'Tips', cargo: 'Cargo' };
export const COSTS = {
  fuel: 'Fuel',
  swaps: 'Battery swaps',
  fines: 'Speed camera fines',
  repairs: 'Crash repairs',
  garage: 'Garage (service, brake pads)',
  rent: 'Daily bike rent',
  loan: 'Loan payment',
};

const emptyLedger = () => ({
  income: Object.fromEntries(Object.keys(INCOME).map((k) => [k, 0])),
  costs: Object.fromEntries(Object.keys(COSTS).map((k) => [k, 0])),
});

/** Round to 10 RWF, the smallest amount the game shows. */
export const round10 = (x) => Math.round(x / 10) * 10;

export function createWallet(cash = MONEY.startCash) {
  return { cash, day: 1, ledger: emptyLedger(), loan: null, loansTaken: 0, totalIncome: 0, level: 1, perks: {}, milestones: [], streak: 0 };
}

export function earn(wallet, category, amount) {
  wallet.cash += amount;
  wallet.ledger.income[category] += amount;
  wallet.totalIncome += amount;
  return amount;
}

/** Daily payment of a new loan. */
export function loanPayment() {
  const { amount, days, interest } = MONEY.loan;
  return round10((amount * (1 + interest)) / days);
}

/** You can take one loan, and only when it brings your cash back to zero or more. */
export function canTakeLoan(wallet) {
  return !wallet.loan && wallet.loansTaken === 0 && wallet.cash + MONEY.loan.amount >= 0;
}

/** Take the loan: the cash comes now, the payments come at each day end. */
export function takeLoan(wallet) {
  if (!canTakeLoan(wallet)) return false;
  wallet.cash += MONEY.loan.amount;
  wallet.loan = { payment: loanPayment(), daysLeft: MONEY.loan.days };
  wallet.loansTaken += 1;
  return true;
}

/** Spend money. Fines, repairs and rent can take the cash below zero (debt). */
export function spend(wallet, category, amount) {
  wallet.cash -= amount;
  wallet.ledger.costs[category] += amount;
  return amount;
}

/** Cost to fill the petrol tank from its current level. priceFactor: the petrol price of the level. */
/** The cost to fill the tank up to the level upTo (0..1, default full). */
export function fuelFillCost(bike, priceFactor = 1, upTo = 1) {
  return round10(Math.max(0, upTo - bike.energy) * MONEY.fuelFullTank * priceFactor);
}

/**
 * Buy fuel up to the level upTo (0..1, default a full tank) with the cash you have.
 * Returns { ok, cost, reason }. Call when the fill has finished.
 */
export function buyFuel(wallet, bike, priceFactor = 1, upTo = 1) {
  const missing = Math.min(1, upTo) - bike.energy;
  const fullTank = MONEY.fuelFullTank * priceFactor;
  if (missing < 0.005) return { ok: false, cost: 0, reason: 'full' };
  if (wallet.cash < 10) return { ok: false, cost: 0, reason: 'cash' };
  const fraction = Math.min(missing, wallet.cash / fullTank);
  const cost = Math.min(wallet.cash, round10(fraction * fullTank));
  spend(wallet, 'fuel', cost);
  bike.energy = Math.min(1, bike.energy + fraction);
  return { ok: true, cost };
}

/** Swap the battery for a full one. Flat fee, whatever charge is left. Returns { ok, cost, reason }. */
export function swapBattery(wallet, bike) {
  if (bike.energy > 0.97) return { ok: false, cost: 0, reason: 'full' };
  if (wallet.cash < MONEY.swapFee) return { ok: false, cost: 0, reason: 'cash' };
  spend(wallet, 'swaps', MONEY.swapFee);
  bike.energy = 1;
  return { ok: true, cost: MONEY.swapFee };
}

/** Repair cost for a damage event, or 0. Only a crash costs money at once; other hits add wear. */
export function repairCost(event) {
  if (event.type === 'wall' && event.hit?.kind === 'person') return 0; // hitting a person: a police fine instead (see PEOPLE)
  if (event.type !== 'wall' || event.speed < 4 || event.barrier) return 0; // a touch below 14 km/h (impact speed) costs nothing
  // A harder hit costs more: at least the minimum repair, then more for each km/h of impact speed.
  return Math.max(MONEY.repairs.wall, round10(COLLISION.repairPerKmh * (event.speed * 3.6 - 5)));
}

/**
 * Service the bike at the garage. Returns { ok, cost, pads, reason }. Call when the work is done.
 * After a breakdown, the mechanic repairs the bike on credit (cash can go below zero), so you are never
 * stuck. The day end check then decides: a loan, or game over. A normal service needs the cash.
 */
export function payGarage(wallet, bike) {
  const q = garageQuote(bike);
  if (q.nothing) return { ok: false, cost: 0, reason: 'nothing' };
  if (wallet.cash < q.cost && !bike.brokenDown) return { ok: false, cost: q.cost, reason: 'cash' };
  spend(wallet, 'garage', q.cost);
  serviceBike(bike);
  return { ok: true, cost: q.cost, pads: q.pads };
}

/**
 * The mechanic's bill and the rent at the end of the day. It changes the wallet and the bike,
 * and returns the day summary. Then it starts a new, empty ledger.
 */
export function endDay(wallet, bike, rent = MONEY.dailyRent[bike.type]) {
  const gameKm = bike.odometer / JOBS.gameKmMetres;
  spend(wallet, 'rent', rent);
  if (wallet.loan) {
    spend(wallet, 'loan', wallet.loan.payment);
    wallet.loan.daysLeft -= 1;
    if (wallet.loan.daysLeft <= 0) wallet.loan = null;
  }

  const { income, costs } = wallet.ledger;
  const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
  const totalCosts = Object.values(costs).reduce((a, b) => a + b, 0);
  const summary = {
    day: wallet.day,
    bikeType: bike.type,
    gameKm,
    offRoadKm: bike.offRoadMetres / JOBS.gameKmMetres,
    income: { ...income },
    costs: { ...costs },
    totalIncome,
    totalCosts,
    profit: totalIncome - totalCosts,
    cash: wallet.cash,
    brakePads: bike.brakePads,
    serviceDue: serviceDue(bike),
    // Regen: energy put back into the battery. A full battery costs one swap, so this is the money saved.
    regenFraction: bike.regenToday,
    regenSaved: bike.type === 'electric' ? round10(bike.regenToday * MONEY.swapFee) : 0,
    loan: wallet.loan ? { ...wallet.loan } : null,
    // Out of cash: 'loan' = you can choose a loan or game over; 'gameOver' = no choice.
    outOfCash: wallet.cash < 0 ? (canTakeLoan(wallet) ? 'loan' : 'gameOver') : null,
    totalIncomeAllDays: wallet.totalIncome,
  };
  wallet.ledger = emptyLedger();
  wallet.day += 1;
  bike.odometer = 0;
  bike.offRoadMetres = 0;
  bike.regenToday = 0;
  return summary;
}

/** The tank fraction needed to ride a distance in metres (an estimate, with hills and a margin). */
export function fuelForMetres(metres) {
  return (metres / 1000) * FUEL.tankPerKm * FUEL.margin;
}

/**
 * The choices at a fuel station: enough for the next job, for the next two jobs, or a full tank.
 * jobs: [{ fuel }] the tank fraction of the next jobs (the active job first; see sim/fuel.js).
 * Each choice: { label, upTo, cost }. Amounts are round (FUEL.roundToRwf). A choice that buys nothing costs 0.
 */
export function fuelChoices(bike, priceFactor, jobs) {
  const perUnit = MONEY.fuelFullTank * priceFactor;
  const choice = (label, need) => {
    const upTo = Math.min(1, need);
    if (upTo <= bike.energy + 0.005) return { label, upTo: bike.energy, cost: 0 };
    const cost = Math.min(Math.ceil(((upTo - bike.energy) * perUnit) / FUEL.roundToRwf) * FUEL.roundToRwf, round10((1 - bike.energy) * perUnit));
    return { label, upTo: Math.min(1, bike.energy + cost / perUnit), cost };
  };
  const one = (jobs[0]?.fuel ?? 0) + FUEL.reserveAt / 2;
  const two = one + (jobs[1]?.fuel ?? jobs[0]?.fuel ?? 0);
  return [choice('Enough for the next job', one), choice('Enough for the next two jobs', two), choice('Fill up the tank', 1)];
}
