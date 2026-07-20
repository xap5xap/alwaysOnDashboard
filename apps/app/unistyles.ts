// Unistyles v3 configuration (AOD-16 styling foundation, package locked in AOD-25). One typed token
// theme the host chrome and the leaf cards style against. AOD-62 lifts the AOD-37 design-token
// foundation (design-widget-system.md §3) into this file: the typography scale (type.*), the deep-red
// night palette (night.*), the dim overlay token, the status-dot sizing, and the Clock time ramp
// (clockSize). AOD-66 then reconciles the AOD-19 canonical token system (design-tokens.md §9): the
// shipped colours are re-expressed as aliases of a shared primitive ramp set (tier 1, byte-identical
// hexes, §4) and the additive app-wide tokens land (onAccent / scrim / focusRing, the elevation ladder,
// radius.full). No rendered value changes. Imported once at app entry (app/_layout.tsx) before any
// StyleSheet.create runs, and again from jest setupFiles so themes exist under test. AOD-120 lands the
// frozen data-hue colour-law families (design-color-law.md §4-6; the freeze: claude-design/Vela - Made
// Fast.pdf 1a): the temp/ink/pane primitive ramps plus the semantic theme families temp/ink/pane/when.
// Machinery only — no leaf consumes them yet. Every data hex is FROZEN: device-verified on the Fire HD 8
// in a dark room and passed (AOD-119, GO 2026-07-18) — no re-tune needed, the render-frozen values stand.
import { StyleSheet } from 'react-native-unistyles';
import type { TextStyle } from 'react-native';

// --- §4.1 primitive colour ramps (AOD-19 tier 1) ----------------------------------------------------
// Raw, role-free palette values: theme-independent and shared the way sharedTokens is. This is the ONLY
// place a colour hex is written as a literal; every semantic role below (darkTheme/lightTheme colours,
// night.* and the AOD-120 data families) aliases a step here, so a theme swap re-aliases rather than
// rewrites (design-tokens.md §3.1, §4.1). Step numbering: lower = lighter, higher = darker (the AOD-120
// data ramps instead step by the freeze's own names — a hue walk with lightness pinned). The AOD-19-era
// values are the shipped theme VERBATIM (naming them changed no rendered value). AOD-120 then extends the
// tier with the frozen data-hue ramps (temp / ink / pane below; design-color-law.md §4-6, hexes from
// claude-design/Vela - Made Fast.pdf 1a, names taken verbatim): for DATA the colour law supersedes the
// §4.6 one-accent rule (design-color-law.md §9 records the revision) — a figure may wear the hue of what
// it measures, while blue.400/600 stays the INTERACTION accent only (taps), never a data hue. EVERY data
// hex is FROZEN: device-verified on the Fire HD 8 in a dark room (AOD-119, GO 2026-07-18) — web renders
// are density- and brightness-blind, so that on-panel pass was the gate. Any future change lands as a
// deliberate re-freeze here + in __tests__/data-tokens.test.ts, never a silent drift.
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
  // --- AOD-120 data-hue ramps — ALL HEXES FROZEN (device-verified AOD-119, GO 2026-07-18) -------------
  // The thermometer (--temp-*): 8 stops cold→hot, linear blend between neighbouring stops at the draw
  // site; lightness is pinned across the run so any temperature clears any pane at hero sizes. Vela blue
  // at the cold end, the sail's gold in the middle, ember only past real heat. °C anchors from the freeze.
  temp: {
    ice: '#7FA3D9', // <= 6°
    cold: '#8CA9C7', // 10°
    cool: '#B3AFA0', // 13°
    mild: '#C8B183', // 15°
    warm: '#D4A868', // 17°
    balmy: '#DC9853', // 19°
    hot: '#E08348', // 22°
    swelter: '#D65A3C', // 30°+
  },
  // The event inks (--ink-*): five fixed inks, never mixed; rain + sun each carry a dim variant. The
  // fifth ink, bone ("--ink-bone #F4F4F8 (= --text)"), aliases the neutral ramp at the SEMANTIC tier
  // (see inkDark/inkLight below) rather than duplicating a literal here.
  ink: {
    rain: '#6FB8C9', rainDim: '#5FA8BA', // chance figures, the falling strokes
    sun: '#D9A458', sunDim: '#9E7E4A', // the sun glyph, the sun-mark, rise and set
    moon: '#C6CBE8', // moon glyphs on neutral ground (on the night pane the moon draws in the pane's gold)
    storm: '#A895E8', // the bolt, and only the bolt
  },
  // The condition panes (--pane-*): 12 condition × daylight swatches, each bg / line / ink — every one
  // pulled ~40% from the Sailor's Delight render toward the neutral surface and held within two hairline
  // steps of neutral.850 (#16161D) so the pinned-lightness figures always win. Gray weather (cloudy, fog,
  // drizzle, rain, storm, snow) ignores the hour; clear and partly carry first-light / day / golden /
  // night variants. clearNight alone carries a 4th value: the gold the moon draws in ON that pane (the
  // colour-law §7 night frame's gold moon).
  pane: {
    clearFirst: { bg: '#221419', line: '#3C242C', ink: '#C29AA4' },
    clearDay: { bg: '#17273C', line: '#2A3E58', ink: '#94ACC2' },
    clearGolden: { bg: '#2C1E12', line: '#48331E', ink: '#C2A478' },
    clearNight: { bg: '#121527', line: '#262B4A', ink: '#C9BE9E', moon: '#E0C182' },
    partlyDay: { bg: '#192332', line: '#2C384C', ink: '#9AAABE' },
    partlyNight: { bg: '#141724', line: '#272C42', ink: '#B8B29C' },
    cloudy: { bg: '#1C2028', line: '#2E333E', ink: '#A8B2BF' },
    fog: { bg: '#201E26', line: '#343141', ink: '#ACA8B8' },
    drizzle: { bg: '#16272E', line: '#2A3F47', ink: '#8FB5BC' },
    rain: { bg: '#14262D', line: '#274046', ink: '#89B4BC' },
    storm: { bg: '#1A172E', line: '#2E294C', ink: '#A29CC6' },
    snow: { bg: '#1F2734', line: '#344052', ink: '#BCCBDA' },
  },
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
// AOD-20 §3.4 adds `lineHeight` to the Pick (still narrow, so the aod-unistyles-style-token-gotcha
// deep-style flood does not return); it is set only on the multi-line app-copy steps below.
type TypeToken = Pick<
  TextStyle,
  'fontSize' | 'fontWeight' | 'letterSpacing' | 'fontVariant' | 'textTransform' | 'lineHeight'
>;

const type: Record<TypeStep, TypeToken> = {
  display: { fontSize: 96, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  hero: { fontSize: 44, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  xl: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 18, fontWeight: '600' },
  heading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '500', lineHeight: 20 }, // §3.4 onboarding paragraphs / paywall body
  label: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 13, fontWeight: '400', lineHeight: 18 }, // §3.4 input hint / dialog body / status line
  caption: { fontSize: 11, fontWeight: '500', letterSpacing: 1, lineHeight: 16 }, // §3.4 multi-line captions
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

// --- AOD-120 data-hue semantic families (design-color-law.md §4-6, §8) ------------------------------
// The colour-law families, landed as MACHINERY only: no leaf consumes them yet (the card faces bind in
// their own issues). Semantic tier of the data hues — the theme keys temp / ink / pane / when alias the
// AOD-120 primitive ramps the way colors.* aliases neutral/blue steps, so the future monochrome and
// per-service themes remap ROLES without touching primitives (§8: a theme is a role→colour remap, never
// a redesign). Deliberately NOT inside `colors`: roleColor() and every §12 token-group alias assume
// colors is a FLAT role→string map, so the structured families sit beside it as theme-level groups (the
// `night` precedent). ALL VALUES FROZEN (device-verified AOD-119, GO 2026-07-18). Accent discipline (the Made Fast 1a
// freeze + the AOD-120 acceptance rule; the freeze moved the cold end OFF the accent that colour-law §4
// nominally sketched onto it): blue.400/600 — the interaction accent — appears in NO family below.
// bone is the freeze's "--ink-bone #F4F4F8 (= --text)": it aliases each theme's text step, so a figure
// with nothing to say draws exactly as plain text does (gray weather is allowed to be gray).
const inkDark = { ...primitive.ink, bone: primitive.neutral[100] } as const; // bone #F4F4F8 = dark colors.text
const inkLight = { ...primitive.ink, bone: primitive.neutral[850] } as const; // bone #16161D = light colors.text
// The imminence scale (--when-*): Calendar's one reading (§6 — time-to-event: the soonest or
// happening-now event warmest, distant events cool; Xavier's 2026-07-12 call overriding Made Fast 1e's
// "a meeting isn't hot"). Six stops CUT from the thermometer's cold end through balmy (ice→balmy
// verbatim, re-keyed to imminence names, NO new hex), so a meeting warms as it nears but never reads
// hot — the ramp stops where real heat begins.
const when = {
  distant: primitive.temp.ice, // #7FA3D9 the far-off event, coolest
  far: primitive.temp.cold, // #8CA9C7
  approaching: primitive.temp.cool, // #B3AFA0
  near: primitive.temp.mild, // #C8B183
  soon: primitive.temp.warm, // #D4A868
  now: primitive.temp.balmy, // #DC9853 happening-now / the soonest event, the warmest a meeting gets
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

// AOD-132 §4/§7 transit: the Weather Transit sun-arc geometry (the analog of weatherIcon/sparkline — a
// per-render-context NUMBERS-ONLY group; the colours arrive as ROLE values from the leaf: pane.line for the
// arc, ink.sun for the sun-mark, pane.clearNight.moon / ink.moon for the moon). The arc is a full quadratic
// CURVE (arcHeight tall) at L and a flat WATERLINE (waterlineHeight) at W/M; the sun-mark rides it, and at
// night a moon crescent (moonRadius) sits below. Test-locked in __tests__/transit-tokens.test.ts.
const transit = {
  arcHeight: 46, // the curved sun-arc band height (L)
  waterlineHeight: 22, // the flat waterline band height (W/M)
  stroke: 2, // the arc/waterline line weight (matches the weatherIcon glyph stroke)
  sunRadius: 5, // the gold sun-mark disc radius
  moonRadius: 5, // the night moon crescent radius
  inset: 10, // horizontal inset of the arc endpoints from the band edge
} as const;

// AOD-133 §range: the Weather Forecast RANGE face geometry (the analog of transit/weatherIcon/sparkline —
// a per-render-context NUMBERS-ONLY group; the colours arrive as ROLE values from the leaf: the span bar
// wears tempColor(day.tempMax) (theme.temp) as a SOLID, the lo/hi numerals bind colors.textMuted/text, and
// precip binds theme.ink.rain). Each day's hi-lo is a horizontal span-bar on the week's shared min-max
// scale (range.ts); today's bar is a touch thicker and full-bright, later days recede to pastOpacity. The
// row heights + glyph sizes drive the height-fit (fitCount): L is the comfortable list, W the compact one.
// Test-locked in __tests__/range-tokens.test.ts. Adds NO colour token (like every geometry group).
const range = {
  barHeight: 3, // the span-bar thickness (later days)
  todayBarHeight: 4, // today's span-bar, a touch thicker (the bright lead)
  capRadius: 2, // the rounded bar end-cap radius
  minBarWidth: 8, // a rangeless day (tempMin === tempMax) still shows a short mark (never invisible)
  todayOpacity: 1, // today's bar at full tempColor
  pastOpacity: 0.5, // later days' bars recede to the same tempColor, dimmer (the Today-bright / muted-later step)
  rowHeight: 20, // the L row height (fitCount)
  compactRowHeight: 14, // the W row height (fitCount, denser)
  glyph: 16, // the L row day-glyph size
  compactGlyph: 13, // the W row day-glyph size
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

// AOD-130 §meridian: the Clock MERIDIAN satellite geometry (design-color-law.md §Clock, RB-M2 AOD-130). The
// analog of money/transit — a per-render-context NUMBERS-ONLY group; the colours arrive as ROLE values from
// the leaf (the hero figure = colors.text / night.primary, the meridiem recedes to colors.textMuted /
// night.secondary, the seconds whisper to colors.textMuted / night.muted). The meridiem (AM/PM) and the
// seconds whisper are sized as FRACTIONS of the fitted hero time figure (so they scale WITH it under the
// FitBody width-fit, exactly the way money.symbolScale sizes the currency symbol off the dollars); gapScale
// is the hero->satellite gap, also a fraction of the figure so the whole composite scales uniformly and the
// fit stays exact. secondsOpacity recesses the whisper ONE step further than its muted colour (present-but-
// recessive; the exact value is Xavier's device call, unpinned in the runbook). Test-locked in
// __tests__/meridian-tokens.test.ts. Adds NO colour token (like every geometry group).
const meridian = {
  meridiemScale: 0.34, // the AM/PM height vs the hero time figure
  secondsScale: 0.28, // the seconds whisper height vs the hero figure (smaller than the meridiem)
  secondsOpacity: 0.5, // the whisper recedes further than its muted colour (present-but-recessive)
  gapScale: 0.12, // the hero -> satellite horizontal gap, as a fraction of the fitted figure size
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

// AOD-134 §soundings: the My Issues SOUNDINGS silhouette geometry (the priority-mark row that is the new
// hero mark; design-linear.md §4, the RB-M2 runbook §5 AOD-134). The analog of priorityIcon/transit/range —
// a per-render-context NUMBERS-ONLY group; the marks are drawn bone / shape-only by PriorityGlyph at the
// draw site (filled = colors.text, ghost bars / none-dashes = colors.textMuted @ priorityIcon.offOpacity),
// so this adds NO colour token (the §4.2 priority-is-shape rule + the one-accent + status-hue reservation
// forbid a priority hue). `mark` is the silhouette glyph edge; `gap` the horizontal space between marks (the
// packing unit — soundings.ts caps the row to what fits so it never clips); `rowHeight` the silhouette band
// reserved above the L rows in the height-fit (fitCount lead). Test-locked in __tests__/soundings-tokens.test.ts.
const soundings = {
  mark: 14, // the silhouette glyph edge (the priorityIcon.size weight; its own token so the silhouette can tune)
  gap: 4, // spacing(1): the horizontal gap between marks (the packing unit)
  rowHeight: 18, // the silhouette band reserved above the L rows (fitCount lead): the mark + a little breathing
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

// AOD-135 §ring: the Current Cycle "Log Line" segmented-knot-ring geometry (design-linear.md §6, claude-
// design/prompts/linear.md "The Log Line 21-knot ring"). The analog of transit/sparkline/soundings — a per-
// render-context NUMBERS-ONLY group; the colour arrives as a ROLE from the leaf: the ONE accent lives here,
// lit = colors.accent and unlit = the SAME accent @ progress.trackOpacity (0.18), so the ring spends no
// second hue and Monochrome separates lit/unlit by intensity for free. The knot COUNT is dynamic (= the
// cycle's totalCount, never the "21" in the title): `knot`/`minKnot`/`gap` drive the crowding-adaptive disc
// radius in logline.ts (a large N shrinks the discs toward `minKnot`, never below), and the leaf fits
// `radius` to the host box (the AOD-81 fit-to-bounds lesson — never clip on the density-scaled device), so
// `radius` is the per-size CAP not a fixed size. `radius` is the ring the knot CENTRES sit on, per RINGED
// size (S texture / M full ring / L countable tally); W is the linear `dash` bar (a ring does not fit a
// wide-short cell), so W has no ring radius. `stroke` is the smooth Dead-Reckoning continuous-ring weight.
// Test-locked in __tests__/ring-tokens.test.ts. Adds NO colour token (like every geometry group).
const ring = {
  radius: { S: 22, M: 30, L: 46 }, // the knot-centre ring radius per ringed size (cap; the leaf fits to box)
  knot: 4, // the ideal / max knot disc radius (small N); the stable box margin
  minKnot: 1.5, // the knot disc radius floor (a large N stays visible, never 0)
  gap: 2, // the min gap between adjacent knot edges (the crowding-cap input)
  stroke: 3, // the smooth (Dead Reckoning) continuous-ring stroke width
  dash: { height: 10, gap: 3, radius: 2 }, // the W segmented bar: one dash per issue, flexed across the width
} as const;

// --- AOD-20 §12 component token groups (design-component-library.md) ---------------------------------
// The app-chrome component library's tokens. Each group carries GEOMETRY (numbers) plus ROLE-NAME
// ALIASES (semantic colour role / type-step / radius keys, as plain strings), never a raw hex, exactly
// like the shipped `elevation` group ({ surface: 'surfaceAlt', border: true }). The consumer resolves
// theme.colors[role] / theme.type[step] / theme.radius[key] at the call site, so a theme swap re-aliases
// underneath (the §4 one layering rule). Theme-independent by design (the roles differ per theme, the
// aliases do not). Unistyles-safe: plain data only, no embedded TextStyle (the aod-unistyles-style-token-
// gotcha rule is about type.*, kept narrow above). `null` on a variant `bg` means "no fill" (a text or
// bordered button), resolved to `undefined` at the call site the way `elevation.border: false` is read.

// §5 buttons: four variants, three sizes, the shared pressed tint + disabled opacity.
const button = {
  radius: 'md', // a full-pill button overrides to radius.full at the call site
  gap: 8, // spacing(2) icon -> label
  disabledOpacity: 0.38, // §5 disabled
  pressedTint: 'accentMuted', // §5 text buttons (secondary/ghost) pressed background
  size: {
    sm: { height: 32, paddingX: 12, type: 'label' }, // spacing(3)
    md: { height: 40, paddingX: 16, type: 'body' }, // spacing(4), the default
    lg: { height: 48, paddingX: 20, type: 'heading' }, // spacing(5)
  },
  variant: {
    primary: { bg: 'accent', fg: 'onAccent', border: false }, // the one primary action per view
    secondary: { bg: null, fg: 'accent', border: true }, // a paired alternative (e.g. Cancel)
    ghost: { bg: null, fg: 'accent', border: false }, // a low-weight action / link
    destructive: { bg: 'error', fg: 'onAccent', border: false }, // Disconnect / Remove
  },
} as const;

// §6 inputs: one fill (surfaceAlt); the states recolour the BORDER only, so no semantic `border` fork.
const input = {
  height: 44,
  paddingX: 12, // spacing(3)
  radius: 'sm', // 8
  fill: 'surfaceAlt', // the one fill (§13 drift 2)
  fillDisabled: 'surface',
  border: 'border', // input.border -> border
  borderFocus: 'focusRing', // input.borderFocus -> focusRing (1.5px)
  borderError: 'error', // input.borderError -> error
  placeholder: 'textMuted', // §13 drift 3 (replaces the hardcoded #6B7280 / #7A7F8C)
  borderWidth: 1,
  borderWidthFocus: 1.5,
  disabledOpacity: 0.4,
} as const;

// §7 toggle / switch: the track is a radius.full pill; states swap the track + knob roles.
const toggle = {
  trackWidth: 52,
  trackHeight: 30,
  knobRadius: 11,
  padding: 2, // knob inset within the track
  radius: 'full',
  border: 'border', // the off-track hairline
  disabledOpacity: 0.4,
  on: { track: 'accent', knob: 'onAccent' },
  off: { track: 'surfaceAlt', knob: 'textMuted' },
} as const;

// §7 segmented control (EXCLUSIVE choice, the strong selected state): a full-accent selected segment.
const segmented = {
  height: 36,
  radius: 'sm',
  paddingX: 12, // spacing(3) per segment
  group: 'surfaceAlt', // the group track
  border: 'border',
  fg: 'text', // an unselected label
  selectedBg: 'accent',
  selectedFg: 'onAccent',
} as const;

// §7 selectable pills (MULTI-SELECT, the soft selected state): the accentMuted fill.
const pill = {
  radius: 'full',
  paddingX: 12, // spacing(3)
  paddingY: 8, // spacing(2)
  fg: 'text', // an unselected label
  border: 'border',
  selectedBg: 'accentMuted',
  selectedBorder: 'accent',
  selectedFg: 'accent',
} as const;

// §8 surfaces (all at elevation.raised). The widget `card` is REUSED from design-widget-system §4 and
// NOT redesigned; these mirror its geometry for the app-chrome row-group / list row / auth card.
const card = { radius: 'md', padding: 12 }; // spacing(3), same as the widget card
const rowGroup = { radius: 'md', divider: 'border' }; // rows split by rowGroup.divider -> border
const listRow = { padding: 12, gap: 12 }; // spacing(3): leading / identity / trailing
const authCard = { radius: 'lg', padding: 24 }; // spacing(6): the SignIn / paywall panel

// §9 overlays: scrim + elevation.overlay, never a shadow. The sheet/modal fill at elevation.overlay
// (surfaceAlt); the popover carries no scrim. Radii + paddings only (the scrim/elevation come from roles).
const sheet = { radius: 'lg', paddingX: 20, paddingTop: 16, grabberWidth: 36, grabberHeight: 4 }; // spacing(5)/(4)
const modal = { radius: 'lg', padding: 20 }; // spacing(5)
const popover = { radius: 'md' };

// §10 skeleton: bars in the `skeleton` colour role, a slow shimmer sweep (no spinner). Reuses the widget
// loading-skeleton pattern (design-widget-system §5); numbers + the bar colour role. Named `skeletonToken`
// so the module const does not shadow the `colors.skeleton` role; exposed as theme.skeleton in the theme.
const skeletonToken = {
  color: 'skeleton', // the bar fill role
  barRadius: 'sm',
  shimmerOpacity: 0.5, // the sweep band intensity over a bar
} as const;

// §10 badges (type.badge = 10/700/+1/uppercase). Per-kind role maps: the status dot reuses the widget
// status mark; PRO/NEW = accentMuted fill + accent text; count = accent (primary) or surfaceAlt (neutral).
const badge = {
  radius: 'full',
  paddingX: 8, // spacing(2)
  paddingY: 2,
  status: { warning: 'warning', error: 'error', success: 'success' }, // dot + uppercase label
  accent: { bg: 'accentMuted', fg: 'accent' }, // PRO / NEW
  count: {
    primary: { bg: 'accent', fg: 'onAccent' },
    neutral: { bg: 'surfaceAlt', fg: 'text', border: 'border' },
  },
} as const;

// §11 lockRow: a listRow variant, the entitlements Gate fallback affordance (UX-only, server enforces).
// The padlock glyph + dimmed title + a PRO badge (badge.accent) + a chevron -> paywall; the locked tile
// darkens its preview with colors.scrim.
const lockRow = {
  padding: 12, // spacing(3), like listRow
  gap: 12,
  title: 'textMuted', // the dimmed row title
  glyph: 'textMuted', // the padlock stroke
  dimOpacity: 0.6, // the row reads dimmed vs an enabled control
} as const;

// --- AOD-68 §11 screen-scoped token groups (design-core-navigation.md §11) -------------------------
// The nav-shell geometry, the appBar/screen analog of the AOD-20 §12 component groups: GEOMETRY
// (numbers) plus ROLE-NAME ALIASES (a semantic colour role / a type step, as plain strings), never a
// raw hex. The consumer resolves theme.colors[role] / theme.type[step] at the call site, so a theme
// swap re-aliases underneath. Theme-independent by design. Unistyles-safe: plain data only, NO embedded
// TextStyle — the appBar title aliases the `title` step by NAME, so the aod-unistyles-style-token-gotcha
// deep-style flood does not return (§11 typing note). paddingTop composes rt.insets.top at runtime (not
// a token), so it is absent here.

// §3 the app bar: height (above the top safe-area), the pushed-header title step, and the fill + the
// hub variant's 1px bottom border (the pushed variant draws no border).
const appBar = {
  height: 56, // spacing(14)
  paddingX: 16, // spacing(4)
  title: 'title', // aliases type.title (the pushed-header screen title)
  background: 'background', // the bar fills the ambient field
  border: 'border', // the hub variant's 1px bottom border
} as const;

// §3 the shared content region: side padding + the inter-section vertical rhythm (frame is
// spacing(4..5); the content column uses spacing(5), matching the shipped Settings / SignIn).
const screen = {
  paddingX: 20, // spacing(5)
  gap: 16, // spacing(4)
} as const;

// --- AOD-27 §10 editor-scoped token group (design-dashboard-editor.md §10) --------------------------
// The dashboard EDITOR (arrange mode) geometry + role aliases: the AOD-20 §12 / AOD-68 §11 analog for the
// free-form editor. GEOMETRY (numbers) plus ROLE-NAME ALIASES (a semantic colour role, as plain strings),
// never a raw hex — the consumer (PlacedInstance) resolves theme.colors[role] at the draw site, so a theme
// swap re-aliases underneath. Theme-independent by design. Unistyles-safe: plain data only, no embedded
// TextStyle (it does not touch type.*, so the aod-unistyles-style-token-gotcha deep-style flood stays away).
// NOTE the canvas unit is deliberately NOT here: UNIT_PX lives in geometry.ts because it is layout math,
// not a style token (§10 row 2). The two sheets + the switcher compose the AOD-68/AOD-20 sheet/modal
// groups + scrim + elevation.overlay, so they add no token either (§10 rows 3-4).
const arrange = {
  selectBorder: 'accent', // bodyArranging: the selected card's accent border
  selectFill: 'surfaceAlt', // bodyArranging: the selected card's fill (one step up from the resting card)
  handle: { dot: 24, hit: 44, ring: 'background' }, // resize handle: a 24pt accent dot ringed in `background`, inside a 44pt hit target
  configurePill: { bg: 'accent', label: 'onAccent' }, // the top-left Configure pill (§11 drift 3: label -> onAccent, was colors.background)
  // AOD-141 per-widget delete-in-place (resolves AOD-104): the top-right Remove pill flips the tile's OWN
  // face into the in-place "Remove?" confirm (no modal). `error` is the EXISTING destructive role — the
  // Button `destructive` variant already shares it ("Disconnect / Remove") — with an `onAccent` label; this
  // adds NO new colour primitive. `confirm` is the confirm face: a `scrim` backdrop over the dimmed card
  // plus `onAccent` (white) question/keep text legible on it. When AOD-142's Arrange dial restyles the
  // affordance, only these aliases move; the delete plumbing (repo + useRemoveWidget) is final.
  removePill: { bg: 'error', label: 'onAccent' }, // the top-right Remove pill (mirrors configurePill, destructive role)
  confirm: { scrim: 'scrim', label: 'onAccent' }, // the in-place "Remove?" face: scrim over the card + white text; the confirm button reuses removePill
} as const;

// --- AOD-39 §10 kiosk-wall-scoped token group (design-kiosk-wall.md §10) ----------------------------
// The kiosk wall's geometry, the AOD-20 §12 / AOD-68 §11 / AOD-27 §10 analog for the wall-mount profile.
// NUMBERS ONLY (three pixel sizes), no role alias and no embedded TextStyle: the wall composes EXISTING colour
// tokens (colors.background field, night.*/overlay dim, scrim + the §9 sheet vocab for the PIN), so it adds
// no colour. `exitCorner`/`pinKey` size the exit affordance (§7). `padding` is the uniform margin the
// auto-fit content sits inside, so nothing is flush against the screen edge (dogfood polish). Unistyles-safe
// (plain numbers), test-locked. (AOD-81 removed the former fixed `typeScale: 1.4`: the wall now AUTO-FITS the
// layout to the screen minus this padding via the pure viewport.wallFitScale — a fixed scale clipped wide
// layouts on the real, density-scaled device screen. See src/kiosk/viewport.ts.)
const wall = {
  padding: 24, // spacing(6): the uniform wall margin the auto-fit content is inset by
  exitCorner: 56, // spacing(14): the invisible long-press exit hit-target (trailing-bottom corner)
  pinKey: 64, // spacing(16): the PIN-pad key diameter on the exit surface
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
  transit,
  range,
  sparkline,
  money,
  meridian,
  priorityIcon,
  soundings,
  progress,
  ring,
  // AOD-20 §12 component library groups
  button,
  input,
  toggle,
  segmented,
  pill,
  card,
  rowGroup,
  listRow,
  authCard,
  sheet,
  modal,
  popover,
  skeleton: skeletonToken,
  badge,
  lockRow,
  // AOD-68 §11 screen-scoped groups
  appBar,
  screen,
  // AOD-27 §10 editor-scoped group
  arrange,
  // AOD-39 §10 kiosk-wall-scoped group
  wall,
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
    // AOD-20 §3.3 accentMuted: the ONE accent (blue.400 = #6E8BFF = rgb(110,139,255)) at a low fixed alpha.
    // The shared chrome tint (pressed text buttons / selected multi-pills / accent+PRO badges / focus halo);
    // distinct from the per-widget DATA alphas (progress 0.18, sparkline 0.5). rgba, so no new hue.
    accentMuted: 'rgba(110, 139, 255, 0.14)',
  },
  // AOD-120 data-hue families (FROZEN, device-verified AOD-119 GO 2026-07-18): the Signature (1C) mapping
  // — the frozen ramps verbatim. See the block comment above inkDark for why they sit beside `colors`.
  temp: primitive.temp,
  ink: inkDark,
  pane: primitive.pane,
  when,
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
    // AOD-20 §3.3 accentMuted: the ONE accent (blue.600 = #3F5BD6 = rgb(63,91,214)) at a low fixed alpha
    // (a touch lower than dark, for daylight contrast). Same shared-chrome-tint role; rgba, so no new hue.
    accentMuted: 'rgba(63, 91, 214, 0.12)',
  },
  // AOD-120 data-hue families (FROZEN dark-first via AOD-119 GO; light is the UNTUNED mirror of the dark/
  // Signature freeze) — the law is dark-first and wall-first, no light-tuned render exists yet, and no leaf consumes
  // these in light. Only bone re-aliases (to the light text step) so "nothing to say" still draws as
  // plain text. A light re-tune lands as a deliberate re-freeze, never a silent drift.
  temp: primitive.temp,
  ink: inkLight,
  pane: primitive.pane,
  when,
} as const;

// --- AOD-121 Monochrome theme (design-color-law.md §8: "every meaning-role collapses to the white /
// gray ramp. This is today's build.") ---------------------------------------------------------------
// Colour is a THEME AXIS (§8): a theme is only a remap from data-hue ROLES to actual colours, exactly the
// way light/dark already remap `colors`. Monochrome is the SECOND v1 theme (Signature above is the
// default; both ship free, per-service is a post-launch Pro lever, §96). It reuses each scheme's Signature
// sibling VERBATIM and overrides ONLY the four data families temp/ink/pane/when, collapsing every
// meaning-role onto the neutral ramp. The Signature families were the ones on trial at AOD-119 (now FROZEN,
// GO); Monochrome never needed that exam: it derives solely from primitive.neutral, read through
// each theme's own text/textMuted/surface/border roles (themselves neutral aliases), which are shipped-
// frozen. The collapse rule, per §8 "today's build": a data FIGURE draws as bone (the `text` role), its
// explicit dim variant recedes to `textMuted`; the Weather condition PANE loses its sky and becomes the
// ordinary card surface (bg→surface, line→border, ink→text), the clearNight moon drawing as bone (text).
// No Signature hue survives — the byte-lock (__tests__/data-monochrome-tokens.test.ts) proves every value
// is a neutral step and that Monochrome is byte-identical to its sibling but for these four families.
// Same nested SHAPE as the Signature families (plain string maps): the values resolve to literal neutral
// steps HERE, once — no TextStyle in the theme, no computed theme.colors[role] left for a draw site.
type MonochromeSource = { text: string; textMuted: string; surface: string; border: string };

function monochromeFamilies(c: MonochromeSource) {
  const { text, textMuted, surface, border } = c;
  const pane = { bg: surface, line: border, ink: text }; // the sky collapses to the ordinary card surface
  return {
    // the thermometer: no gradient in monochrome — every temperature is the bone hero numeral
    temp: {
      ice: text, cold: text, cool: text, mild: text,
      warm: text, balmy: text, hot: text, swelter: text,
    },
    // the event inks: the figure is bone; only the explicit *Dim variants recede to textMuted
    ink: {
      rain: text, rainDim: textMuted,
      sun: text, sunDim: textMuted,
      moon: text, storm: text, bone: text,
    },
    // the 12 condition panes: identical ordinary card surface; clearNight alone keeps its moon, drawn as bone
    pane: {
      clearFirst: { ...pane }, clearDay: { ...pane }, clearGolden: { ...pane },
      clearNight: { ...pane, moon: text },
      partlyDay: { ...pane }, partlyNight: { ...pane },
      cloudy: { ...pane }, fog: { ...pane }, drizzle: { ...pane },
      rain: { ...pane }, storm: { ...pane }, snow: { ...pane },
    },
    // imminence: no time-to-event colour in monochrome — every event is the bone figure
    when: {
      distant: text, far: text, approaching: text,
      near: text, soon: text, now: text,
    },
  };
}

// The two Monochrome variants: the Signature sibling VERBATIM except the four data families. The spread
// order guarantees colors / night / every sharedTokens group carries through byte-identical (same
// references), so the existing dark/light Signature locks stay green untouched.
export const darkMonochrome = { ...darkTheme, ...monochromeFamilies(darkTheme.colors) } as const;
export const lightMonochrome = { ...lightTheme, ...monochromeFamilies(lightTheme.colors) } as const;

// The palette × scheme registry. `dark` (Signature) stays first so the mock's Object.values(themes).at(0)
// and StyleSheet.configure's initialTheme both still resolve to the Signature default. Exported so the
// AOD-121 helper + the byte-lock can assert the registered keys.
export const appThemes = {
  dark: darkTheme, // Signature (1C) default — roles map to the §4 thermometer + condition hues
  light: lightTheme, // Signature, light scheme
  darkMonochrome, // §8 Monochrome — every meaning-role collapsed onto the neutral ramp (today's build)
  lightMonochrome, // Monochrome, light scheme
};

// The registered theme keys = palette × scheme. The AOD-121 composition helper (src/theme/appearance.ts)
// maps a (palette, scheme) selection onto one of these; kept === keyof UnistylesThemes (they share this
// exact registry, below) so UnistylesRuntime.setTheme accepts a ThemeName with no cast.
export type ThemeName = keyof typeof appThemes;
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
