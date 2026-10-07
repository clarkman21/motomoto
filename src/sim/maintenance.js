import { MAINTENANCE, JOBS, GEARBOX, BRAKES } from '../config.js';

// Maintenance: the service meter. No Phaser here.
// bike.serviceWear counts game km since the last service, weighted by how hard the ride was.
// One meter for everything: the engine (oil), the brake pads, the chain and the tyres.
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

/** Stopping power of the friction brakes: the pads wear out after the service is due. */
export function brakeFactor(bike) {
  return 1 - (1 - BRAKES.wornEfficiency) * overdue(bike);
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

/**
 * What the garage would do and what it costs: { nothing, cost, items: [{ name, cost }] }.
 * A service is the oil change (petrol), new brake pads and a check.
 */
export function garageQuote(bike) {
  const service = serviceDue(bike) >= MAINTENANCE.minServiceFraction || bike.brokenDown;
  const items = service ? [...MAINTENANCE.serviceItems[bike.type]] : [];
  const cost = items.reduce((a, i) => a + i.cost, 0);
  return { nothing: !service, cost, items };
}

/** The mechanic services the bike: the meter goes to zero and a breakdown is fixed. */
export function serviceBike(bike) {
  bike.serviceWear = 0;
  bike.brokenDown = false;
  bike.brakeWearKm = 0;
}
