// The single "chrome awake" state for the dashboard hub (AOD-142; design "Vela — The sky fills in" §1e
// "Glance ⇄ Tend — the one dial": a touch wakes the dial ~5s, idle sinks it). It is ONE idle timer, reset
// on any touch of the dashboard surface: `wake()` marks the chrome awake and (re)arms a countdown that
// sinks it after `idleMs`. This one mechanism produces both behaviours the design wants — in Glance-idle
// nobody is touching, so it sinks (the calm looking state); in Arrange you keep interacting, so the timer
// keeps resetting and it stays awake — with NO special-case for the mode (a mode change is itself a touch).
//
// Deliberately a standalone unit: AOD-144 plugs the page-dot capsule into the SAME awake state, so the
// hub chrome wakes and sinks together. The consumer wires `wake` to the surface's onTouchStart/onTouchMove
// (a passive responder callback that never captures the touch, so it cannot move anything — "waking ≠
// editing") and passes `awake` to whatever chrome should ride it (the mode dial today; the dots next).
import { useCallback, useEffect, useRef, useState } from 'react';

/** The idle window: how long after the last touch the hub chrome stays awake before it sinks (§1e "5
 *  seconds"). Exact value is a feel detail the device pass (AOD-190) tunes; the mechanism is what's fixed. */
export const CHROME_IDLE_MS = 5000;

export interface ChromeAwake {
  /** True while the hub chrome is awake (visible); false once the idle countdown has sunk it. */
  awake: boolean;
  /** Call on ANY interaction with the dashboard surface: marks awake and re-arms the sink countdown. */
  wake: () => void;
}

export function useChromeAwake(idleMs: number = CHROME_IDLE_MS): ChromeAwake {
  const [awake, setAwake] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    // setAwake(true) is a no-op re-render when already awake (React bails on an identical value), so this
    // is cheap to call on every touchMove frame while dragging — it just keeps re-arming the countdown.
    setAwake(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAwake(false), idleMs);
  }, [idleMs]);

  // Arm the countdown on mount (arriving on the screen counts as the first interaction), and clear it on
  // unmount so a pending sink never fires into an unmounted tree.
  useEffect(() => {
    wake();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [wake]);

  return { awake, wake };
}
