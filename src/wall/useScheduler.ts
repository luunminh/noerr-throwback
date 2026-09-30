import { useEffect, useRef } from 'react';

/** One interval for the whole wall; skips ticks while the tab is hidden. */
export function useScheduler(tick: () => void, ms: number, enabled: boolean) {
  const latest = useRef(tick);
  latest.current = tick;
  useEffect(() => {
    if (!enabled) return;
    const handle = setInterval(() => {
      if (!document.hidden) latest.current();
    }, ms);
    return () => clearInterval(handle);
  }, [ms, enabled]);
}
