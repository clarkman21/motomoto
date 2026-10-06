import { MAINTENANCE, JOBS, GEARBOX, MONEY } from '../config.js';

// Maintenance: the service meter. No Phaser here.
// bike.serviceWear counts game km since the last service, weighted by how hard the ride was.
// serviceDue(bike) = serviceWear / interval: 0 = just serviced, 1 = service due, 1.5 = breakdown.

export function serviceDue(bike) {
  return bike.serviceWear / MAINTENANCE.intervalKm[bike.type];
}

/** 0 before the service is due, rising to 1 at the breakdown point. */
export function overdue(bike) {
  return Math.max(0, Math.min(1, (serviceDue(bike) - 1) / (MAINTENANCE.breakdownAt - 1)));
}

/** Engine power factor: an overdue bike loses power. */
export function powerFactor(bike) {
  return 1 - MAINTENANCE.overduePowerLoss * overdue(bike);
}

/** Energy factor: an overdue bike uses more fuel or charge. */
export function energyFactor(bike) {
  return 1 + MAINTENANCE.overdueEnergyExtra * overdue(bike);
}

/** Wear in game km for riding `metres` on `surface`. The petrol red zone wears the engine faster. */
export function rideWearKm(bike, spec, surface, metres) {
  const redline = spec.gears && bike.revs > GEARBOX.peakRevsEnd ? MAINTENANCE.redlineWearFactor : 1;
  return (metres / JOBS.gameKmMetres) * (surface.wearFactor ?? 1) * redline;
}

/** Wear in game km for a hit (pothole, hard speed bump, crash), or 0. */
export function hitWearKm(event) {
  if (event.type === 'wall' && event.speed < 4) return 0;
  return MAINTENANCE.hazardWearKm[event.type] ?? 0;
}

/** Add wear. Returns warning events when the meter passes 80%, 100% and the breakdown point. */
export function addWear(bike, km) {
  if (km <= 0) return [];
  const before = serviceDue(bike);
  bike.serviceWear += km;
  const after = serviceDue(bike);
  const events = [];
  const passed = (level) => before < level && after >= level;
  if (passed(MAINTENANCE.warnAt)) events.push({ type: 'serviceSoon' });
  if (passed(1)) events.push({ type: 'serviceDue' });
  if (passed(MAINTENANCE.breakdownAt)) {
    bike.brokenDown = true;
    events.push({ type: 'breakdown' });
  }
  return events;
}

/** What the garage would do and what it costs. */
export function garageQuote(bike) {
  const pads = bike.brakePads < MAINTENANCE.padsBelow;
  const service = serviceDue(bike) >= MAINTENANCE.minServiceFraction || bike.brokenDown;
  const cost = (service || pads ? MAINTENANCE.serviceCost[bike.type] : 0) + (pads ? MONEY.brakePads : 0);
  return { nothing: !service && !pads, pads, cost };
}

/** The mechanic services the bike: the meter goes to zero, a breakdown is fixed, worn pads are new. */
export function serviceBike(bike) {
  const { pads } = garageQuote(bike);
  bike.serviceWear = 0;
  bike.brokenDown = false;
  if (pads) {
    bike.brakePads = 1;
    bike.brakesWarned = false;
  }
}
