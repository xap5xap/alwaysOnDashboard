// The first-run "onboarded" signal (app-ia.md §4.2 / §10). AOD-68 fixed the gate PREDICATE (gate.ts) and
// left the real first-run DETECTION to AOD-29's onboarding build; this is that swap. The hook now reads the
// persisted device-local flag (src/onboarding/onboardedStore, MMKV on device / localStorage on web) through
// useSyncExternalStore, so a brand-new user (flag unset -> false) is routed to /onboarding by the gate, and
// finishing or skipping onboarding (setOnboarded(true)) flips the gate to the Dashboard on the next launch.
// The gate predicate + the (app) guard are unchanged; this only supplies the boolean they already consume.
import { useSyncExternalStore } from 'react';
import { getOnboarded, subscribeOnboarded } from '../onboarding/onboardedStore';

export function useOnboarded(): boolean {
  return useSyncExternalStore(subscribeOnboarded, getOnboarded, getOnboarded);
}
