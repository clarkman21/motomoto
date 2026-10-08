// Print the balance table: for each level and player profile, the money of one day and the days
// to pass the level. Run: npm run balance
import { World } from '../src/world/world.js';
import { buildKigaliMap } from '../src/world/maps/kigali.js';
import { levelReport } from '../src/sim/balance.js';

const rows = levelReport(new World(buildKigaliMap()));
const r0 = (n) => Math.round(n).toLocaleString('en');
console.log('level  player    jobs/day  income   costs  (rent  energy  fines  repairs  service)  fleet  profit/day  days');
for (const r of rows) {
  console.log(
    `${String(r.level).padEnd(6)} ${r.player.padEnd(9)} ${r.jobsPerDay.toFixed(1).padStart(8)} ${r0(r.income).padStart(7)} ${r0(r.costs).padStart(7)}  (${r0(r.rent).padStart(5)} ${r0(r.energy).padStart(6)} ${r0(r.fines).padStart(6)} ${r0(r.repairs).padStart(7)} ${r0(r.service).padStart(7)}) ${r0(r.fleet ?? 0).padStart(6)}  ${r0(r.profit).padStart(10)}  ${Number.isFinite(r.days) ? r.days : 'never'}`,
  );
}
