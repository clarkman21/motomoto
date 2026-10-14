import { describe, it, expect } from 'vitest';
import { RADIO, SHOP } from '../src/config.js';
import { songFor, nextStation, midiToHz, STEPS_PER_BAR } from '../src/audio/songs.js';

describe('Radio Inziza', () => {
  it('has six stations (with KISS FM), each with 3 or 4 tracks', () => {
    expect(RADIO.stations.map((s) => s.name)).toEqual(['IMPALA GOLD', 'RUMBA KIN', 'KIGALI COUNTRY', 'KINYATRAP FM', 'GOSPEL 7', 'KISS FM']);
    for (const s of RADIO.stations) expect(s.tracks.length).toBeGreaterThanOrEqual(3);
    expect(SHOP.items.find((i) => i.id === 'speaker')).toBeTruthy();
  });

  it('N goes through the stations, then OFF, then the first station again', () => {
    let i = -1;
    const seen = [];
    for (let k = 0; k < RADIO.stations.length + 2; k++) seen.push((i = nextStation(i)));
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, -1, 0]);
  });

  it('makes a song for each track: notes in the loop, a sane pitch, and tracks that differ', () => {
    RADIO.stations.forEach((st, si) => {
      const songs = st.tracks.map((_, ti) => songFor(si, ti));
      for (const song of songs) {
        expect(song.steps % STEPS_PER_BAR).toBe(0);
        expect(song.bpm).toBeGreaterThan(80);
        expect(song.events.length).toBeGreaterThan(100);
        for (const e of song.events) {
          expect(e.t).toBeGreaterThanOrEqual(0);
          expect(e.t).toBeLessThan(song.steps);
          if (e.m != null) {
            expect(midiToHz(e.m)).toBeGreaterThan(25);
            expect(midiToHz(e.m)).toBeLessThan(2500);
          }
        }
        // Sorted by time (the player reads them in order).
        for (let k = 1; k < song.events.length; k++) expect(song.events[k].t).toBeGreaterThanOrEqual(song.events[k - 1].t);
      }
      const sig = songs.map((s) => s.events.filter((e) => e.m != null).slice(0, 24).map((e) => e.m).join(','));
      expect(new Set(sig).size).toBe(songs.length);
      // The same track is the same song each time.
      expect(songFor(si, 0).events).toEqual(songs[0].events);
    });
  });

  it('each style has its own sound: an 808 in trap, an organ in gospel, a fiddle in country, four on the floor in pop', () => {
    const voices = (si) => new Set(songFor(si, 0).events.map((e) => e.v));
    const id = (x) => RADIO.stations.findIndex((s) => s.id === x);
    expect(voices(id('trap')).has('sub')).toBe(true);
    expect(voices(id('gospel')).has('organ')).toBe(true);
    expect(voices(id('country')).has('fiddle')).toBe(true);
    expect(voices(id('impala')).has('horn')).toBe(true);
    expect(voices(id('rumba')).has('lead')).toBe(true);
    const kicks = songFor(id('kiss'), 0).events.filter((e) => e.v === 'kick' && e.t < 16).map((e) => e.t);
    expect(kicks).toEqual([0, 4, 8, 12]);
  });
});
