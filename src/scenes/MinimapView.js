import { COLOURS, MINIMAP, WORLD, DISTRICTS } from '../config.js';
import { drawMinimap, minimapSize, minimapPoint, minimapDirection, districtLabels } from '../world/minimap.js';
import { jobTarget } from '../sim/jobs.js';
import { textBit } from '../world/garage-sprites.js';
import { FUEL_BRAND } from '../world/sprites.js';
import { addCanvasTexture } from './textures.js';

// The minimap in the lower left corner of the HUD: the whole map, the district names, the
// stations for your bike (fuel or swap), the garages, the job target and you.
// Key M (or the Settings menu) shows or hides it.

const FONT = '"Barlow Condensed", "Instrument Sans", system-ui, sans-serif';
const FUEL = COLOURS.spBlue; // SP: a blue badge with yellow letters
const GARAGE = 0xe07a2a; // orange, so it is not like the blue SP badge
const PAD = 8;

export class MinimapView {
  constructor(scene) {
    this.scene = scene;
    this.ride = scene.ride;
    this.panel = scene.add.graphics();
    this.image = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.icons = scene.add.graphics().setDepth(2);
    this.marks = scene.add.graphics().setDepth(3); // you and the job target are on top of the names
    this.labels = [];
    this.legend = [0, 1, 2].map(() => scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#d8d8d8' }));
    this.legendIcons = scene.add.graphics();
    this.key = null;
  }

  /** Place the map. x, bottom: the lower left corner. s: the HUD scale. */
  layout(x, bottom, s) {
    this.f = s < 1 ? MINIMAP.pxPerTileSmall : MINIMAP.pxPerTile;
    this.s = s;
    const { width, height } = minimapSize(this.ride.world, this.f);
    this.box = { x, y: bottom - height - 2 * PAD - 18 * s, w: width + 2 * PAD, h: height + 2 * PAD + 18 * s };
    this.origin = { x: x + PAD, y: this.box.y + PAD };
    this.panel.clear().fillStyle(0x000000, 0.62).fillRoundedRect(this.box.x, this.box.y, this.box.w, this.box.h, 8 * s);
    for (const t of this.legend) t.setFontSize(`${Math.round(13 * s)}px`);
    this.key = null; // draw the map again at the new size
  }

  #rebuild() {
    const ride = this.ride, world = ride.world, f = this.f;
    this.key = `${world.closed ? [...world.closed].join(',') : ''}|${f}|${ride.bike.type}`;
    const tex = `minimap-${f}-${world.closed ? [...world.closed].join('-') : 'all'}`;
    if (!this.scene.textures.exists(tex)) addCanvasTexture(this.scene, tex, drawMinimap(world, f));
    this.image.setTexture(tex).setPosition(this.origin.x, this.origin.y);
    // District names: white when open, grey with the level when closed.
    for (const l of this.labels) l.destroy();
    this.labels = districtLabels(world, f).map((d) => {
      const lvl = DISTRICTS[d.id]?.unlockLevel;
      const text = d.open ? d.name : `${d.name}${lvl ? ` · L${lvl}` : ''}`;
      return this.scene.add.text(this.origin.x + d.x, this.origin.y + d.y, text, {
        fontFamily: FONT, fontSize: `${Math.round(12 * this.s)}px`, fontStyle: '600',
        color: d.open ? '#ffffff' : '#8a8a8a', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(1);
    });
    // Stations for your bike (petrol: fuel; electric: swap) and the garages, in open districts only.
    const g = this.icons.clear();
    const electric = ride.bike.type === 'electric';
    const icon = (tag, rgb) => {
      for (const p of world.placesWithTag(tag)) {
        if (world.isClosedTile(world.tile(Math.floor(p.x), Math.floor(p.y)))) continue;
        const m = this.#point(p.x * WORLD.tileMetres, p.y * WORLD.tileMetres);
        if (tag === 'fuel') {
          // A small red badge with "SP" in white, like the sign at the station.
          const x0 = Math.round(m.x) - 5, y0 = Math.round(m.y) - 4;
          g.fillStyle(0x000000, 1).fillRect(x0 - 1, y0 - 1, 11, 9).fillStyle(rgb, 1).fillRect(x0, y0, 9, 7).fillStyle(COLOURS.spYellow, 1);
          for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) if (textBit(FUEL_BRAND, x, y)) g.fillRect(x0 + 1 + x, y0 + 1 + y, 1, 1);
          continue;
        }
        g.fillStyle(0x000000, 1).fillRect(m.x - 3, m.y - 3, 7, 7).fillStyle(rgb, 1).fillRect(m.x - 2, m.y - 2, 5, 5);
      }
    };
    icon(electric ? 'swap' : 'fuel', electric ? COLOURS.ampersandYellow : FUEL);
    icon('garage', GARAGE);
    // Legend under the map: a small square and a word for each mark.
    const lx = this.origin.x, ly = this.box.y + this.box.h - PAD - 14 * this.s;
    const lg = this.legendIcons.clear();
    const items = [[electric ? COLOURS.ampersandYellow : FUEL, electric ? 'Swap' : 'SP fuel'], [GARAGE, 'Garage'], [0x44bc9d, 'Job']];
    let x = lx;
    items.forEach(([rgb, word], i) => {
      lg.fillStyle(0x000000, 1).fillRect(x - 1, ly + 3, 7, 7).fillStyle(rgb, 1).fillRect(x, ly + 4, 5, 5);
      this.legend[i].setText(word).setPosition(x + 9, ly - 1);
      x += 9 + this.legend[i].width + 14 * this.s;
    });
  }

  #point(x, y) {
    const p = minimapPoint(this.ride.world, this.f, x, y);
    return { x: this.origin.x + p.x, y: this.origin.y + p.y };
  }

  #setVisible(v) {
    for (const o of [this.panel, this.image, this.icons, this.marks, ...this.legend, this.legendIcons, ...this.labels]) o.setVisible(v);
  }

  update(time) {
    const ride = this.ride;
    const show = ride.showMap !== false;
    this.#setVisible(show);
    if (!show) return;
    const world = ride.world;
    const key = `${world.closed ? [...world.closed].join(',') : ''}|${this.f}|${ride.bike.type}`;
    if (key !== this.key) this.#rebuild();
    const g = this.marks.clear();
    // The job target: green for the pickup, white for the drop off.
    const job = ride.board?.active;
    if (job) {
      const t = jobTarget(job);
      const m = this.#point(t.x * WORLD.tileMetres, t.y * WORLD.tileMetres);
      const r = 3 + Math.sin(time / 160);
      g.fillStyle(0x000000, 1).fillCircle(m.x, m.y, r + 1.5).fillStyle(job.stage === 'toPickup' ? 0x44bc9d : 0xffffff, 1).fillCircle(m.x, m.y, r);
    }
    // You: a white arrow in the direction of the bike.
    const b = ride.bike;
    const p = this.#point(b.x, b.y);
    const d = minimapDirection(b.heading);
    const n = { x: -d.y, y: d.x };
    const tip = { x: p.x + d.x * 6, y: p.y + d.y * 6 };
    const l = { x: p.x - d.x * 3 + n.x * 4, y: p.y - d.y * 3 + n.y * 4 };
    const rr = { x: p.x - d.x * 3 - n.x * 4, y: p.y - d.y * 3 - n.y * 4 };
    g.lineStyle(3, 0x000000, 1).strokeTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
    g.fillStyle(0xffffff, 1).fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
  }
}
