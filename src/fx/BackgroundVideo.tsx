import { useReducedMotion } from '../lib/media';
import './fx.css';

/** Page-wide boomerang loop (forward + reverse baked into the file) under a dark overlay. */
export function BackgroundVideo() {
  const reduced = useReducedMotion();
  return (
    <div className="bgv" aria-hidden="true">
      {!reduced && <video className="bgv__video" src="/video/noerr-bg.mp4" autoPlay muted loop playsInline preload="auto" />}
    </div>
  );
}
