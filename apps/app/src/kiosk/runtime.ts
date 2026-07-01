// The kiosk native-runtime SEAM (kiosk-mode.md §4-§9). AOD-72 decision (Xavier-approved): the wall
// PRESENTATION ships web-verified in this PR; the NATIVE runtime mechanics are wired behind this
// platform-split seam and IMPLEMENTED in a separate K-M1 follow-up type:tech-task that ends with the EAS +
// Fire HD 8 device verify (the aod-eas-build-sideload-recipe target). None of the mechanics below can be
// exercised on Expo web, so this base module is the WEB / DEFAULT no-op implementation; the follow-up adds
// `runtime.native.ts` (Metro resolves the `.native` extension on device) with the real calls.
//
// What the follow-up's native impl owns, mapped to the spec:
//   - keep-awake            expo-keep-awake activate/deactivate("kiosk")            (§5)
//   - CadenceProfile        set AOD-10's scheduler profile to "kiosk" / restore     (§6)
//   - ambient driver        computeAmbient(now) on a coarse timer -> AmbientProvider (§8.4)
//   - backlight             expo-brightness setBrightnessAsync(backlightFor(...))    (§8.3)
//   - orientation lock      expo-screen-orientation landscape lock / unlock         (§7)
//   - pinning               startLockTask / Guided Access, best-effort per platform (§9)
//   - OS back intercept     BackHandler so hardware back is not a casual exit        (§4.3)
//   - PIN hash storage      expo-secure-store read of the configured PIN hash        (§4.3)
//
// The wall composes the ALREADY-BUILT AmbientProvider (AOD-62): the driver above pushes computeAmbient
// results through `globalThis.__velaSetAmbient` while active and restores day on stop. On web that driver
// is a no-op (the wall sits at day) and the day/night look is exercised via the same __velaSetAmbient dev
// seam from the preview. The curve math itself (computeAmbient / nightDim) is AOD-11's and is NOT rebuilt.
import { useEffect } from 'react';
import { DEV_KIOSK_PIN, hashPin } from './pin';

export interface KioskRuntime {
  /** Enter: keep-awake on, CadenceProfile "kiosk", start the ambient driver + backlight, lock orientation,
   *  attempt pinning, intercept OS back (§4.2). No-op on web. */
  start(): void;
  /** Exit reversal: release pinning, restore brightness, CadenceProfile "foreground", deactivate keep-awake,
   *  restore day, remove the back intercept (§4.3). No-op on web. */
  stop(): void;
  /** The stored PIN hash to verify the exit against (§4.3). Native reads expo-secure-store; the web/default
   *  slice returns the dev-default hash so the exit flow is demonstrable end to end. */
  readPinHash(): string;
}

// WEB / DEFAULT no-op runtime. Every mechanic is a native capability, so on web (and on native until the
// follow-up adds runtime.native.ts) start/stop do nothing and only readPinHash is functional.
export const kioskRuntime: KioskRuntime = {
  start() {
    /* no-op on web; the native follow-up implements the §4.2 enter sequence. */
  },
  stop() {
    /* no-op on web; the native follow-up implements the §4.3 exit reversal. */
  },
  readPinHash() {
    // The web slice + today's (pre-follow-up) native both use the dev default so the pad is demonstrable.
    // Shipping kiosk to production REQUIRES the follow-up's native impl (expo-secure-store), so the dev PIN
    // never reaches real users; flagged in the PR + the K-M1 follow-up issue.
    return hashPin(DEV_KIOSK_PIN);
  },
};

/**
 * Bind the kiosk runtime to a mounted wall: start() on mount, stop() on unmount. On web this is a no-op
 * (the seam does nothing), so the hook is safe to call from the web-verified KioskWall; the native
 * follow-up makes it load-bearing. Returns the runtime so the wall can read the PIN hash for the exit.
 */
export function useKioskRuntime(): KioskRuntime {
  useEffect(() => {
    kioskRuntime.start();
    return () => kioskRuntime.stop();
  }, []);
  return kioskRuntime;
}
