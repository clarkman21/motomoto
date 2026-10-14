import { UI, retroLabel, drawWindow, smallLabel, wrapSmall, SMALL_LINE } from './retro-ui.js';
import { drawRukundo } from '../world/portrait-sprites.js';
import { addCanvasTexture } from './textures.js';
import { lineShown } from '../sim/lesson.js';

// The phone call of the Motari lesson in the HUD (sim/lesson.js): Rukundo's pixel head in a call window
// under the speed window, his name, and his line that types out. While the phone rings, the window
// shakes a little and says CALLING. A SKIP button (or the L key) ends the lesson.

const TEXT_W = 150; // virtual pixels for his line
const LINES = 3;

export class LessonCall {
  constructor(hud, add) {
    this.hud = hud;
    for (const [key, talk] of [['rukundo-0', false], ['rukundo-1', true]]) {
      if (!hud.textures.exists(key)) addCanvasTexture(hud, key, drawRukundo(talk));
    }
    this.face = add(hud.add.image(0, 0, 'rukundo-0').setOrigin(0));
    this.name = add(retroLabel(hud, 0, 0, 'RUKUNDO', UI.gold));
    this.state = add(smallLabel(hud, UI.dim));
    this.lines = Array.from({ length: LINES }, () => add(smallLabel(hud)));
    this.skip = add(smallLabel(hud, UI.dim));
    const z = hud.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', (p) => { p.hitButton = true; hud.ride.skipLesson(); });
    this.zone = add(z);
    this.#show(false);
  }

  #show(on) {
    for (const o of [this.face, this.name, this.state, this.skip, ...this.lines]) o.setVisible(on);
    this.zone.input.enabled = on;
  }

  /** Draw the call (or nothing). g: the graphics for the window; x, y: the top left corner. */
  update(g, x, y, time) {
    const lesson = this.hud.ride.lesson, call = lesson?.call;
    if (!call) return this.#show(false);
    this.#show(true);
    const ringing = call.ringing > 0;
    const shake = ringing && Math.floor(time / 60) % 2 ? 1 : 0;
    const text = lineShown(call);
    const wrapped = wrapSmall(text, TEXT_W).slice(0, LINES);
    const h = Math.max(30, 16 + LINES * SMALL_LINE);
    const w = 4 + 20 + 5 + TEXT_W + 4;
    drawWindow(g, x + shake, y, w, h, 'dark');
    // The face: the mouth moves while the letters type out.
    const typing = !ringing && text.length < (call.lines[call.line] ?? '').length;
    this.face.setTexture(typing && Math.floor(time / 110) % 2 ? 'rukundo-1' : 'rukundo-0').setPosition(x + 4 + shake, y + 4);
    this.name.setPosition(x + 29 + shake, y + 3);
    this.state.setText(ringing ? (Math.floor(time / 300) % 2 ? 'CALLING...' : 'CALLING') : 'ON THE PHONE').setPosition(x + 29 + shake + 50, y + 5);
    this.skip.setText(this.hud.isTouch ? 'SKIP ×' : 'L: SKIP').setPosition(x + w - this.skip.width - 4 + shake, y + 5);
    this.zone.setPosition(x + w - this.skip.width - 8, y).setSize(this.skip.width + 8, 13);
    this.skip.setVisible(!lesson.closing);
    this.zone.input.enabled = !lesson.closing;
    this.lines.forEach((l, i) => l.setText(wrapped[i] ?? '').setPosition(x + 29 + shake, y + 15 + i * SMALL_LINE));
    return h;
  }
}
