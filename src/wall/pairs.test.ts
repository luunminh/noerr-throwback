import { describe, expect, it } from 'vitest';
import type { Memory } from '../lib/memory';
import { mulberry32 } from '../lib/random';
import { assign, GRID, pack } from './layout';
import {
  clearHidden, emptyPair, loadHidden, onScreenIds, patchSlot, revealHidden, rollDuo, syncStates, turnPair, visible,
  type States,
} from './pairs';
import { createQueue } from './queue';

const mem = (i: number): Memory => ({ id: `m${i}`, file: `${i}.jpg`, width: 1, height: 1, blurDataUrl: '' });
const pool = Array.from({ length: 36 }, (_, i) => mem(i));

function allFaceIds(states: States) {
  return Object.values(states).flatMap(s => [s.main, ...s.minis].flatMap(p => p.faces.filter(Boolean).map(m => m!.id)));
}

describe('pair lifecycle', () => {
  it('load → turn → clear shows the new photo and forgets the old one', () => {
    let p = loadHidden(emptyPair(), mem(1), null);
    p = revealHidden(p);
    p = clearHidden(p);
    expect(visible(p)?.id).toBe('m1');
    p = loadHidden(p, mem(2), 'a');
    expect(visible(p)?.id).toBe('m1');
    p = clearHidden(revealHidden(p));
    expect(visible(p)?.id).toBe('m2');
    expect(p.faces.filter(Boolean)).toHaveLength(1);
  });

  it('revealHidden refuses to turn onto an empty face', () => {
    const p = clearHidden(revealHidden(loadHidden(emptyPair(), mem(1), null)));
    expect(revealHidden(p)).toBe(p);
    expect(visible(turnPair(p))).toBeNull(); // plain turn is allowed (colour tile back to its word)
  });

  it('patchSlot ignores a mosaic mini that no longer exists', () => {
    const s = { main: emptyPair(), minis: [], miniTurn: 0, peeking: false };
    expect(patchSlot(s, 2, turnPair)).toBe(s);
  });

  it('rollDuo makes about a third duotone', () => {
    const rand = mulberry32(1);
    const hits = Array.from({ length: 3000 }, () => rollDuo(rand)).filter(Boolean).length / 3000;
    expect(hits).toBeGreaterThan(0.28);
    expect(hits).toBeLessThan(0.39);
  });
});

describe('syncStates', () => {
  const layoutFor = (cols: number, rows: number, seed: number) => assign(pack(cols, rows, mulberry32(seed)), mulberry32(seed), false);

  it('fills every photo tile and 4 mosaic minis with no duplicates', () => {
    for (let s = 1; s <= 50; s++) {
      const layout = layoutFor(GRID.desktop.cols, GRID.desktop.rows, s);
      const states = syncStates(layout, {}, createQueue(pool, mulberry32(s)), mulberry32(s));
      const ids = allFaceIds(states);
      expect(new Set(ids).size).toBe(ids.length);
      for (const t of layout) {
        const st = states[t.id];
        if (t.kind === 'flip' || t.kind === 'peek') expect(visible(st.main)).not.toBeNull();
        if (t.kind === 'mosaic') expect(st.minis.map(visible).every(Boolean)).toBe(true);
        if (t.kind === 'mosaic') expect(st.minis).toHaveLength(4);
        if (t.kind === 'counter' || t.kind === 'music' || t.kind === 'colour') expect(visible(st.main)).toBeNull();
      }
    }
  });

  it('re-sync to a new layout (shuffle or breakpoint change) keeps photos where possible, never duplicates', () => {
    const queue = createQueue(pool, mulberry32(3));
    const a = layoutFor(GRID.desktop.cols, GRID.desktop.rows, 3);
    const first = syncStates(a, {}, queue, mulberry32(3));
    // simulate a tile mid-flip: hidden face loaded, not yet turned
    first[0] = { ...first[0], main: loadHidden(first[0].main, queue.next(onScreenIds(first)), null) };
    const b = layoutFor(GRID.phone.cols, GRID.phone.rows, 4);
    const second = syncStates(b, first, queue, mulberry32(4));
    const ids = allFaceIds(second);
    expect(new Set(ids).size).toBe(ids.length);
    expect(visible(second[0].main)?.id).toBe(visible(first[0].main)?.id); // large tile keeps its photo
    expect(second[0].main.faces.filter(Boolean)).toHaveLength(1); // mid-flip face dropped
    for (const t of b) if (t.kind === 'flip' || t.kind === 'peek') expect(visible(second[t.id].main)).not.toBeNull();
  });
});
