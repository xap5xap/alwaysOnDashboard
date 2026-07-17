// useOnline (AOD-127): the React read of the device's connectivity, subscribed to TanStack's onlineManager
// (which setupOnlineManager feeds from netinfo). One source of truth: the same signal that pauses queries
// also drives this hook, so a component and the query cache can never disagree about "are we online".
//
// This is PLUMBING for the M5/M6 Holding Course app-level edges (RB-53 the offline/our-outage lines,
// RB-59 the never-alarm wall). It returns a bare boolean and paints nothing itself.
import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** `true` when the device is online per onlineManager (fed by netinfo). Re-renders on connectivity flips. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => onlineManager.subscribe(onStoreChange),
    () => onlineManager.isOnline(),
    () => onlineManager.isOnline(),
  );
}
