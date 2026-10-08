# Notes for Claude

- Game: Moto Inziza (working name before: Moto Kigali), an isometric moto taxi game. Spec: the Claude Docs doc "Moto Inziza: Game Spec v0.1". Web only; it will be published on Vercel.
- Stack: Phaser 3, Vite, Vitest. Plain JavaScript (ES modules).
- Use metric units. Keep all tunable numbers in `src/config.js`.
- Keep `src/sim` and `src/world` free of Phaser, so `npm test` can run them in Node.
- All art is generated in code (`src/world/sprites.js`, `src/world/terrain-render.js`). Do not add blurry scaling: textures use nearest filtering (`antialias: false`), and the camera zoom is a whole number.
- Ampersand Surge Yellow (`#FCDC04`) is only for batteries, swap stations and the electric moto.
- Before you push: `npm test` and `npm run build` must pass.
- Write docs and comments in ASD-STE100 Simplified Technical English.
