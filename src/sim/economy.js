import { MONEY, JOBS } from '../config.js';
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
export function fuelFillCost(bike, priceFactor = 1) {
  return round10((1 - bike.energy) * MONEY.fuelFullTank * priceFactor);
}

/**
 * Fill the petrol tank with the cash you have. Returns { ok, cost, reason }.
 * Call when the fill has finished.
 */
export function buyFuel(wallet, bike, priceFactor = 1) {
  const missing = 1 - bike.energy;
  const fullTank = MONEY.fuelFullTank * priceFactor;
  if (missing < 0.01) return { ok: false, cost: 0, reason: 'full' };
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
  if (event.type === 'wall') return event.speed >= 4 ? MONEY.repairs.wall : 0;
  return 0;
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
