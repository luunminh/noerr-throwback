import { useMemo, useState } from 'react';
import { memories } from './lib/memory';
import { DuotoneDefs } from './lib/Picture';
import { shuffle } from './lib/random';
import { Hero } from './sections/Hero';
import { Lightbox } from './sections/Lightbox';
import { MusicSticker } from './sections/MusicSticker';
import { Footer, Outro } from './sections/Outro';
import { Splash } from './sections/Splash';
import { TileWall } from './wall/TileWall';

export function App() {
  const order = useMemo(() => shuffle(memories), []); // fresh order every visit
  const [entered, setEntered] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (order.length === 0) return <p className="label empty">NO MEMORIES YET · RUN npm run build:images</p>;

  return (
    <>
      <DuotoneDefs />
      {!entered && <Splash onEnter={() => setEntered(true)} />}
      <main inert={!entered}>
        <Hero order={order} />
        <hr className="divider" />
        <TileWall order={order} paused={!entered || lightbox !== null} onOpen={m => setLightbox(order.indexOf(m))} />
        <hr className="divider" />
        <Outro />
        <Footer />
      </main>
      {entered && <MusicSticker />}
      <Lightbox order={order} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
