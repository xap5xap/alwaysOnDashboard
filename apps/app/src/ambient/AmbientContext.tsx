// The ambient (day/night) signal as React context (AOD-10 §8, design-widget-system.md §7). This is the
// widget-level MECHANISM only: the host paints a global dim overlay for the default (dimsWithAmbient:
// true) widget, and a widget that wants a real night appearance reads useAmbient() and recolours itself
// (the Clock, §8.5). The SCHEDULE and dim curve that set { phase, dimLevel } are AOD-11's kiosk runtime
// (kiosk-mode.md §8); this module does NOT build them. It only carries the signal and defaults to full
// day so every consumer is correct with no provider mounted (tests, the foreground app pre-kiosk).
import React, { createContext, useContext, useEffect, useState } from 'react';

// AOD-10 §8: the schedule (AOD-11) decides which phase is current.
export type DaylightPhase = 'day' | 'night';

export interface AmbientContextValue {
  phase: DaylightPhase;
  dimLevel: number; // 0..1; 0 = full brightness (day), ~0.7 = full night. AOD-11 sets the curve.
}

// Full day: no dim, no night recolour. The right default everywhere the kiosk runtime is not driving it.
export const AMBIENT_DAY: AmbientContextValue = { phase: 'day', dimLevel: 0 };

const AmbientContext = createContext<AmbientContextValue>(AMBIENT_DAY);

/**
 * The AOD-10 §8 opt-in hook. Additive: it does NOT change the AOD-8 §6.1 render props ({ data, config,
 * size }); a widget MAY call it (the Clock does) and is never required to. Returns AMBIENT_DAY when no
 * provider is mounted, so a leaf or the host overlay is always safe to read it.
 */
export function useAmbient(): AmbientContextValue {
  return useContext(AmbientContext);
}

declare global {
  // eslint-disable-next-line no-var
  var __velaSetAmbient: ((next: AmbientContextValue) => void) | undefined;
}

export interface AmbientProviderProps {
  /** Controlled value: AOD-11's kiosk runtime (or a test) supplies the computed ambient here. When
   *  omitted, the provider self-manages, defaulting to day, and exposes a dev setter (below). */
  value?: AmbientContextValue;
  children: React.ReactNode;
}

/**
 * Provides the ambient signal to the dashboard subtree. Until AOD-11's kiosk runtime drives it, the
 * provider holds `day` and (in __DEV__, uncontrolled) publishes a `globalThis.__velaSetAmbient` setter.
 * That setter is BOTH the seam AOD-11 will push `computeAmbient(now)` results through and the way the
 * day/night look is exercised in dev without the kiosk schedule (drive it from the web preview to verify
 * the dim overlay and the deep-red night Clock). It is dev-only and a no-op in production.
 */
export function AmbientProvider({ value, children }: AmbientProviderProps) {
  const [internal, setInternal] = useState<AmbientContextValue>(AMBIENT_DAY);

  useEffect(() => {
    if (!__DEV__ || value) return;
    globalThis.__velaSetAmbient = setInternal;
    return () => {
      if (globalThis.__velaSetAmbient === setInternal) globalThis.__velaSetAmbient = undefined;
    };
  }, [value]);

  return <AmbientContext.Provider value={value ?? internal}>{children}</AmbientContext.Provider>;
}
