import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '../lib/media';
import { canUseWebAudio, stateAfterPlayError } from './policy';

export type AudioState = 'idle' | 'playing' | 'paused' | 'blocked';
interface AudioApi {
  state: AudioState;
  muted: boolean;
  start(): void;
  toggle(): void;
  toggleMute(): void;
}

const Ctx = createContext<AudioApi | null>(null);

export function useAudio(): AudioApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useAudio must be used inside <AudioProvider>');
  return api;
}

const VOLUME = 0.6;
interface Graph { ctx: AudioContext; gain: GainNode; analyser: AnalyserNode }

export function AudioProvider({ src, children }: { src: string; children: ReactNode }) {
  const el = useRef<HTMLAudioElement>(null);
  const graph = useRef<Graph | null>(null);
  const mutedRef = useRef(false);
  const [state, setState] = useState<AudioState>('idle');
  const [muted, setMuted] = useState(false);
  const reduced = useReducedMotion();

  // iOS ignores audio.volume, so volume/fade/mute go through a GainNode.
  const ensureGraph = (): Graph | null => {
    if (graph.current || !el.current) return graph.current;
    if (!canUseWebAudio(navigator, navigator.userAgent)) return null; // iOS 16: silent switch would mute Web Audio
    try {
      // iOS 17+: let Web Audio play even with the ringer switch on silent.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaElementSource(el.current).connect(gain).connect(analyser).connect(ctx.destination);
      graph.current = { ctx, gain, analyser };
    } catch {
      graph.current = null; // fall back to the bare element
    }
    return graph.current;
  };

  const rampTo = (value: number, secs: number) => {
    const g = graph.current;
    if (!g) return;
    const p = g.gain.gain;
    const t = g.ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(value, t + secs);
  };

  const play = useCallback((fadeSecs: number) => {
    const audio = el.current;
    if (!audio) return;
    const g = ensureGraph();
    if (!g) {
      audio.muted = mutedRef.current;
      audio.volume = VOLUME; // ignored on iOS, honoured elsewhere
    }
    // resume() and play() must both start synchronously inside the tap handler.
    const resumed = g ? g.ctx.resume() : Promise.resolve();
    const played = audio.play();
    Promise.all([resumed, played]).then(
      () => {
        setState('playing');
        rampTo(mutedRef.current ? 0 : VOLUME, fadeSecs);
      },
      err => {
        const next = stateAfterPlayError(err);
        if (next) setState(next);
      },
    );
  }, []);

  const pause = useCallback(() => {
    el.current?.pause();
    rampTo(0, 0);
    setState('paused');
  }, []);

  const start = useCallback(() => play(1.5), [play]);
  const toggle = useCallback(() => {
    if (el.current && !el.current.paused) pause();
    else play(0.5);
  }, [pause, play]);
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (graph.current) {
      if (el.current && !el.current.paused) rampTo(next ? 0 : VOLUME, 0.05);
    } else if (el.current) {
      el.current.muted = next;
    }
  }, []);

  // M3: pause while hidden, resume on return only if it was playing.
  useEffect(() => {
    let resume = false;
    const onVisibility = () => {
      const audio = el.current;
      if (!audio) return;
      if (document.hidden) {
        resume = !audio.paused;
        if (resume) {
          audio.pause();
          rampTo(0, 0);
        }
      } else if (resume) {
        resume = false;
        play(0.5);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [play]);

  // Title pulse: RMS loudness → --pulse (0..1) on <html>; no React re-render per frame.
  useEffect(() => {
    const root = document.documentElement;
    const g = graph.current;
    if (state !== 'playing' || reduced || !g) {
      root.style.setProperty('--pulse', '0');
      return;
    }
    const buf = new Uint8Array(g.analyser.fftSize);
    let raf = 0;
    const loop = () => {
      g.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      root.style.setProperty('--pulse', Math.min(1, (Math.sqrt(sum / buf.length) / 128) * 3).toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      root.style.setProperty('--pulse', '0');
    };
  }, [state, reduced]);

  return (
    <Ctx.Provider value={{ state, muted, start, toggle, toggleMute }}>
      <audio
        ref={el}
        src={src}
        loop
        preload="auto"
        onError={() => setState('blocked')}
        onPlay={() => {
          setState('playing');
          rampTo(mutedRef.current ? 0 : VOLUME, 0.3); // resumed from outside (lock screen): gain may be 0
        }}
        onPause={() => {
          if (!document.hidden) setState('paused'); // our own hide-pause keeps 'playing' for resume
        }}
      />
      {children}
    </Ctx.Provider>
  );
}
