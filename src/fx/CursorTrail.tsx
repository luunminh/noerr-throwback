import { useEffect, useRef } from 'react';
import { useMediaQuery, useReducedMotion } from '../lib/media';
import './fx.css';

const COUNT = 12;
const COLOURS = ['var(--violet)', 'var(--orange)', 'var(--pink)', 'var(--green)'];

/** Desktop only: a short trail of palette blobs behind the pointer. */
export function CursorTrail() {
  const fine = useMediaQuery('(pointer: fine)');
  const reduced = useReducedMotion();
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const on = fine && !reduced;

  useEffect(() => {
    if (!on) return;
    let next = 0;
    const onMove = (e: PointerEvent) => {
      const el = dots.current[next++ % COUNT];
      if (!el) return;
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      el.getAnimations().forEach(a => a.cancel());
      el.animate([{ opacity: 0.9, scale: 1 }, { opacity: 0, scale: 0.2 }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [on]);

  if (!on) return null;
  return (
    <div className="trail" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, k) => (
        <span key={k} ref={el => { dots.current[k] = el; }} className="trail__dot" style={{ background: COLOURS[k % COLOURS.length] }} />
      ))}
    </div>
  );
}
