import { useCallback, useMemo, useState } from 'react';
import { CursorTrail } from './fx/CursorTrail';
import { FaceRain, useNoerrKeys } from './fx/FaceRain';
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
  const [rain, setRain] = useState(0);
  const triggerRain = useCallback(() => setRain(n => n + 1), []);
  const endRain = useCallback(() => setRain(0), []);
  useNoerrKeys(triggerRain);

  if (order.length === 0) return <p className="label empty">NO MEMORIES YET · RUN npm run build:images</p>;

  return (
    <>
      <DuotoneDefs />
      {!entered && <Splash onEnter={() => setEntered(true)} />}
      <main inert={!entered}>
        <Hero order={order} onRain={triggerRain} />
        <hr className="divider" />
        <TileWall order={order} paused={!entered || lightbox !== null} onOpen={m => setLightbox(order.indexOf(m))} />
        <hr className="divider" />
        <Outro />
        <Footer />
      </main>
      {entered && <MusicSticker />}
      <Lightbox order={order} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      {rain > 0 && <FaceRain key={rain} order={order} onDone={endRain} />}
      <CursorTrail />
    </>
  );
}
