import type { Duo, Memory } from '../lib/memory';
import type { Rand } from '../lib/random';
import type { TileSpec } from './layout';
import type { Queue } from './queue';

/** Two faces of a flipper. Visible face = faces[back ? 1 : 0]; the other is empty or holds the next photo. */
export interface Pair { faces: [Memory | null, Memory | null]; duo: [Duo, Duo]; back: boolean }
export interface TileState { main: Pair; minis: Pair[]; miniTurn: number; peeking: boolean }
export type States = Record<number, TileState>;
export type SlotKey = 'main' | number;

export const emptyPair = (): Pair => ({ faces: [null, null], duo: [null, null], back: false });
export const hiddenIndex = (p: Pair): 0 | 1 => (p.back ? 0 : 1);
export const visible = (p: Pair): Memory | null => p.faces[p.back ? 1 : 0];

export function loadHidden(p: Pair, m: Memory | null, duo: Duo): Pair {
  const h = hiddenIndex(p);
  const faces: Pair['faces'] = [...p.faces];
  const d: Pair['duo'] = [...p.duo];
  faces[h] = m;
  d[h] = duo;
  return { ...p, faces, duo: d };
}
export const turnPair = (p: Pair): Pair => ({ ...p, back: !p.back });
/** Turn only onto a loaded face: a re-pack may have emptied it mid-flip. */
export const revealHidden = (p: Pair): Pair => (p.faces[hiddenIndex(p)] ? turnPair(p) : p);
export const clearHidden = (p: Pair): Pair => loadHidden(p, null, null);

export function patchSlot(s: TileState, slot: SlotKey, fn: (p: Pair) => Pair): TileState {
  if (slot === 'main') return { ...s, main: fn(s.main) };
  if (!s.minis[slot]) return s;
  return { ...s, minis: s.minis.map((p, i) => (i === slot ? fn(p) : p)) };
}

/** ~1 in 3 photos duotone, split between the two colourways. */
export const rollDuo = (rand: Rand): Duo => (rand() < 1 / 3 ? (rand() < 0.5 ? 'a' : 'b') : null);

export function onScreenIds(states: States): Set<string> {
  const ids = new Set<string>();
  for (const s of Object.values(states))
    for (const p of [s.main, ...s.minis]) for (const m of p.faces) if (m) ids.add(m.id);
  return ids;
}

const showsPhoto = (t: TileSpec) => t.kind === 'flip' || t.kind === 'peek';

/** Build tile states for a (new) layout, keeping photos of tiles that still show photos. */
export function syncStates(layout: readonly TileSpec[], prev: States, queue: Queue, rand: Rand = Math.random): States {
  const out: States = {};
  for (const t of layout) {
    const old = prev[t.id];
    out[t.id] = {
      // Keep both faces: an in-flight turn finishes and clears the old face itself.
      main: old && showsPhoto(t) && visible(old.main) ? old.main : emptyPair(),
      minis: t.kind === 'mosaic' && old ? old.minis : [],
      miniTurn: old?.miniTurn ?? 0,
      peeking: false,
    };
  }
  const fresh = (): Pair => ({ faces: [queue.next(onScreenIds(out)), null], duo: [rollDuo(rand), null], back: false });
  for (const t of layout) {
    const s = out[t.id];
    if (showsPhoto(t) && !visible(s.main)) s.main = fresh();
    if (t.kind === 'mosaic') while (s.minis.length < 4) s.minis.push(fresh());
  }
  return out;
}
