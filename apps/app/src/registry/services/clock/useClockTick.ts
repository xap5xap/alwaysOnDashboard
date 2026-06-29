// The in-widget render ticker (integration-clock.md §7.2). A none widget has no provider to poll; its
// liveness is a RENDER cadence, not a fetch: re-read the device clock every second when seconds are shown,
// else every minute. The cadence depends on THIS widget's config (showSeconds), so it lives in the leaf,
// which keeps the host generic (the host never learns "clock", §6.3). The first tick is aligned to the
// next second/minute boundary so the display flips cleanly on the boundary, not on a drifting offset; both
// timers are cleared on unmount. When the app backgrounds the interval pauses with it (AOD-10 §6.5) and
// the leaf re-reads the clock on the next foreground render (a Date read, not a fetch), so it is never
// wrong on return, only paused while hidden.
import { useEffect, useState } from 'react';

export function useClockTick(showSeconds: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const periodMs = showSeconds ? 1000 : 60000;
    const delay = periodMs - (Date.now() % periodMs);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), periodMs);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [showSeconds]);
  return now;
}
