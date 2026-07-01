// The kiosk native-runtime SEAM contract, shared by the web/default no-op (runtime.ts) and the device impl
// (runtime.native.ts; Metro resolves the .native extension on iOS / Android / Fire OS). KioskWall consumes
// this handle and is platform-agnostic.
//
// Extended additively from the AOD-72 { start, stop, readPinHash } shape (flagged in AOD-73): the native
// mechanics need REACTIVE surface the old synchronous object could not carry -- the expo-secure-store PIN
// read is async, and the §8.4 ambient driver updates on a timer -- so useKioskRuntime() now returns reactive
// state. start/stop stay INTERNAL to the hook (run on mount / unmount) rather than on the returned object.
import type { AmbientContextValue } from '../ambient/AmbientContext';

export interface KioskRuntimeHandle {
  /** The stored exit-PIN hash to verify against (§4.3). Native reads expo-secure-store; undefined while the
   *  read is in flight or when no PIN is set yet (see needsPinSetup). Web returns the dev-default hash. */
  pinHash: string | undefined;
  /** The live ambient signal (§8.4) on native, driving the CONTROLLED AmbientProvider. undefined on web so
   *  the provider stays uncontrolled and the __velaSetAmbient dev seam keeps driving the preview. */
  ambient: AmbientContextValue | undefined;
  /** Native + no stored PIN: the wall shows the first-run PinSetup before it is exitable (§4.3). Web: false. */
  needsPinSetup: boolean;
  /** Persist a first-run exit PIN (native hashes + writes expo-secure-store, then clears needsPinSetup). */
  setPin(pin: string): Promise<void>;
}
