import type { AudioState } from './AudioProvider';

interface NavLike { audioSession?: unknown; maxTouchPoints?: number }

/**
 * iOS routes Web Audio through the ringer switch. iOS 17+ can opt out via
 * navigator.audioSession; older iOS can't, so there we keep the bare <audio>
 * element (audible on silent) and give up the fade and the pulse.
 */
export function canUseWebAudio(nav: NavLike, userAgent: string): boolean {
  const iOS = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && (nav.maxTouchPoints ?? 0) > 1);
  return !iOS || 'audioSession' in nav;
}

/** AbortError = our own pause() interrupted a pending play(): not a failure. */
export function stateAfterPlayError(err: unknown): AudioState | null {
  return err instanceof DOMException && err.name === 'AbortError' ? null : 'blocked';
}
