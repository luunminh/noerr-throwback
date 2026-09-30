import { useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { useAudio } from '../audio/AudioProvider';
import { content } from '../content';
import { numberOf, type Duo, type Memory } from '../lib/memory';
import { Picture } from '../lib/Picture';
import { MusicDisc } from '../sections/MusicDisc';
import type { Size, TileSpec } from './layout';
import { visible, type Pair, type SlotKey, type TileState } from './pairs';

const SIZES: Record<Size, string> = {
  small: '(min-width: 768px) 12vw, 25vw',
  medium: '(min-width: 768px) 25vw, 50vw',
  wide: '(min-width: 768px) 50vw, 100vw',
  large: '(min-width: 768px) 50vw, 100vw',
};
const wordFor = (id: number) => content.colourWords[id % content.colourWords.length];

interface Props {
  spec: TileSpec;
  state: TileState;
  total: number;
  onOpen(m: Memory): void;
  onShuffle(): void;
}

export function Tile({ spec, state, total, onOpen, onShuffle }: Props) {
  const audio = useAudio();
  const [tilt, setTilt] = useState<{ rx: number; ry: number } | null>(null);
  const [wobble, setWobble] = useState(false);
  const playing = audio.state === 'playing';

  // Metro tilt: tip toward the pressed point (±10°), wobble on release.
  const press = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -y * 20, ry: x * 20 });
  };
  const release = () => {
    if (!tilt) return;
    setTilt(null);
    setWobble(true);
  };

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    if (spec.kind === 'counter') return onShuffle();
    if (spec.kind === 'music') return audio.toggle();
    // Pointer: the mini under the finger. Keyboard (no data-mini target): the most recently changed mini.
    const mini = (e.target as HTMLElement).closest<HTMLElement>('[data-mini]')?.dataset.mini;
    const pair =
      spec.kind === 'mosaic' ? state.minis[mini !== undefined ? Number(mini) : (state.miniTurn + 3) % 4] : state.main;
    const m = pair && visible(pair);
    if (m) onOpen(m);
  };

  const shown = visible(state.main);
  const label =
    spec.kind === 'counter' ? `${total} memories. Shuffle the wall`
    : spec.kind === 'music' ? `${playing ? 'Pause' : 'Play'} song: ${content.songTitle}`
    : spec.kind === 'mosaic' ? 'Open a photo from the mosaic'
    : shown ? `Open photo ${numberOf(shown)}${shown.caption ? `: ${shown.caption}` : ''}`
    : wordFor(spec.id);

  return (
    <button
      type="button"
      className={`tile${wobble ? ' is-wobble' : ''}`}
      data-tile={spec.id}
      data-kind={spec.kind}
      data-size={spec.size}
      data-colour={spec.colour}
      style={{
        gridColumn: `${spec.col + 1} / span ${spec.w}`,
        gridRow: `${spec.row + 1} / span ${spec.h}`,
        '--c': `var(--${spec.colour})`,
        '--rx': `${tilt?.rx ?? 0}deg`,
        '--ry': `${tilt?.ry ?? 0}deg`,
      } as CSSProperties}
      aria-label={label}
      onClick={click}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onAnimationEnd={() => setWobble(false)}
    >
      <span className="press">
        <Body spec={spec} state={state} total={total} playing={playing} />
      </span>
    </button>
  );
}

function Body({ spec, state, total, playing }: { spec: TileSpec; state: TileState; total: number; playing: boolean }) {
  switch (spec.kind) {
    case 'counter':
      return (
        <span className="tile__counter">
          <span className="disp tile__count">{total}</span>
          <span className="tile__counter-foot">
            <span className="label label--cream">MEMORIES</span>
            <span className="chip">TAP = SHUFFLE</span>
          </span>
        </span>
      );
    case 'music':
      return <span className="tile__music"><MusicDisc playing={playing} size={64} /></span>;
    case 'mosaic':
      return (
        <span className="tile__mosaic">
          {state.minis.map((p, k) => (
            <span key={k} className="mini" data-mini={k}>
              <PairView pair={p} slot={k} sizes={SIZES.small} fade bare />
            </span>
          ))}
        </span>
      );
    case 'colour':
      return <PairView pair={state.main} slot="main" sizes={SIZES[spec.size]} word={wordFor(spec.id)} />;
    default: {
      const m = visible(state.main);
      return (
        <>
          {spec.kind === 'peek' && (
            <span className="peek__panel">
              <span className="label">NO. {m ? numberOf(m) : ''}</span>
              {m?.caption && <span className="peek__cap" lang="vi">{m.caption}</span>}
            </span>
          )}
          <span className={`peek__photo${state.peeking ? ' is-up' : ''}`}>
            <PairView pair={state.main} slot="main" sizes={SIZES[spec.size]} />
          </span>
        </>
      );
    }
  }
}

interface PairProps { pair: Pair; slot: SlotKey; sizes: string; word?: string; fade?: boolean; bare?: boolean }

function PairView({ pair, slot, sizes, word, fade, bare }: PairProps) {
  return (
    <span className={`flipper${pair.back ? ' is-back' : ''}${fade ? ' flipper--fade' : ''}`} data-pair={slot}>
      {([0, 1] as const).map(i => {
        const m = pair.faces[i];
        return (
          <span key={i} className={`face${i ? ' face--back' : ''}`} data-face={i} data-duo={pair.duo[i] ?? undefined}>
            {m ? (
              <TilePhoto m={m} duo={pair.duo[i]} sizes={sizes} bare={bare} />
            ) : i === 0 && word ? (
              <span className="tile__word disp"><span className="bob">{word}</span></span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function TilePhoto({ m, duo, sizes, bare }: { m: Memory; duo: Duo; sizes: string; bare?: boolean }) {
  return (
    <>
      <Picture m={m} sizes={sizes} duo={duo} className="tile__img" />
      <span className="tile__label">
        {!bare && <span className="label label--cream">PHOTO</span>}
        <span className="disp tile__num">{numberOf(m)}</span>
      </span>
      {duo && !bare && <span className="chip tile__duo">DUO</span>}
    </>
  );
}
