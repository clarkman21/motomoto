import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene.js';
import { RideScene } from './scenes/RideScene.js';
import { HudScene } from './scenes/HudScene.js';
import { DayEndScene } from './scenes/DayEndScene.js';
import { GarageScene } from './scenes/GarageScene.js';

async function boot() {
  // Wait for the brand fonts, so the HUD text does not draw with a fallback font first.
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('600 16px "Barlow Condensed"'),
        document.fonts.load('400 14px "Barlow Condensed"'),
        document.fonts.load('400 14px "Instrument Sans"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Fallback fonts are fine.
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    // Sharp pixels (no texture smoothing), but sprites keep sub pixel positions,
    // so the camera moves smoothly at 60 fps. Phaser's pixelArt option would round positions.
    antialias: false,
    antialiasGL: false,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    input: { activePointers: 3 },
    // The welcome menu starts first; it starts the ride scene behind it.
    scene: [MenuScene, RideScene, HudScene, DayEndScene, GarageScene],
  });
  window.motoGame = game; // for debugging in the browser console
}

boot();
