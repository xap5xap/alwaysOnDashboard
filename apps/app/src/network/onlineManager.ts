// Connectivity plumbing (AOD-127): teach TanStack's global onlineManager the device's real network
// state via @react-native-community/netinfo, so a query pauses when the device goes offline and resumes
// on reconnect. This is what makes cold data "hold" instead of erroring during an outage — Holding
// Course's "holding your last picture": offline keeps every number and only ages it, never blanks it.
//
// This is PLUMBING only. It does NOT decide any UI (the amber "offline" / red "our side" lines and the
// per-card badge are the M5/M6 Holding Course consumers, RB-53/RB-59); it only feeds the single online
// signal that onlineManager, useOnline(), and the ProxyDataSource failure taxonomy all read.
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** The two netinfo fields the online decision reads. Kept structural so the predicate is pure + trivially
 *  testable; the real NetInfoState (a union whose members carry these) is assignable to it. */
export interface OnlineSignal {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

/**
 * Derive the single boolean "online" from a netinfo state. Online = a network interface is connected AND
 * the internet is not *confirmed* unreachable. `isInternetReachable` is `null` while netinfo is still
 * probing — we treat unknown as online (don't punish the probe window); only an explicit `false` (a
 * connected interface with no reachable internet, e.g. captive wifi) counts as offline. This sharpens the
 * your-network vs our-server attribution the taxonomy rests on: a captive/dead link reads as the device's
 * fault (device_offline), not ours (vela_unreachable).
 */
export function isNetInfoOnline(state: OnlineSignal): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Wire onlineManager to netinfo. Call once at app root (app/_layout.tsx). onlineManager owns the
 * subscription lifecycle: setEventListener stores this setup and invokes the returned cleanup when a new
 * listener replaces it, so this is safe to call again (idempotent enough for a re-mount / Fast Refresh).
 * Returns onlineManager's setup so a caller can hand it to an effect if it wants, though onlineManager
 * itself manages teardown.
 */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isNetInfoOnline(state))),
  );
}
