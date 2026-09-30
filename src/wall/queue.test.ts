import { describe, expect, it } from 'vitest';
import type { Memory } from '../lib/memory';
import { mulberry32 } from '../lib/random';
import { createQueue } from './queue';

const mem = (i: number): Memory => ({ id: `m${i}`, width: 1, height: 1, blurDataUrl: '' });
const pool = (n: number) => Array.from({ length: n }, (_, i) => mem(i));
const none = new Set<string>();

describe('createQueue', () => {
  it('serves the given order first, each memory once', () => {
    const q = createQueue(pool(10), mulberry32(1));
    expect(Array.from({ length: 10 }, () => q.next(none).id)).toEqual(pool(10).map(m => m.id));
  });

  it('serves everything once per round in later rounds too', () => {
    const q = createQueue(pool(10), mulberry32(1));
    for (let i = 0; i < 10; i++) q.next(none);
    expect(new Set(Array.from({ length: 10 }, () => q.next(none).id)).size).toBe(10);
  });

  it('never returns an on-screen memory while an off-screen one exists', () => {
    const q = createQueue(pool(12), mulberry32(2));
    const rand = mulberry32(3);
    for (let k = 0; k < 500; k++) {
      const onScreen = new Set(pool(12).filter(() => rand() < 0.6).map(m => m.id));
      if (onScreen.size === 12) continue;
      expect(onScreen.has(q.next(onScreen).id)).toBe(false);
    }
  });

  it('does not repeat back-to-back across rounds', () => {
    const q = createQueue(pool(3), mulberry32(4));
    let prev = '';
    for (let k = 0; k < 300; k++) {
      const id = q.next(none).id;
      expect(id).not.toBe(prev);
      prev = id;
    }
  });

  it('allows a duplicate instead of failing when every memory is on screen', () => {
    const q = createQueue(pool(3), mulberry32(5));
    const all = new Set(pool(3).map(m => m.id));
    for (let k = 0; k < 10; k++) expect(all.has(q.next(all).id)).toBe(true);
  });

  it('works with a single memory', () => {
    const q = createQueue(pool(1));
    expect(q.next(none).id).toBe('m0');
    expect(q.next(none).id).toBe('m0');
  });

  it('rejects an empty pool', () => {
    expect(() => createQueue([])).toThrow(/empty/);
  });
});
