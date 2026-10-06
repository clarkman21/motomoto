// Save and load the game in this browser (localStorage). Storage can be missing or blocked
// (a private window), so every call is wrapped and the game works without it.

const KEY = 'motoKigali.save.v1';

export function loadGame() {
  try {
    const s = window.localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // no storage: the game still works, it only cannot continue later
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Settings (sound, steering, gears) are kept apart from the game save, so a new game keeps them.
const SETTINGS_KEY = 'motoKigali.settings.v1';

export function loadSettings() {
  try {
    const s = window.localStorage.getItem(SETTINGS_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // no storage: the settings last until the page closes
  }
}
