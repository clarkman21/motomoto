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
