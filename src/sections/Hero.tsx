import { useEffect, useRef } from 'react';
import { content } from '../content';
import { Lettering } from '../fx/Lettering';
import { Flower, PhotoSticker, Star } from '../fx/Stickers';
import { useReducedMotion } from '../lib/media';
import type { Memory } from '../lib/memory';
import type { Colour } from '../wall/layout';
import { TopBar } from './TopBar';
import './hero.css';

// Sticker spots inside the cluster, in % of its width/top, matching the mockup's overlap.
const SPOTS: { l: number; t: number; w: number; ratio: number; rot: number; shadow: Colour }[] = [
  { l: 2, t: 4, w: 40, ratio: 0.8, rot: -6, shadow: 'green' },
  { l: 52, t: 0, w: 38, ratio: 1.1, rot: 4, shadow: 'violet' },
  { l: 58, t: 46, w: 36, ratio: 0.9, rot: -3, shadow: 'orange' },
  { l: 6, t: 62, w: 38, ratio: 1.2, rot: 5, shadow: 'green' },
  { l: 36, t: 40, w: 28, ratio: 1.1, rot: 8, shadow: 'pink' },
];

export function Hero({ order, onRain }: { order: readonly Memory[]; onRain(): void }) {
  const cluster = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);
  const reduced = useReducedMotion();

  // A random sticker peels a little on scroll, at most every 2 s.
  useEffect(() => {
    if (reduced) return;
    let last = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - last < 2000) return;
      last = now;
      const all = cluster.current?.querySelectorAll('.stk');
      if (!all?.length) return;
      const el = all[Math.floor(Math.random() * all.length)];
      el.classList.add('is-peel');
      setTimeout(() => el.classList.remove('is-peel'), 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  // Easter egg: 5 taps on the title within 3 s.
  const tapTitle = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      onRain();
    }
  };

  return (
    <header className="hero" id="top">
      <TopBar />
      <div className="hero__words">
        <Lettering text="NOERR" className="hero__title" onClick={tapTitle} />
        <span className="pill disp">THROWBACK</span>
        <p className="label hero__sub" lang="vi">{content.subtitle}</p>
      </div>
      <div className="hero__cluster" ref={cluster}>
        {order.slice(0, SPOTS.length).map((m, i) => (
          <PhotoSticker
            key={m.id}
            m={m}
            duo={i % 2 ? 'b' : 'a'}
            shadow={SPOTS[i].shadow}
            rot={SPOTS[i].rot}
            style={{ left: `${SPOTS[i].l}%`, top: `${SPOTS[i].t}%`, width: `${SPOTS[i].w}%`, aspectRatio: SPOTS[i].ratio, zIndex: i + 1 }}
          />
        ))}
        <Star colour="pink" size={64} className="hero__star spin-slow" />
        <Flower size={56} className="hero__flower" />
      </div>
      <a href="#wall" className="label label--cream hero__scroll">↓ SCROLL FOR THE WALL</a>
    </header>
  );
}
