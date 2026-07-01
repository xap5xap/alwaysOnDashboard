// The first-run "onboarded" flag, native half (AOD-29; app-ia.md §4.2 / §10: its home is a build detail).
// This build picks device-local persistence, mirroring the AOD-25 queryPersister split: MMKV on device
// (this file), localStorage on web (onboardedStore.web.ts, resolved by Metro's platform resolution so
// react-native-mmkv is never bundled on web). A brand-new user is NOT onboarded (getOnboarded() -> false),
// so the gate routes them through /onboarding; finishing or skipping onboarding calls setOnboarded(true),
// which persists and routes them to the Dashboard on the next launch. A tiny listener set lets useOnboarded
// re-resolve via useSyncExternalStore when the flag flips.
import { createMMKV } from 'react-native-mmkv';

const KEY = 'onboarded';
const mmkv = createMMKV({ id: 'vela-app' });
const listeners = new Set<() => void>();

/** The persisted first-run flag; a missing key reads false (a fresh install is not onboarded). */
export function getOnboarded(): boolean {
  return mmkv.getBoolean(KEY) ?? false;
}

/** Persist the flag and notify subscribers (so the gate hook re-resolves without a restart). */
export function setOnboarded(value: boolean): void {
  mmkv.set(KEY, value);
  listeners.forEach((listener) => listener());
}

/** Subscribe to flag changes (useSyncExternalStore); returns the unsubscribe. */
export function subscribeOnboarded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
