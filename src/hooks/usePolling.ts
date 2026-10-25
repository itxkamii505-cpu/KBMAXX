import { useEffect, useRef } from 'react';

/**
 * Visibility-aware polling:
 *  - never overlaps (waits for the previous call to finish)
 *  - pauses while the browser tab is hidden
 *  - refreshes immediately when the tab becomes visible again
 * The first call is NOT made here (components already fetch once on mount).
 */
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled: boolean = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let running = false;

    const tick = async () => {
      if (stopped) return;
      if (!document.hidden && !running) {
        running = true;
        try {
          await fnRef.current();
        } catch {
          // ignore, next tick retries
        } finally {
          running = false;
        }
      }
      if (!stopped) timer = setTimeout(tick, ms);
    };

    const onVisibility = () => {
      if (!document.hidden && !running) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    timer = setTimeout(tick, ms);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
}
