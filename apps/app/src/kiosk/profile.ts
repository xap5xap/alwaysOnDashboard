// The wall-mount profile (kiosk-mode.md §7.1 / design-kiosk-wall.md §3). AOD-11 declares the
// WallMountProfile interface and leaves its VISUAL VALUES to AOD-39; §3 fixes them: theme 'dark',
// typeScale (the wall.typeScale token, 1.4), minContrast 'AA', hideChrome true. The profile is applied at
// render over an ordinary DashboardLayout: the geometry (the free-form rects, AOD-7) is UNTOUCHED, and the
// profile changes only the type scale, the theme, the contrast floor, and the chrome (kiosk-mode §7.2, the
// AOD-8/AOD-7 seam holds). typeScale is passed in from the theme at the call site so the token stays the
// single source of truth (the wall-tokens.test.ts lock pins it to 1.4).
export interface WallMountProfile {
  /** Wall mount is a dark theme by default (ambient, low glare). §3 fixes this to 'dark'. */
  theme: 'dark';
  /** Multiplier on the AOD-37 §3.3 type ramp for across-the-room legibility (the wall.typeScale token). */
  typeScale: number;
  /** Minimum text/background contrast the host enforces in this profile (§3 fixes this to 'AA'). */
  minContrast: 'AA' | 'AAA';
  /** Suppress the app bar, nav, edit handles, and status chrome while active (§3 fixes this to true). */
  hideChrome: boolean;
}

/**
 * Build the wall-mount profile for a given type scale (design-kiosk-wall.md §3). The three fixed fields
 * are the §3 constants; `typeScale` is injected from `theme.wall.typeScale` at the call site so the token
 * remains the one source of truth. Pure, so the §3 contract is unit-testable.
 */
export function wallProfile(typeScale: number): WallMountProfile {
  return { theme: 'dark', typeScale, minContrast: 'AA', hideChrome: true };
}
