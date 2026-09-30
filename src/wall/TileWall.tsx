import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { Lettering } from '../fx/Lettering';
import { useMediaQuery, useReducedMotion } from '../lib/media';
import type { Memory } from '../lib/memory';
import { shuffle } from '../lib/random';
import { playFlip, snapshot } from './flip';
import { assign, GRID, pack, type TileSpec } from './layout';
import {
  clearHidden, hiddenIndex, loadHidden, onScreenIds, patchSlot, revealHidden, rollDuo, syncStates, turnPair,
  type SlotKey, type States, type TileState,
} from './pairs';
import { createQueue } from './queue';
import { Tile } from './Tile';
import { useScheduler } from './useScheduler';
import './wall.css';

const TICK_MS = 1200;
const TURN_MS = 700;
const FADE_MS = 900; // reduced-motion crossfade (wall.css .face transition)
const PEEK_MS = 550;
const PEEK_HOLD_MS = 2400;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface Props {
  order: readonly Memory[];
  paused: boolean;
  onOpen(m: Memory): void;
}

export function TileWall({ order, paused, onOpen }: Props) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const reduced = useReducedMotion();
  const { cols, rows } = desktop ? GRID.desktop : GRID.phone;
  // Start after the 5 hero stickers so the wall doesn't open on the same photos.
  const queue = useMemo(() => createQueue([...order.slice(5), ...order.slice(0, 5)]), [order]);
  const [layout, setLayout] = useState(() => assign(pack(cols, rows, Math.random), Math.random, reduced));
  const [states, setStates] = useState<States>(() => syncStates(layout, {}, queue));

  const root = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  const statesRef = useRef(states);
  statesRef.current = states;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const visibleIds = useRef(new Set<number>());
  const busy = useRef(new Set<number>());

  const relayout = useCallback(
    (animate: boolean) => {
      const next = assign(pack(cols, rows, Math.random), Math.random, reduced);
      if (animate && !reduced && root.current) before.current = snapshot(root.current);
      const nextStates = syncStates(next, statesRef.current, queue);
      setLayout(next);
      setStates(nextStates);
    },
    [cols, rows, reduced, queue],
  );

  // Re-pack when the breakpoint flips (phone rotation, window resize).
  const packedCols = useRef(cols);
  useLayoutEffect(() => { // before paint: no frame of the old layout on the new grid
    if (packedCols.current === cols) return;
    packedCols.current = cols;
    relayout(false);
  }, [cols, relayout]);

  useLayoutEffect(() => {
    if (before.current && root.current) playFlip(root.current, before.current);
    before.current = null;
  }, [layout]);

  // T9: only on-screen tiles animate.
  useEffect(() => {
    const grid = root.current;
    if (!grid) return;
    visibleIds.current.clear();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const id = Number((e.target as HTMLElement).dataset.tile);
        if (e.isIntersecting) visibleIds.current.add(id);
        else visibleIds.current.delete(id);
      }
    });
    grid.querySelectorAll('[data-tile]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [layout]);

  const patch = (id: number, fn: (s: TileState) => TileState) =>
    setStates(all => (all[id] ? { ...all, [id]: fn(all[id]) } : all));

  /** Load next photo into the hidden face, wait for decode (T4), turn, then drop the old face. */
  const turn = async (id: number, slot: SlotKey) => {
    const s = statesRef.current[id];
    const pair = s && (slot === 'main' ? s.main : s.minis[slot]);
    if (!pair) return;
    const hidden = hiddenIndex(pair);
    const m = queue.next(onScreenIds(statesRef.current));
    flushSync(() => patch(id, x => patchSlot(x, slot, p => loadHidden(p, m, rollDuo(Math.random)))));
    const img = root.current?.querySelector<HTMLImageElement>(
      `[data-tile="${id}"] [data-pair="${slot}"] [data-face="${hidden}"] img`,
    );
    const ok = img ? await img.decode().then(() => true, () => false) : false;
    if (!ok) {
      patch(id, x => patchSlot(x, slot, clearHidden)); // broken image: never flip onto it
      return;
    }
    patch(id, x => patchSlot(x, slot, revealHidden));
    await wait(reduced ? FADE_MS : TURN_MS);
    patch(id, x => patchSlot(x, slot, clearHidden));
  };

  const peek = async (id: number) => {
    patch(id, s => ({ ...s, peeking: true }));
    await wait(PEEK_MS + PEEK_HOLD_MS);
    patch(id, s => ({ ...s, peeking: false }));
    await wait(PEEK_MS);
  };

  const act = async (t: TileSpec) => {
    busy.current.add(t.id);
    try {
      const s = statesRef.current[t.id];
      if (!s) return;
      if (t.kind === 'flip') await turn(t.id, 'main');
      else if (t.kind === 'peek') await (Math.random() < 0.5 ? peek(t.id) : turn(t.id, 'main'));
      else if (t.kind === 'mosaic') {
        patch(t.id, x => ({ ...x, miniTurn: x.miniTurn + 1 }));
        await turn(t.id, s.miniTurn % 4); // minis change one at a time, in order
      } else if (t.kind === 'colour') {
        if (s.main.back) {
          patch(t.id, x => patchSlot(x, 'main', turnPair)); // back to the word
          await wait(reduced ? FADE_MS : TURN_MS);
          patch(t.id, x => patchSlot(x, 'main', clearHidden));
        } else if (Math.random() < 1 / 3) {
          await turn(t.id, 'main'); // less often than photo tiles
        }
      }
    } finally {
      busy.current.delete(t.id);
    }
  };

  // T2: one global tick picks 1–2 visible, idle tiles.
  useScheduler(
    () => {
      const candidates = layoutRef.current.filter(
        t => visibleIds.current.has(t.id) && !busy.current.has(t.id) && t.kind !== 'counter' && t.kind !== 'music',
      );
      for (const t of shuffle(candidates).slice(0, Math.random() < 0.5 ? 1 : 2)) void act(t);
    },
    TICK_MS,
    !paused,
  );

  return (
    <section className="wall" id="wall" aria-labelledby="wall-title">
      <header className="wall__head">
        <div>
          <p className="label">SIDE A · LIVE</p>
          <Lettering as="h2" id="wall-title" text="THE WALL" className="wall__title" />
        </div>
        <div className="wall__actions">
          <span className="label label--cream">TAP A PHOTO TO OPEN IT</span>
          <button type="button" className="btn-pink" onClick={() => relayout(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
            SHUFFLE
          </button>
        </div>
      </header>
      <div className="wall__frame">
        <div ref={root} className="wall__grid" style={{ '--cols': cols, '--rows': rows } as CSSProperties}>
          {layout.map(t => (
            <Tile key={t.id} spec={t} state={states[t.id]} total={order.length} onOpen={onOpen} onShuffle={() => relayout(true)} />
          ))}
        </div>
      </div>
      <p className="label label--muted wall__foot">{order.length} MEMORIES · NO REPEATS TILL ALL ARE SHOWN</p>
    </section>
  );
}
