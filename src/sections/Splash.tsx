import { useEffect, useState } from 'react';
import { useAudio } from '../audio/AudioProvider';
import { Lettering } from '../fx/Lettering';
import { Flower, Star } from '../fx/Stickers';
import { TopBar } from './TopBar';
import './splash.css';

export function Splash({ onEnter }: { onEnter(): void }) {
  const { start } = useAudio();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const enter = () => {
    if (leaving) return;
    start();
    setLeaving(true);
    setTimeout(onEnter, 400);
  };

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`}>
      <TopBar />
      <Star colour="pink" size={72} className="splash__deco splash__deco--star spin-slow" />
      <Flower size={64} className="splash__deco splash__deco--flower" />
      <Star colour="orange" size={34} className="splash__deco splash__deco--dot" />
      <div className="splash__brand">
        <Lettering as="span" text="NOERR" className="splash__title" />
        <span className="pill disp">THROWBACK</span>
      </div>
      <button type="button" className="play" onClick={enter} autoFocus aria-label="Press play: enter the site and start the song">
        <span className="pulse">
          <span className="play-in">
            <svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="#FFF1DC" stroke="#0A0A0A" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="disp play__text">PRESS<br />PLAY</span>
          </span>
        </span>
      </button>
      <div className="splash__foot">
        <span className="label">TAP TO ENTER · SOUND ON</span>
        <span className="label label--muted">MUTE ANY TIME FROM THE DISC</span>
      </div>
    </div>
  );
}
