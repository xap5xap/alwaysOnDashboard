// Unistyles v3 configuration (AOD-16 styling foundation, package locked in AOD-25). One typed token
// theme the host chrome and the leaf cards style against. AOD-62 lifts the AOD-37 design-token
// foundation (design-widget-system.md §3) into this file: the typography scale (type.*), the deep-red
// night palette (night.*), the dim overlay token, the status-dot sizing, and the Clock time ramp
// (clockSize). AOD-66 then reconciles the AOD-19 canonical token system (design-tokens.md §9): the
// shipped colours are re-expressed as aliases of a shared primitive ramp set (tier 1, byte-identical
// hexes, §4) and the additive app-wide tokens land (onAccent / scrim / focusRing, the elevation ladder,
// radius.full). No rendered value changes. Imported once at app entry (app/_layout.tsx) before any
// StyleSheet.create runs, and again from jest setupFiles so themes exist under test.
import { StyleSheet } from 'react-native-unistyles';
import type { TextStyle } from 'react-native';

// --- §4.1 primitive colour ramps (AOD-19 tier 1) ----------------------------------------------------
// Raw, role-free palette values: theme-independent and shared the way sharedTokens is. This is the ONLY
// place a colour hex is written as a literal; every semantic role below (darkTheme/lightTheme colours and
// night.*) aliases a step here, so a theme swap re-aliases rather than rewrites (design-tokens.md §3.1,
// §4.1). Step numbering: lower = lighter, higher = darker. Values are the shipped theme VERBATIM (no hue
// added, the one-accent rule holds, §4.6); naming them changes no rendered value.
export const primitive = {
  neutral: {
    0: '#FFFFFF', 50: '#F6F6FA', 100: '#F4F4F8', 200: '#EEEEF3', 300: '#E4E4EC',
    400: '#DADAE2', 500: '#9B9BA8', 600: '#6B6B78', 700: '#2A2A36', 750: '#23232E',
    800: '#1F1F29', 850: '#16161D', 900: '#0B0B0F', 950: '#000000',
  },
  blue: { 400: '#6E8BFF', 600: '#3F5BD6' }, // the one accent (dark / light)
  amber: { 400: '#F2B84B', 600: '#B5791B' }, // status: warning (stale)
  red: { 400: '#FF6B6B', 600: '#D64545' }, // status: error
  green: { 400: '#4CB782', 600: '#2F8F63' }, // status: success
  ember: { 500: '#C2362B', 600: '#8A201B', 700: '#5E1714', 850: '#2E1214', 900: '#140709', 950: '#0A0506' }, // ambient-night reds
} as const;

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
// §4.5: the ambient-night semantic group, now aliasing the ember.* primitives under its shipped role
// names (so the Clock code is untouched). Every resolved hex identical to before.
export const night = {
  bg: primitive.ember[950], // #0A0506 backdrop behind a night-mode card (red-black)
  surface: primitive.ember[900], // #140709 the card fill at night
  border: primitive.ember[850], // #2E1214 the card border at night
  primary: primitive.ember[500], // #C2362B the hero value at night (the time)
  secondary: primitive.ember[600], // #8A201B the date and secondary text at night
  muted: primitive.ember[700], // #5E1714 the zone kicker and tertiary text at night
} as const;

// --- §3.3 / §3.4 sizing tokens ----------------------------------------------------------------------
// Clock time size per supported size class (§8.2). large maps to type.display (96).
const clockSize = { small: 34, medium: 56, wide: 64, large: 96 } as const;
// §3.4 global dim overlay: the host paints overlay.color at opacity dimLevel * overlay.maxDim over a
// dimsWithAmbient: true card. 0.72 matches the kiosk curve's nightDim ~0.7 anchor (AOD-11 §8.2).
const overlay = { color: '#000000', maxDim: 0.72 } as const;
// §3.4 status-dot: the chrome indicator size (r 4.5 -> 9px), filled warning (stale) or error (error).
const dot = { r: 4.5 } as const;
// §5.2 elevation ladder: the no-shadow surface-step model (§5.1: a drop shadow reads as glare on an
// emissive panel). Each level NAMES the semantic surface role it fills with, plus whether it carries the
// 1px hairline border (always the `border` role when present). Theme-independent by design: §5.2 fixes
// the ladder in role terms, so it is identical in dark and light; the consumer resolves
// theme.colors[level.surface] (and theme.colors.border) at the call site. Adds NO colour. NOTE
// elevation.overlay (level 2, a popover/menu surface) is distinct from the `overlay` dim token (§8.1) and
// the `scrim` backdrop (§4.4); the three are compared in §8.3.
const elevation = {
  base: { surface: 'background', border: false }, // 0: the dashboard field, no border
  raised: { surface: 'surface', border: true }, // 1: a card / panel, surface + 1px border
  overlay: { surface: 'surfaceAlt', border: true }, // 2: a popover / menu / selected row, one step up
} as const;
// AOD-35 §10.1 weatherIcon: the one new token group the Calendar+Weather polish adds, a per-render-context
// size ramp for the weather glyph family (the way clockSize ramps the Clock time). The glyphs draw in
// colors.text at this stroke; no colour token is added (design-calendar-weather.md §4.1).
const weatherIcon = {
  currentHero: 44, // Current at medium, beside the type.hero temperature
  currentSmall: 34, // Current at small
  forecastStrip: 30, // Forecast wide, the column icon
  forecastRow: 22, // Forecast large, the row icon
  stroke: 2, // line weight, matching the AOD-37 chrome glyphs
} as const;

// AOD-36 §9.1 sparkline: the Daily Spend chart's sizing + intensity (design-claude-usage.md §4, §9.1).
// A per-context size/intensity ramp the way weatherIcon ramps the weather glyph. The bars draw in
// colors.accent at two opacities and sit on a colors.border baseline, applied in the leaf; NO colour
// token is added (the group is numbers only, like clockSize/weatherIcon, so the theme stays narrow).
const sparkline = {
  chartHeight: { wide: 44, large: 96 }, // the tallest bar per size; the rest scale to the window max
  barGap: 2, // px between bars (bars flex to fill the width)
  barRadius: 1, // the bar corner
  minBarHeight: 2, // a zero / tiny day still shows a baseline tick (a $0 day is not a gap)
  todayOpacity: 1, // today's bar at full colors.accent
  pastOpacity: 0.5, // earlier days recede to the same accent at half intensity
} as const;

// AOD-36 §9.2 money: the Spend MTD cents-precision typography scales (design-claude-usage.md §5.1, §9.2).
// Scales relative to the type.xl dollars; the symbol reduces + raises toward the cap height, the cents
// reduce + recede to colors.textMuted (the fractionColor, applied in the leaf). Like weatherIcon it
// adds NO colour token: dollars + symbol use colors.text, cents use colors.textMuted at the draw site.
const money = {
  symbolScale: 0.62, // the currency symbol ($) vs the integer dollars; raised toward cap height
  fractionScale: 0.62, // the .XX cents vs the integer dollars; baseline-aligned
} as const;

// AOD-30 §9.1 priorityIcon: the My Issues priority glyph sizing + intensity (design-linear.md §4, §9.1).
// The five glyphs are monochrome and carried by SHAPE, not colour: filled bars / the urgent block draw in
// colors.text, unfilled bars in colors.textMuted at offOpacity, applied in the leaf. Like
// weatherIcon/sparkline/money it is numbers only and adds NO colour token (the §3 one-accent rule + the §5
// status-hue reservation forbid a priority-dot rainbow, so priority spends no accent and no status hue).
const priorityIcon = {
  size: 14, // the glyph box edge, per row (the legend draws it larger)
  offOpacity: 0.3, // unfilled bars -> colors.textMuted at this intensity, so level is read by filled-bar count
} as const;

// AOD-30 §9.2 progress: the Current Cycle progress bar sizing + intensity (design-linear.md §6, §9.2). One
// accent at TWO intensities: the fill is colors.accent (the completed fraction), the track is the same
// colors.accent at trackOpacity (the remaining fraction), NOT colors.skeleton (the loading colour, §6.1).
// The radius is the bar's half-height (fully rounded), computed at the draw site. Numbers only, like
// sparkline; adds NO colour token (the progress analogue of the sparkline's one-accent-two-intensities).
const progress = {
  trackHeight: { medium: 12, large: 16 }, // the bar thickness per size
  trackOpacity: 0.18, // the remaining-fraction track = colors.accent at this intensity
} as const;

const sharedTokens = {
  spacing: (v: number) => v * 4,
  radius: { sm: 8, md: 14, lg: 22, full: 9999 }, // §7.2: `full` (9999) added for pills / fully-rounded ends
  type,
  night,
  clockSize,
  overlay,
  dot,
  elevation,
  weatherIcon,
  sparkline,
  money,
  priorityIcon,
  progress,
} as const;

// --- §3.1 colour: semantic roles as primitive aliases (AOD-66, §4.2 / §4.3) -------------------------
// Each role aliases one primitive step; every resolved hex is IDENTICAL to the shipped theme (the inline
// hex on each line is that resolved value). The additive app-wide roles (§4.4) follow the shipped block.
export const darkTheme = {
  ...sharedTokens,
  colors: {
    background: primitive.neutral[900], // #0B0B0F
    surface: primitive.neutral[850], // #16161D
    surfaceAlt: primitive.neutral[800], // #1F1F29
    border: primitive.neutral[700], // #2A2A36
    text: primitive.neutral[100], // #F4F4F8
    textMuted: primitive.neutral[500], // #9B9BA8
    accent: primitive.blue[400], // #6E8BFF (the one accent)
    skeleton: primitive.neutral[750], // #23232E
    error: primitive.red[400], // #FF6B6B
    warning: primitive.amber[400], // #F2B84B
    success: primitive.green[400], // #4CB782
    // additive app-wide semantic roles (§4.4) — derived from existing primitives, no new hue:
    onAccent: primitive.neutral[0], // #FFFFFF: legible foreground ON an accent fill (WCAG AA on blue.400)
    focusRing: primitive.blue[400], // aliases accent today; named so an a11y ring is one token, free to diverge later
    scrim: 'rgba(0, 0, 0, 0.6)', // neutral.950 (#000000) @ 0.60: backdrop behind a floating surface (§5.3); fixed, distinct from `overlay` (§8.3)
  },
} as const;

export const lightTheme = {
  ...sharedTokens,
  colors: {
    background: primitive.neutral[50], // #F6F6FA
    surface: primitive.neutral[0], // #FFFFFF
    surfaceAlt: primitive.neutral[200], // #EEEEF3
    border: primitive.neutral[400], // #DADAE2
    text: primitive.neutral[850], // #16161D (light text == dark surface: one ramp read from both ends, §4.3)
    textMuted: primitive.neutral[600], // #6B6B78
    accent: primitive.blue[600], // #3F5BD6 (the one accent, deeper step for daylight)
    skeleton: primitive.neutral[300], // #E4E4EC
    error: primitive.red[600], // #D64545
    warning: primitive.amber[600], // #B5791B
    success: primitive.green[600], // #2F8F63
    // additive app-wide semantic roles (§4.4):
    onAccent: primitive.neutral[0], // #FFFFFF (WCAG AA on blue.600)
    focusRing: primitive.blue[600], // aliases accent
    scrim: 'rgba(0, 0, 0, 0.4)', // neutral.950 (#000000) @ 0.40: lighter scrim for the foreground theme (§4.4 / §8.3)
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
