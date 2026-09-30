import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/random';
import { assign, GRID, pack, type Placement } from './layout';

function coverage(tiles: Placement[], cols: number, rows: number) {
  const cells = new Array<number>(cols * rows).fill(0);
  for (const t of tiles) {
    for (let y = t.row; y < t.row + t.h; y++)
      for (let x = t.col; x < t.col + t.w; x++) {
        if (x >= cols || y >= rows) throw new Error(`out of bounds at ${x},${y}`);
        cells[y * cols + x]++;
      }
  }
  return cells;
}

for (const { cols, rows } of [GRID.phone, GRID.desktop]) {
  describe(`${cols}×${rows}`, () => {
    it('covers the rectangle exactly once (no gaps, no overlap)', () => {
      for (let s = 1; s <= 200; s++) {
        expect(coverage(pack(cols, rows, mulberry32(s)), cols, rows).every(c => c === 1)).toBe(true);
      }
    });

    it('has exactly one large, one counter/mosaic (medium), one music (small), two colour blocks', () => {
      for (let s = 1; s <= 100; s++) {
        const tiles = assign(pack(cols, rows, mulberry32(s)), mulberry32(s + 1000), false);
        const of = (k: string) => tiles.filter(t => t.kind === k);
        expect(tiles.filter(t => t.size === 'large')).toHaveLength(1);
        expect(tiles[0].size).toBe('large');
        expect(of('counter').map(t => [t.id, t.size])).toEqual([[1, 'medium']]);
        expect(of('mosaic').map(t => [t.id, t.size])).toEqual([[2, 'medium']]);
        expect(of('music').map(t => [t.id, t.size])).toEqual([[3, 'small']]);
        expect(of('colour')).toHaveLength(2);
        expect(of('colour').every(t => t.size === 'small' || t.size === 'medium')).toBe(true);
      }
    });

    it('keeps size shares near 40/35/20', () => {
      const total = { small: 0, medium: 0, wide: 0, large: 0 };
      let n = 0;
      for (let s = 1; s <= 300; s++) {
        for (const t of pack(cols, rows, mulberry32(s))) { total[t.size]++; n++; }
      }
      expect(total.small / n).toBeGreaterThan(0.35);
      expect(total.small / n).toBeLessThan(0.55);
      expect(total.medium / n).toBeGreaterThan(0.25);
      expect(total.medium / n).toBeLessThan(0.45);
      expect(total.wide / n).toBeGreaterThan(0.08);
      expect(total.wide / n).toBeLessThan(0.3);
    });

    it('puts peek only on medium/wide, never under reduced motion', () => {
      for (let s = 1; s <= 100; s++) {
        const placements = pack(cols, rows, mulberry32(s));
        const peeks = assign(placements, mulberry32(s), false).filter(t => t.kind === 'peek');
        expect(peeks.every(t => t.size === 'medium' || t.size === 'wide')).toBe(true);
        expect(assign(placements, mulberry32(s), true).some(t => t.kind === 'peek')).toBe(false);
      }
    });

    it('numbers ids 0..n-1', () => {
      const tiles = assign(pack(cols, rows, mulberry32(9)), mulberry32(9), false);
      expect(tiles.map(t => t.id)).toEqual(tiles.map((_, i) => i));
    });

    it('never has more photo slots than a 36-photo pool can fill', () => {
      for (let s = 1; s <= 200; s++) {
        const tiles = assign(pack(cols, rows, mulberry32(s)), mulberry32(s), false);
        const slots = tiles.filter(t => t.kind === 'flip' || t.kind === 'peek').length + 4; // + mosaic minis
        expect(slots).toBeLessThan(36);
      }
    });
  });
}
