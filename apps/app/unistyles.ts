// Unistyles v3 configuration (AOD-16 styling foundation, package locked in AOD-25). One typed token
// theme the host chrome and the leaf cards style against. AOD-62 lifts the AOD-37 design-token
// foundation (design-widget-system.md §3) into this file: the typography scale (type.*), the deep-red
// night palette (night.*), the dim overlay token, the status-dot sizing, and the Clock time ramp
// (clockSize). The shipped dark/light colors are recapped unchanged (§3.1). Imported once at app entry
// (app/_layout.tsx) before any StyleSheet.create runs, and again from jest setupFiles so themes exist
// under test.
import { StyleSheet } from 'react-native-unistyles';
import type { TextStyle } from 'react-native';

// --- §3.3 typography scale --------------------------------------------------------------------------
// Named steps replacing the renderers' ad-hoc font sizes, so every card shares one vertical rhythm and
// the build references theme.type.* rather than literals. Numeric steps (display/hero/xl) carry
// tabular-nums so digits do not jitter as a value ticks or refreshes. Annotated as TextStyle so the
// weight/variant literals stay RN-typed (and fontVariant is a mutable array, spreadable into styles).
type TypeStep =
  | 'display'
  | 'hero'
  | 'xl'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'meta'
  | 'caption'
  | 'badge';

// Only the text properties the scale carries (NOT the full TextStyle): keeping RN-style-shaped objects
// out of the theme keeps Unistyles' deep-style typing from leaking into every StyleSheet.create return.
type TypeToken = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'letterSpacing' | 'fontVariant' | 'textTransform'>;

const type: Record<TypeStep, TypeToken> = {
  display: { fontSize: 96, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  hero: { fontSize: 44, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  xl: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 18, fontWeight: '600' },
  heading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 11, fontWeight: '500', letterSpacing: 1 },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
};

// --- §3.2 the deep-red night / ambient palette ------------------------------------------------------
// Read ONLY by a widget that opts out of the global overlay (dimsWithAmbient: false) and recolours
// itself at phase 'night' (the Clock, §8.5). Theme-independent (deep red is deep red), so it is shared.
const night = {
  bg: '#0A0506', // backdrop behind a night-mode card (red-black)
  surface: '#140709', // the card fill at night
  border: '#2E1214', // the card border at night
  primary: '#C2362B', // the hero value at night (the time)
  secondary: '#8A201B', // the date and secondary text at night
  muted: '#5E1714', // the zone kicker and tertiary text at night
} as const;

// --- §3.3 / §3.4 sizing tokens ----------------------------------------------------------------------
// Clock time size per supported size class (§8.2). large maps to type.display (96).
const clockSize = { small: 34, medium: 56, wide: 64, large: 96 } as const;
// §3.4 global dim overlay: the host paints overlay.color at opacity dimLevel * overlay.maxDim over a
// dimsWithAmbient: true card. 0.72 matches the kiosk curve's nightDim ~0.7 anchor (AOD-11 §8.2).
const overlay = { color: '#000000', maxDim: 0.72 } as const;
// §3.4 status-dot: the chrome indicator size (r 4.5 -> 9px), filled warning (stale) or error (error).
const dot = { r: 4.5 } as const;

const sharedTokens = {
  spacing: (v: number) => v * 4,
  radius: { sm: 8, md: 14, lg: 22 },
  type,
  night,
  clockSize,
  overlay,
  dot,
} as const;

// --- §3.1 colour (shipped, recapped) ----------------------------------------------------------------
const darkTheme = {
  ...sharedTokens,
  colors: {
    background: '#0B0B0F',
    surface: '#16161D',
    surfaceAlt: '#1F1F29',
    border: '#2A2A36',
    text: '#F4F4F8',
    textMuted: '#9B9BA8',
    accent: '#6E8BFF',
    skeleton: '#23232E',
    error: '#FF6B6B',
    warning: '#F2B84B',
    success: '#4CB782',
  },
} as const;

const lightTheme = {
  ...sharedTokens,
  colors: {
    background: '#F6F6FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEEF3',
    border: '#DADAE2',
    text: '#16161D',
    textMuted: '#6B6B78',
    accent: '#3F5BD6',
    skeleton: '#E4E4EC',
    error: '#D64545',
    warning: '#B5791B',
    success: '#2F8F63',
  },
} as const;

const appThemes = { dark: darkTheme, light: lightTheme };
const breakpoints = { xs: 0, sm: 360, md: 600, lg: 900, xl: 1200 } as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { initialTheme: 'dark' },
});
