// The exit affordance state machine (design-kiosk-wall.md §7, kiosk-mode.md §4.3). A deliberate three-step
// exit so a wall is never dismissed by a stray tap yet the owner can always leave:
//   idle    -> the wall shows content; the exit corner is invisible and advertises nothing.
//   holding -> touch-down on the corner reveals the "Hold to exit" hint + a progress ring; a deliberate
//              hold over HOLD_MS opens the PIN. Releasing early cancels back to idle (a brush is not an exit).
//   pin     -> a scrim + PIN pad; a correct PIN exits, a wrong PIN shakes and the wall STAYS active.
// This hook owns the phase + the hold timer and composes the pure pin.ts helpers; the ring/shake motion and
// the surfaces are the ExitAffordance component's. HOLD_MS is the AOD-11 §4.3 `holdMs` (a deliberate hold).
import { useCallback, useEffect, useRef, useState } from 'react';
import { appendDigit, deleteDigit, evaluatePin } from './pin';

/** The deliberate-hold duration before the PIN pad opens (kiosk-mode.md §4.3 holdMs, e.g. 2000ms). */
export const HOLD_MS = 2000;

export type ExitPhase = 'idle' | 'holding' | 'pin';

export interface ExitFlow {
  phase: ExitPhase;
  /** The digits entered so far on the PIN pad (length drives the filled dots). */
  entered: string;
  /** A nonce that increments on each WRONG entry, so the component can re-run the shake animation. */
  wrongNonce: number;
  /** Touch-down on the exit corner: begin the deliberate hold (reveals the hint + ring). */
  beginHold(): void;
  /** Touch-up / cancel before HOLD_MS: abandon the hold and return to idle. */
  cancelHold(): void;
  /** Press a digit key on the PIN pad; the 4th digit evaluates (correct exits, wrong shakes + clears). */
  pressKey(digit: string): void;
  /** Backspace on the PIN pad. */
  pressDelete(): void;
  /** Dismiss the PIN pad back to the wall (the scrim tap / cancel); the wall stays active. */
  dismiss(): void;
}

export interface UseExitFlowArgs {
  /** Verify the entered PIN against this stored hash (the kiosk runtime's pinHash). */
  storedHash: string;
  /** Called once on a correct PIN: the caller reverses enter and replaces back to the Dashboard. */
  onExit(): void;
  /** Override the hold duration (tests); defaults to HOLD_MS. */
  holdMs?: number;
}

export function useExitFlow({ storedHash, onExit, holdMs = HOLD_MS }: UseExitFlowArgs): ExitFlow {
  const [phase, setPhase] = useState<ExitPhase>('idle');
  const [entered, setEntered] = useState('');
  const [wrongNonce, setWrongNonce] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  // Clean up a pending hold timer on unmount so it never fires into an unmounted tree.
  useEffect(() => clearHold, [clearHold]);

  // Side effects (the hold timer, onExit) live OUTSIDE the state updaters: React warns if a state update on
  // another component (e.g. onExit -> router.replace) fires from inside an updater, and scheduling a timer in
  // an updater double-fires under StrictMode. `phase`/`entered` are read from the closure (deps) instead.
  const beginHold = useCallback(() => {
    if (phase !== 'idle') return; // already holding or in the PIN pad
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setEntered('');
      setPhase('pin');
    }, holdMs);
    setPhase('holding');
  }, [phase, clearHold, holdMs]);

  const cancelHold = useCallback(() => {
    clearHold();
    if (phase === 'holding') setPhase('idle'); // never cancels an already-open PIN pad
  }, [phase, clearHold]);

  const pressKey = useCallback(
    (digit: string) => {
      const next = appendDigit(entered, digit);
      const result = evaluatePin(next, storedHash);
      if (result === 'correct') {
        setEntered('');
        onExit();
      } else if (result === 'wrong') {
        setEntered(''); // clear on a wrong entry; the wall stays active
        setWrongNonce((n) => n + 1);
      } else {
        setEntered(next); // incomplete
      }
    },
    [entered, storedHash, onExit],
  );

  const pressDelete = useCallback(() => setEntered((prev) => deleteDigit(prev)), []);

  const dismiss = useCallback(() => {
    clearHold();
    setEntered('');
    setPhase('idle');
  }, [clearHold]);

  return { phase, entered, wrongNonce, beginHold, cancelHold, pressKey, pressDelete, dismiss };
}
