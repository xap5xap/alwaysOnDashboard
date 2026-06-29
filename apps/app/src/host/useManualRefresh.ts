// The host-side state machine behind the AOD-15 refresh control (design-widget-system.md §6,
// widget-model.md §6.6). It fires the explicit-user arm of the manual-refresh path and adds no new
// mechanism. Three visual states fall out of two facts: did the user just tap, and was that tap inside
// the AOD-12 §6.4 per-user fetch-floor?
//   - idle        : resting; a tap refreshes.
//   - in-flight   : a user-triggered fetch is running (only after a tap, NOT on background/kiosk ticks,
//                   so the card does not spin on every auto-refresh).
//   - within-floor: the tap landed inside the fetch-floor, so it is served the cached/coalesced value
//                   with NO provider call; the control confirms "up to date" instead of spinning.
// The floor here is UX-only (the server fetch-floor is authoritative, AOD-12); entitlementFloorSeconds 0
// means no floor and a tap always refreshes.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefreshControlState } from './RefreshControl';

const CONFIRM_MS = 1200;

export interface UseManualRefreshArgs {
  /** Re-run the fetch (the host passes query.refetch). */
  refetch: () => Promise<unknown>;
  /** True if a tap right now would be served cached (now - lastFetchedAt < floor). */
  withinFloor: () => boolean;
}

export interface ManualRefresh {
  state: RefreshControlState;
  onPress: () => void;
}

export function useManualRefresh({ refetch, withinFloor }: UseManualRefreshArgs): ManualRefresh {
  const [mode, setMode] = useState<'idle' | 'manual' | 'confirm'>('idle');
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const onPress = useCallback(() => {
    if (mode === 'manual') return; // ignore taps while a manual fetch is already running

    if (withinFloor()) {
      setMode('confirm');
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => {
        if (mounted.current) setMode('idle');
      }, CONFIRM_MS);
      return;
    }

    setMode('manual');
    void Promise.resolve(refetch()).finally(() => {
      if (mounted.current) setMode('idle');
    });
  }, [mode, withinFloor, refetch]);

  const state: RefreshControlState = mode === 'confirm' ? 'within-floor' : mode === 'manual' ? 'in-flight' : 'idle';
  return { state, onPress };
}
