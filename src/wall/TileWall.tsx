import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Lettering } from '../fx/Lettering';
import { useMediaQuery, useReducedMotion } from '../lib/media';
import type { Memory } from '../lib/memory';
import { playFlip, snapshot } from './flip';
import { assign, GRID, pack } from './layout';
import { syncStates, type States } from './pairs';
import { createQueue } from './queue';
import { Tile } from './Tile';
import './wall.css';

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
  useEffect(() => {
    if (packedCols.current === cols) return;
    packedCols.current = cols;
    relayout(false);
  }, [cols, relayout]);

  useLayoutEffect(() => {
    if (before.current && root.current) playFlip(root.current, before.current);
    before.current = null;
  }, [layout]);

  void paused; // used by the scheduler in Task 10

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
