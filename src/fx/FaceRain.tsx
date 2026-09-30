import { useEffect, useMemo, type CSSProperties } from 'react';
import { useReducedMotion } from '../lib/media';
import { imageUrl, type Memory } from '../lib/memory';
import './fx.css';

/** Typing "noerr" anywhere triggers the rain. */
export function useNoerrKeys(onTrigger: () => void) {
  useEffect(() => {
    let buffer = '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-5);
      if (buffer === 'noerr') {
        buffer = '';
        onTrigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTrigger]);
}

/** 24 random memories fall for 3 s, then onDone(). */
export function FaceRain({ order, onDone }: { order: readonly Memory[]; onDone(): void }) {
  const reduced = useReducedMotion();
  const drops = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        m: order[Math.floor(Math.random() * order.length)],
        x: Math.random() * 100,
        delay: Math.random() * 1.2,
        spin: (Math.random() * 2 - 1) * 360,
        size: 56 + Math.random() * 48,
      })),
    [order],
  );
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 0 : 3000);
    return () => clearTimeout(t);
  }, [onDone, reduced]);
  if (reduced) return null;
  return (
    <div className="rain" aria-hidden="true">
      {drops.map((d, i) => (
        <img
          key={i}
          src={imageUrl(d.m.id, 240, 'webp')}
          alt=""
          className="rain__drop"
          style={{ left: `${d.x}%`, width: d.size, animationDelay: `${d.delay}s`, '--spin': `${d.spin}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}
