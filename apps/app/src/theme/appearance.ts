// AOD-121 theme composition — the palette × scheme axis selector (design-color-law.md §8).
//
// Colour is a THEME AXIS: the (dark | light) SCHEME and the (signature | monochrome) PALETTE compose into
// one of the four Unistyles themes registered in unistyles.ts. `themeName` is the PURE mapping (no side
// effect, fully testable); `selectTheme` is the thin imperative wrapper that flips the live Unistyles
// runtime. Signature is the default palette — its keys ARE the base 'dark' / 'light' themes — so composing
// (signature, dark) yields exactly the shipped default and nothing new has to run at boot.
//
// v1 ships Signature (default) + Monochrome, both free (§8, §96). The Themes PICKER is POST-LAUNCH
// (design-color-law §8: "the picker lives in Settings as a personalization reward … per-service is a
// plausible Pro lever"). This module is the machinery that future picker will call: it builds NO picker
// UI (out of AOD-121 scope). The scheme half is likewise future wiring — today StyleSheet.configure pins
// initialTheme 'dark', so nothing calls selectTheme yet; it exists so the picker is a token-remap switch,
// never a redesign (§116.6).
import { UnistylesRuntime } from 'react-native-unistyles';
import type { ThemeName } from '../../unistyles';

/** The colour palette axis: the §4 signature hues, or the §8 neutral-ramp collapse. Signature is default. */
export type Palette = 'signature' | 'monochrome';

/** The light / dark axis, composed with the palette. */
export type Scheme = 'dark' | 'light';

/**
 * PURE: map a (palette, scheme) selection onto a registered Unistyles theme key. Signature is the base
 * axis (its themes ARE 'dark' / 'light'); Monochrome suffixes the scheme. Return is `ThemeName`
 * (=== keyof UnistylesThemes) so it feeds UnistylesRuntime.setTheme with no cast.
 */
export function themeName(palette: Palette, scheme: Scheme): ThemeName {
  if (palette === 'monochrome') {
    return scheme === 'dark' ? 'darkMonochrome' : 'lightMonochrome';
  }
  return scheme; // signature: the base 'dark' / 'light' themes
}

/**
 * The thin selection wrapper: flip the live theme to the composed (palette, scheme). The post-launch
 * Settings themes picker is the intended consumer; per §8 a theme swap is a pure role→colour remap, so the
 * card faces (which bind to roles, not hexes) re-tint with no re-render logic of their own.
 */
export function selectTheme(palette: Palette, scheme: Scheme): void {
  UnistylesRuntime.setTheme(themeName(palette, scheme));
}
