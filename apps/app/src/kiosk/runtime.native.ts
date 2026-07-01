// The kiosk native-runtime SEAM -- DEVICE half (kiosk-mode.md AOD-11 §4-§9). Metro resolves this .native file
// on iOS / Android / Fire OS; runtime.ts is the web/default no-op. This is the AOD-73 implementation of the
// mechanics AOD-72 wired as no-ops. useKioskRuntime() runs the §4.2 ENTER sequence on mount and the §4.3 EXIT
// reversal on unmount (the wall mounts while active and unmounts on a correct PIN), and returns reactive
// state: the expo-secure-store PIN hash (async read), the live §8.4 ambient (timer-driven), and the first-run
// needsPinSetup + setPin. All the pure math (computeAmbient / backlightFor / hashPin) is imported from the
// headless, unit-tested modules; this file is only the device I/O + wiring.
//
// Pinning (§9): there is NO first-party Expo module for Android startLockTask / iOS Guided Access, and a
// consumer install cannot force itself pinned anyway. Per §9 the portable guard is the app-level gesture+PIN
// (AOD-72) plus the BackHandler intercept below; true device-owner lock-task / Guided Access is the flagged
// managed-lockdown follow-up. That is "behaves per platform" honestly, not a gap.
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Brightness from 'expo-brightness';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SecureStore from 'expo-secure-store';
import { AMBIENT_DAY, type AmbientContextValue } from '../ambient/AmbientContext';
import { setCadenceProfile } from '../widgets/cadence';
import { backlightFor, computeAmbient, DEFAULT_CURVE, DEFAULT_SCHEDULE } from './ambient';
import { hashPin } from './pin';
import type { KioskRuntimeHandle } from './runtime.types';

export type { KioskRuntimeHandle } from './runtime.types';

const KEEP_AWAKE_TAG = 'kiosk';
const PIN_HASH_KEY = 'vela.kiosk.pinHash'; // expo-secure-store key for the exit-PIN hash (§4.3)
const AMBIENT_TICK_MS = 60_000; // §8.4 coarse timer: recompute ambient once a minute (far cheaper than refresh)

// §8.3 the backlight lever is app-scoped and reliable on Android/Fire while foreground; on iOS the change
// persists until the device locks, so leave the dimming to AOD-10's overlay there (controlBacklight false).
// Restore-on-exit still runs on both. Fire OS reports Platform.OS === 'android'.
const CONTROL_BACKLIGHT = Platform.OS === 'android';

export function useKioskRuntime(): KioskRuntimeHandle {
  const [pinHash, setPinHash] = useState<string | undefined>(undefined);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  // Controlled from the first render (day), then the driver ticks it; never undefined on native, so the
  // AmbientProvider is always controlled here (the __velaSetAmbient dev seam is the web slice's, not this one).
  const [ambient, setAmbient] = useState<AmbientContextValue | undefined>(AMBIENT_DAY);

  // Apply the §8.3 backlight for an ambient value; fire-and-forget so a brightness failure never crashes.
  const applyBacklight = useCallback((a: AmbientContextValue) => {
    const target = backlightFor(a, CONTROL_BACKLIGHT);
    if (target != null) void Brightness.setBrightnessAsync(target).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    // §4.2 ENTER, ordered + reversible. Each device call is best-effort (a failure must not block the wall).
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {}); // §5 keep the screen awake
    setCadenceProfile('kiosk'); // §6 cadence profile (cadence.ts FLAG: no scheduler consumer reads it yet)
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {}); // §7

    // §4.3 read the configured exit-PIN hash from secure-store; none stored -> first-run setup (PinSetup).
    void SecureStore.getItemAsync(PIN_HASH_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored) setPinHash(stored);
        else setNeedsPinSetup(true);
      })
      .catch(() => {
        if (!cancelled) setNeedsPinSetup(true);
      });

    // §8.4 ambient driver on a coarse timer -> the CONTROLLED AmbientProvider (via the handle's `ambient`);
    // also drives the §8.3 backlight. computeAmbient is the pure, unit-tested curve (fixed default schedule).
    const tick = () => {
      const a = computeAmbient(new Date(), DEFAULT_SCHEDULE, DEFAULT_CURVE);
      setAmbient(a);
      applyBacklight(a);
    };
    tick(); // apply immediately on enter, not a minute later
    const timer = setInterval(tick, AMBIENT_TICK_MS);

    // §4.3 OS back intercept: hardware back must not casually dismiss the wall (the gesture+PIN is the exit).
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => true);

    // §4.3 EXIT reversal (unmount): release everything ENTER acquired, in reverse.
    return () => {
      cancelled = true;
      clearInterval(timer);
      backSub.remove();
      deactivateKeepAwake(KEEP_AWAKE_TAG);
      setCadenceProfile('foreground');
      void ScreenOrientation.unlockAsync().catch(() => {});
      void Brightness.restoreSystemBrightnessAsync().catch(() => {}); // §8.3 restore system brightness
    };
  }, [applyBacklight]);

  const setPin = useCallback(async (pin: string) => {
    const h = hashPin(pin);
    await SecureStore.setItemAsync(PIN_HASH_KEY, h); // §4.3 store the HASH, never the plaintext
    setPinHash(h);
    setNeedsPinSetup(false);
  }, []);

  return { pinHash, ambient, needsPinSetup, setPin };
}
