// The AOD-10 §6.6 cadence-profile seam. The scheduler reads a CadenceProfile so the AOD-11 kiosk runtime can
// switch cadence policy without the scheduler knowing anything about kiosk. AOD-10 defines the input + the
// default ("foreground"); AOD-11's runtime sets "kiosk" on enter and restores "foreground" on exit.
//
// FLAG (AOD-73): no scheduler consumer READS this yet. Today WidgetHost always runs the foreground on-device
// timer (scheduler.ts effectiveInterval -> refetchInterval), and there is no background path to switch away
// from, so keep-awake (the app never backgrounds, §5 / §6.1) is what actually realizes the kiosk cadence.
// This module is the seam's canonical home + the runtime's real set/restore call; the future consumers are
// the §6.2 night-interval multiplier (kioskInterval) and a background-task suppression, neither built here.
export type CadenceProfile = 'foreground' | 'kiosk';

let current: CadenceProfile = 'foreground';

/** The active cadence profile (default "foreground"). A future scheduler consumer reads this (see FLAG). */
export function getCadenceProfile(): CadenceProfile {
  return current;
}

/** Set the active cadence profile. AOD-11's runtime sets "kiosk" on enter and "foreground" on exit. */
export function setCadenceProfile(profile: CadenceProfile): void {
  current = profile;
}
