const EASE = 'cubic-bezier(.3,1.2,.5,1)';

export function snapshot(root: HTMLElement): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>('[data-tile]').forEach(el => rects.set(el.dataset.tile!, el.getBoundingClientRect()));
  return rects;
}

/** First-Last-Invert-Play: tiles fly from their old rects; new tiles pop in. */
export function playFlip(root: HTMLElement, before: Map<string, DOMRect>, ms = 500) {
  root.querySelectorAll<HTMLElement>('[data-tile]').forEach(el => {
    const a = before.get(el.dataset.tile!);
    const b = el.getBoundingClientRect();
    if (!a) {
      el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: ms, easing: EASE });
      return;
    }
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const sx = a.width / b.width;
    const sy = a.height / b.height;
    if (!dx && !dy && sx === 1 && sy === 1) return;
    el.animate(
      [
        { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: 'top left', transform: 'none' },
      ],
      { duration: ms, easing: EASE },
    );
  });
}
