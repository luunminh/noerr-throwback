import { useEffect, useRef } from 'react';
import { numberOf, type Memory } from '../lib/memory';
import { Picture } from '../lib/Picture';
import './lightbox.css';

interface Props {
  order: readonly Memory[];
  index: number | null;
  onIndex(i: number): void;
  onClose(): void;
}

export function Lightbox({ order, index, onIndex, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startX = useRef<number | null>(null);
  const n = order.length;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal(); // native focus trap + Esc
    if (index === null && d.open) d.close(); // browser restores focus to the tile
  }, [index]);

  const go = (delta: number) => {
    if (index !== null) onIndex((index + delta + n) % n);
  };
  const m = index !== null ? order[index] : null;

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label="Photo viewer"
      onClose={onClose}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      onPointerDown={e => { startX.current = e.clientX; }}
      onPointerUp={e => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      {m && index !== null && (
        <>
          <header className="lightbox__top">
            <span className="label label--cream">
              <span className="disp lightbox__num">{numberOf(m)}</span> / {n}
            </span>
            <span className="label">PHOTO · ORIGINAL</span>
            <button type="button" className="btn-ghost lightbox__close" onClick={onClose} aria-label="Close">✕</button>
          </header>
          <Picture m={m} sizes="100vw" className="lightbox__img" loading="eager" />
          {m.caption && <p className="lightbox__cap">{m.caption}</p>}
          <footer className="lightbox__nav">
            <button type="button" className="btn-ghost" onClick={() => go(-1)}>← PREV</button>
            <span className="label label--muted">SWIPE · ARROWS · ESC</span>
            <button type="button" className="btn-ghost" onClick={() => go(1)}>NEXT →</button>
          </footer>
        </>
      )}
    </dialog>
  );
}
