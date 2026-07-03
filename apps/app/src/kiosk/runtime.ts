// The kiosk native-runtime SEAM -- WEB / DEFAULT no-op half (kiosk-mode.md §4-§9). AOD-72 shipped the wall
// PRESENTATION web-verified and wired every native mechanic behind this seam as a no-op; AOD-73 implements the
// real mechanics in runtime.native.ts (Metro resolves .native on device) and keeps THIS as the web / default
// slice. None of the mechanics can be exercised on Expo web, so here start/stop do nothing and the runtime
// hands back the dev-default PIN hash + an undefined ambient (so the AmbientProvider stays uncontrolled and
// the __velaSetAmbient dev seam still drives the day/night look in the preview).
//
// What the native half owns, mapped to the spec:
//   - keep-awake            expo-keep-awake activate/deactivate("kiosk")            (§5)
//   - CadenceProfile        set the scheduler profile "kiosk" / restore "foreground" (§6, see cadence.ts FLAG)
//   - ambient driver        computeAmbient(now) on a coarse timer -> AmbientProvider  (§8.4)
//   - backlight             expo-brightness setBrightnessAsync(backlightFor(...))     (§8.3)
//   - orientation lock      expo-screen-orientation landscape lock / unlock          (§7)
//   - immersive chrome      UnistylesRuntime.setImmersiveMode(true/false): hide/show BOTH OS bars,
//                           transient-by-swipe on Android 11+; the PIN surfaces render inline in the
//                           same window so a modal window never re-shows the bars (design §8, AOD-76)
//   - pinning               best-effort per platform; the app-level gesture+PIN is the portable guard (§9)
//   - OS back intercept     BackHandler so hardware back is not a casual exit         (§4.3)
//   - PIN hash storage      expo-secure-store read/write, replacing this dev default  (§4.3)
import { useEffect } from 'react';
import { DEV_KIOSK_PIN, hashPin } from './pin';
import type { KioskRuntimeHandle } from './runtime.types';

export type { KioskRuntimeHandle } from './runtime.types';

/**
 * Web / default no-op runtime. The enter/exit mechanics are all native capabilities, so on web (and on native
 * until Metro resolves runtime.native.ts) mounting does nothing: the wall gets the dev-default PIN hash so the
 * exit flow is demonstrable end to end in the preview, `ambient` is undefined so the AmbientProvider stays
 * uncontrolled (the __velaSetAmbient preview seam), needsPinSetup is false (the dev default already "exists"),
 * and setPin is a no-op. Same shape as runtime.native.ts so KioskWall is platform-agnostic.
 */
export function useKioskRuntime(): KioskRuntimeHandle {
  useEffect(() => {
    // no-op on web; runtime.native.ts runs the §4.2 enter / §4.3 exit reversal on mount / unmount.
  }, []);
  return {
    pinHash: hashPin(DEV_KIOSK_PIN),
    ambient: undefined,
    needsPinSetup: false,
    setPin: async () => {
      /* no-op on web; the dev default is used and the native half persists real PINs to secure-store. */
    },
  };
}
