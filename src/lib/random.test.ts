import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from './random';

describe('shuffle', () => {
  it('returns a new permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(1));
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is deterministic for a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(7))).toEqual(shuffle([1, 2, 3, 4, 5], mulberry32(7)));
  });

  it('actually reorders', () => {
    const orders = Array.from({ length: 20 }, (_, s) => shuffle([1, 2, 3, 4, 5, 6], mulberry32(s + 1)).join());
    expect(orders.filter(o => o !== '1,2,3,4,5,6').length).toBeGreaterThan(15);
  });
});
