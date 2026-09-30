import { shuffle, type Rand } from '../lib/random';

export type Size = 'small' | 'medium' | 'wide' | 'large';
export type TileKind = 'flip' | 'peek' | 'mosaic' | 'colour' | 'counter' | 'music';
export type Colour = 'violet' | 'orange' | 'pink' | 'green';
export const COLOURS: readonly Colour[] = ['violet', 'orange', 'pink', 'green'];

export interface Placement { col: number; row: number; w: number; h: number; size: Size }
export interface TileSpec extends Placement { id: number; kind: TileKind; colour: Colour }

export const GRID = { phone: { cols: 4, rows: 16 }, desktop: { cols: 8, rows: 12 } } as const;

// The wall is packed in 2×2-cell blocks: a block is one medium, four smalls,
// half a wide (4×2) or a quarter of the large (4×4). Packing by blocks leaves
// no odd holes, so the rectangle is always full and wides stay possible.
type BlockKind = 'large' | 'wide' | 'medium' | 'smalls';
const SPAN: Record<BlockKind, [number, number]> = { large: [2, 2], wide: [2, 1], medium: [1, 1], smalls: [1, 1] };
const TARGET = { small: 0.4, medium: 0.35, wide: 0.2 };

function pickIndex(weights: number[], rand: Rand) {
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length - 1; i++) {
    if (x < weights[i]) return i;
    x -= weights[i];
  }
  return weights.length - 1;
}

export function pack(cols: number, rows: number, rand: Rand): Placement[] {
  const bc = cols / 2;
  const br = rows / 2;
  const used = new Array<boolean>(bc * br).fill(false);
  const out: Placement[] = [];
  const count = { small: 0, medium: 0, wide: 0 };

  const free = (c: number, r: number, [w, h]: [number, number]) => {
    if (c + w > bc || r + h > br) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used[y * bc + x]) return false;
    return true;
  };
  const put = (c: number, r: number, kind: BlockKind) => {
    const [w, h] = SPAN[kind];
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y * bc + x] = true;
    if (kind === 'smalls') {
      for (let k = 0; k < 4; k++) out.push({ col: c * 2 + (k % 2), row: r * 2 + (k >> 1), w: 1, h: 1, size: 'small' });
      count.small += 4;
      return;
    }
    out.push({ col: c * 2, row: r * 2, w: w * 2, h: h * 2, size: kind });
    if (kind !== 'large') count[kind]++;
  };
  const putRandom = (kind: BlockKind) => {
    const spots: [number, number][] = [];
    for (let r = 0; r < br; r++) for (let c = 0; c < bc; c++) if (free(c, r, SPAN[kind])) spots.push([c, r]);
    const [c, r] = spots[Math.floor(rand() * spots.length)];
    put(c, r, kind);
  };

  // Fixed order so assign() can rely on indices: 0 large, 1 counter, 2 mosaic, 3 music.
  putRandom('large');
  putRandom('medium');
  putRandom('medium');
  putRandom('smalls');

  for (let r = 0; r < br; r++) {
    for (let c = 0; c < bc; c++) {
      if (used[r * bc + c]) continue;
      const options = (['wide', 'medium', 'smalls'] as const).filter(k => free(c, r, SPAN[k]));
      const placed = count.small + count.medium + count.wide;
      // Favour whichever size is furthest below its target share.
      const weights = options.map(k => {
        const s = k === 'smalls' ? 'small' : k;
        return Math.max(0.02, TARGET[s] * (placed + 1) - count[s]) ** 2;
      });
      put(c, r, options[pickIndex(weights, rand)]);
    }
  }
  return out;
}

export function assign(placements: Placement[], rand: Rand, reducedMotion: boolean): TileSpec[] {
  const kinds: TileKind[] = placements.map((_, i) =>
    i === 1 ? 'counter' : i === 2 ? 'mosaic' : i === 3 ? 'music' : 'flip',
  );
  const colourable = placements
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i >= 4 && (p.size === 'small' || p.size === 'medium'))
    .map(({ i }) => i);
  for (const i of shuffle(colourable, rand).slice(0, 2)) kinds[i] = 'colour';

  return placements.map((p, i) => {
    let kind = kinds[i];
    if (kind === 'flip' && !reducedMotion && (p.size === 'medium' || p.size === 'wide') && rand() < 0.5) kind = 'peek';
    return { ...p, id: i, kind, colour: COLOURS[Math.floor(rand() * COLOURS.length)] };
  });
}
