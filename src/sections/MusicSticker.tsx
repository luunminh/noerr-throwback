import { useAudio } from '../audio/AudioProvider';
import { MusicDisc } from './MusicDisc';
import './player.css';

function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
    </svg>
  );
}

export function MusicSticker() {
  const { state, muted, toggle, toggleMute } = useAudio();
  const playing = state === 'playing';
  return (
    <div className="player">
      <button type="button" className="player__mute" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
        <Speaker muted={muted} />
      </button>
      <button type="button" className="player__disc" onClick={toggle} aria-pressed={playing} aria-label={playing ? 'Pause song' : 'Play song'}>
        <MusicDisc playing={playing} size={80} />
      </button>
    </div>
  );
}
