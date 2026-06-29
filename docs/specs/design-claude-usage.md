# Design: Claude usage widget visuals

> Status: draft for review, 2026-06-29. Tracked by [AOD-36](https://linear.app/thexap/issue/AOD-36) (`type:design`, `area:integrations:claude`, `area:design-system`; milestone I-M2 "Claude usage", project Integrations). The **second and last sibling application** of the shared widget visual system designed in [AOD-37](https://linear.app/thexap/issue/AOD-37) ([`design-widget-system.md`](design-widget-system.md), PR #19), after [AOD-35](https://linear.app/thexap/issue/AOD-35) (Calendar + Weather, [`design-calendar-weather.md`](design-calendar-weather.md), PR #20). It follows the established `type:design` deliverable convention recorded in [`engineering-process.md`](../engineering-process.md): a `design-` doc under `docs/specs/` plus rendered SVG mockups in `docs/specs/assets/`, tokens specified (not written into [`unistyles.ts`](../../apps/app/unistyles.ts)), merged via PR.
>
> **This is an application, not a redesign.** [AOD-37](https://linear.app/thexap/issue/AOD-37) drew the shared language once (the card chrome, the design-token foundation, the six lifecycle-state visuals, the day/night dim and ambient behavior, the on-demand refresh affordance) precisely so the per-widget designs are **applications** of it. [`design-widget-system.md`](design-widget-system.md) §9 already maps what Claude usage reuses versus designs bespoke. This doc honors that map: it **reuses** §3 (tokens), §4 (chrome), §5 (states), §6 (refresh), §7 (dim/ambient) **unchanged**, and designs **only** the bespoke bodies, the two design problems §9 hands to AOD-36: the **spend sparkline / chart** (the meatiest, the parallel to AOD-35's weather icon set) and the **cents-precision money typography** with the run-rate emphasis. Where applying the system surfaced a gap, it is **flagged** (section 9), not silently forked.
>
> **What this fixes, and what it must not touch.** It fixes the **visuals** of the two functional-but-unpolished renderers that shipped ahead of their design (each says so in its header comment, "the sparkline visual polish and the currency typography are a design follow-up"): [`SpendMtdCard`](../../apps/app/src/registry/services/anthropic_usage/SpendMtdCard.tsx), [`DailySpendCard`](../../apps/app/src/registry/services/anthropic_usage/DailySpendCard.tsx). It expresses every value as a **design token** and adds only the **two** genuinely new token groups AOD-36 needs (`money`, `sparkline`), each reusing the existing palette with no new color; it does **not** edit `unistyles.ts` (the polish build does, the way a spec does not write its code). It does **not** change the [AOD-8](https://linear.app/thexap/issue/AOD-8) §6.1 render contract `{ data, config, size }`: the renderers stay pure leaf functions and never learn auth/loading/error, the generic host keeps drawing the chrome. The implementing polish is a **separate I-M2 `type:tech-task`**, the way each integration spec was separate from its build, and the Claude usage backend / Admin-key handling stays [AOD-33](https://linear.app/thexap/issue/AOD-33)'s ([`integration-claude.md`](integration-claude.md)).

## 1. Purpose and scope

I-M2 "Claude usage" shipped one service and two leaf renderers at on-brand-enough fidelity, each deferring its pixel polish to this design ([`integration-claude.md`](integration-claude.md) §10 names "the Claude usage visual design of both cards, the sparkline rendering, the currency formatting, the spend typography" as a design follow-up). [AOD-37](https://linear.app/thexap/issue/AOD-37) drew the shared system and [AOD-35](https://linear.app/thexap/issue/AOD-35) proved it carries a first pair of widgets. This doc applies that same system to the last pair, so the build is "map onto the scale, draw the bespoke body."

It fixes exactly four things:

1. **The spend sparkline / chart** (section 4): the bar treatment, the window-max scale, the today emphasis, the zero/flat/sparse series, and the baseline, as one chart that renders at `wide` and `large`. This is the meatiest design problem here and the one [`design-widget-system.md`](design-widget-system.md) §9 explicitly hands to AOD-36 (the parallel to AOD-35's weather icon set).
2. **The Spend MTD face** (section 5): the value-first money body across `small` and `medium`, the **cents-precision money typography** (the symbol / dollars / cents hierarchy), the **run-rate emphasis** ($/day avg + days this month, derived in the renderer), and the **$0.00 valid-zero state**.
3. **The Daily Spend face** (section 6): the sparkline applied across `wide` (banner) and `large` (square), the MTD-total + series composition, and the **"No spend yet this month" empty body**.
4. **The two new token groups** (section 9): `sparkline` (the chart sizing + opacity) and `money` (the cents-precision scales), each reusing the existing color palette, plus the explicit reuse map that proves the AOD-37 system carries these widgets a second time (the `area:design-system` charge).

**In scope:** the two bespoke bodies (the sparkline and the money figure), the run-rate and zero/empty states, the per-size layouts across the supported sizes, the two new token groups, and the reuse map (section 3).

**Out of scope (named so the frame is clear):**

- **Implementing the polish in code.** A separate I-M2 `type:tech-task` lifts `sparkline` and `money` into [`unistyles.ts`](../../apps/app/unistyles.ts) and applies these visuals to the two renderers. This doc is the design it implements.
- **[AOD-35](https://linear.app/thexap/issue/AOD-35) (Calendar + Weather visuals),** the first sibling application, already merged (PR #20). Its weather icon set and agenda density are its own.
- **Any redesign of the AOD-37 system** (chrome, the six states, the token scale, dim/ambient, the refresh affordance) beyond the one flagged additive gap (section 9.3). If applying the system tempts a chrome or state change, that belongs in AOD-37, not here.
- **The registry / host / layout architecture and the `{ data, config, size }` render contract.** Unchanged. The renderers stay pure leaf functions.
- **The Claude usage backend, the Admin-key handling, the cents-to-dollars conversion, and the data contract** ([`integration-claude.md`](integration-claude.md), [AOD-59](https://linear.app/thexap/issue/AOD-59)): the normalized `SpendMtdData` / `DailySpendData` payloads (already in **major units**, dollars, server-side) are fixed inputs this design renders, not data it reshapes. The client never sees cents.
- **The personal-engine "Claude Limits" (session / weekly) widget** ([AOD-14](https://linear.app/thexap/issue/AOD-14)): a different question (subscription throttle headroom) on a different data path; out of the standard set, and out of this design.
- **Motion** beyond what AOD-37 already named (the loading shimmer, the refresh spin); these bodies are static layouts.

## 2. Locked context this builds on

| Source | What it locks | How this design uses it |
|---|---|---|
| [`design-widget-system.md`](design-widget-system.md) §3 | The token foundation: the color set, the `type.*` scale (incl. `type.xl` 40/700), the night palette, the `overlay` and `dot` tokens. | Sections 4 to 6 reference `type.xl` / `type.title` / `type.meta` / `type.caption` and `colors.*`; this design adds only `sparkline` and `money` (section 9), each reusing those colors. |
| [`design-widget-system.md`](design-widget-system.md) §4 | The shared card chrome: the frame, the quiet `SERVICE · WIDGET` header, the status-and-refresh cluster, the value-first body. | Both faces mount in this chrome unchanged; the mockups show it (the `CLAUDE · SPEND (MTD)` / `CLAUDE · DAILY SPEND` caption, the idle refresh) and the bodies fill only the body zone. The leaf's shipped hand-drawn accent label folds into the host caption (section 3). |
| [`design-widget-system.md`](design-widget-system.md) §5 | The six lifecycle-state visuals (loading, fresh, stale, error, `needs_config`, `disconnected`), drawn by the host. | This design draws **only** the `fresh` body. Claude usage has no `needs_config` edge (zero-config) but **does** have a `disconnected` edge (a revoked Admin key, [`integration-claude.md`](integration-claude.md) §9); both are the host's §5 visuals, not redrawn here. |
| [`design-widget-system.md`](design-widget-system.md) §6 | The on-demand refresh affordance as host chrome (idle / in-flight / within-floor / hidden). | Shown idle in the mockups; not redesigned. Both widgets fetch (`admin_key`), so neither hides it (unlike the Clock). |
| [`design-widget-system.md`](design-widget-system.md) §7 | The day/night dim: the global overlay default (`dimsWithAmbient: true`), the `useAmbient()` opt-in, the deep-red night palette. | Both widgets are **overlay-default** (`dimsWithAmbient: true`, [`index.ts`](../../apps/app/src/registry/services/anthropic_usage/index.ts)); neither opts into deep red (that is the Clock). The overlay darkens the card uniformly at night with no widget code. |
| [`design-widget-system.md`](design-widget-system.md) §9 | The reuse map row: Claude reuses chrome / states / `type.xl` amount + `tabular-nums` / `type.meta` run-rate; designs the **spend sparkline / chart**, the **run-rate emphasis**, and the **cents-precision treatment**. | Section 3 is the realized version of this row; sections 4 to 6 are its bodies. |
| [`integration-claude.md`](integration-claude.md) §4 | The normalized `SpendMtdData` (`amount`, `currency`, `windowStart`, `asOf`, `daysElapsed`) and `DailySpendData` (`days: DailyCost[]`, `currency`, `total`) over a shared `DailyCost` (`date`, `amount`). Amounts are **major units** (dollars), `/100` server-side; `currency` echoed. | Section 5 renders `amount` + the derived `perDay`; section 6 renders `days` as the sparkline and `total` as the anchor. The cents string never reaches the client. |
| [`integration-claude.md`](integration-claude.md) §4.1 / §4.2 | `amount: 0` is a **valid figure**, not an empty state; an empty `days[]` is the normal "no spend yet this month" state. | Section 5.3 renders `$0.00` as the hero (value-first body); section 6.2 renders empty `days[]` as a calm empty body. The two are deliberately different (section 5.3). |
| [AOD-10](https://linear.app/thexap/issue/AOD-10) §5 / [`registry/types.ts`](../../apps/app/src/registry/types.ts) | The canonical size catalogue and the nearest-supported-class reconciliation rule. | Section 8 fixes each widget's `supportedSizes` and the per-size body; the reconciliation rule covers off-aspect rects. |
| The two leaf renderers | The current functional visuals: `SpendMtdCard` (label + amount 40/700 + meta), `DailySpendCard` (label + total 18/700 + accent bars to `SPARK_HEIGHT` 48, empty -> "No spend yet this month"). They take `{ data }` only and never branch on size. | This design maps the ad-hoc sizes onto the `type.*` scale, fixes the bespoke sparkline + money figure, and adds per-size layouts; the build edits the renderers, not the contract. |

What the renderers already do, and what this changes: each card already draws the value-first body the system formalizes (the amount, the daily bars), at an ad-hoc font size, and `DailySpendCard` already draws a proportional bar sparkline and a renderer-drawn empty state. This design (a) maps those sizes onto the AOD-37 `type.*` scale, (b) **folds the leaf's hand-drawn accent label into the host's quiet `SERVICE · WIDGET` caption** (the host owns the header per §4, so the leaf stops drawing "Claude Spend (MTD)" / "Claude Daily Spend"), and (c) fixes the bespoke parts: the sparkline treatment, the money typography, the run-rate, and the empty/zero bodies. It changes the renderers' **appearance**, never their wiring.

## 3. Applying the system: the reuse map

The test of a system is that the sibling designs are applications, not redesigns. They are. Each part of each face is either **reused** from AOD-37 unchanged or a **bespoke** body element designed here. The table makes the seam explicit (this is the `area:design-system` deliverable, the second proof after AOD-35: prove the reuse).

| Widget · part | Reuses from AOD-37 (unchanged) | Bespoke to AOD-36 (designed here) |
|---|---|---|
| **Spend MTD** · value | `type.xl` (40/700) amount, `tabular-nums`, `colors.text` (§3) | The **cents-precision money typography**: the symbol / dollars / cents hierarchy (section 5.1) |
| Spend MTD · label | The quiet `SERVICE · WIDGET` caption header, `type.caption` (§4) | (the shipped leaf's accent label folds into the host caption; nothing bespoke) |
| Spend MTD · run-rate | `type.meta` + `colors.textMuted` (§3) | The **run-rate emphasis**: $/day avg (value in `colors.text`) + days this month (section 5.2) |
| Spend MTD · zero | The value-first body (§4) | The decision that **`$0.00` renders as the hero**, not an empty body (section 5.3) |
| **Daily Spend** · chart | The frame, quiet header, six states (§4, §5) | The **sparkline**: bar treatment, window-max scale, today emphasis, floor, baseline (section 4) |
| Daily Spend · total | `type.title` + `colors.text`, a supporting figure (§3) | The **chart-is-hero / total-supports composition** (section 6.1) |
| Daily Spend · empty | The proposed empty-body convention (AOD-35 §10.2) | Applying it: the "No spend yet this month" calm body (section 6.2) |
| **Both** · chrome | Frame, header, status-and-refresh cluster, value-first hierarchy (§4) | nothing |
| Both · states | loading / fresh / stale / error / `needs_config` / `disconnected` (§5) | nothing (only the `fresh` body is drawn here) |
| Both · refresh | idle / in-flight / within-floor (§6); both fetch, so neither hides it | nothing |
| Both · night | the global **overlay** (`dimsWithAmbient: true`, §7) | nothing (no deep-red opt-in; that is the Clock) |

None of these needs a new card frame, a new state visual, a new dim behavior, or a new color. They consume sections 3 to 7 of [`design-widget-system.md`](design-widget-system.md) and design only the body. The **two** additions are the `sparkline` and `money` token groups (section 9.1, 9.2), the chart's and the figure's sizing, which AOD-37 could not have predicted without designing them; and **one** flagged gap, the shared "empty body" pattern (section 9.3), now on its second design consumer.

## 4. The spend sparkline (the bespoke centerpiece)

Daily Spend's value **is** a chart: a month-to-date series of daily costs, drawn as a sparkline. [`design-widget-system.md`](design-widget-system.md) §9 hands AOD-36 "the spend sparkline / chart"; this section designs it. It is the meatiest problem here, the parallel to AOD-35's weather icon set, and the one place this widget pair earns a real bespoke visual rather than a type-scale remap.

![The Daily Spend sparkline drawn large and annotated: a row of bars, one per day of the month to date, oldest on the left and today on the right. Each bar's height is its day's spend over the window's peak spend. Today's bar is full accent blue while every earlier day recedes to the same accent at about half opacity. A one-pixel baseline grounds the bars and a minimum bar height keeps a zero or tiny day visible as a tick. Two variant strips show an all-zero flat series and a sparse early-month series, and a token panel lists the sparkline sizing and opacity values.](assets/design-claude-sparkline.svg)

<details>
<summary>Design tokens &amp; the chart rule</summary>

```
form        : a vertical bar per daily bucket (the data is discrete daily buckets, so bars, not an area/line).
              Bars draw in colors.accent: the chart IS this widget's one highlighted element (the value),
              the way the calendar's next-event rail spends the single accent once.
scale       : height = day.amount / windowMax * chartHeight, where windowMax is the peak day's spend.
              A relative (window-max) scale, not an absolute dollar axis: a sparkline shows movement, not
              precise magnitude (the MTD total carries magnitude, section 6.1).
today        : the rightmost bar (oldest-first series) is today; drawn at full accent (todayOpacity 1) while
              every earlier day recedes to accent @ pastOpacity 0.5. One accent hue, two intensities, so the
              eye lands on "now" with NO second color (consistent with the §3 one-accent rule).
floor        : minBarHeight 2 -> a zero or sub-pixel day still shows a baseline tick, so a $0 day reads as a
              recorded day, not a gap. An all-zero window (windowMax 0) draws every bar at the floor (flat).
baseline     : a 1px colors.border rule the bars sit on, grounding the chart.
density      : ALL month-to-date days are shown (up to 31). Bars flex to fill the width; there is no
              VISIBLE_BY_SIZE slice (unlike the agenda/forecast), because the whole series IS the point.
token        : sparkline = { chartHeight: { wide 44, large 96 }, barGap 2, barRadius 1, minBarHeight 2,
              todayOpacity 1, pastOpacity 0.5, baseline colors.border } (section 9.1; specified, not coded).
```
</details>

### 4.1 Bars, scaled to the window peak

The series is discrete daily buckets ([`integration-claude.md`](integration-claude.md) §4.0a), so the honest form is **bars**, one per day, not an area or line (which would imply a continuous quantity). Each bar's height is `day.amount / windowMax * chartHeight`, so the tallest bar is the highest-spend day and the rest read relative to it. This is a **relative** scale by design: a sparkline communicates the *shape* of the month (climbing, spiky, flat), while the precise magnitude is the MTD **total** beside it (section 6.1). The bars draw in `colors.accent`: on Daily Spend the chart is the card's value, so it spends the system's single accent, the way the agenda's next-event rail does ([`design-calendar-weather.md`](design-calendar-weather.md) §8.2).

### 4.2 Today is bright, the month recedes behind it

The one emphasis is **today**. The series is oldest-first, so the rightmost bar is the current day; it draws at full `colors.accent` while every earlier day recedes to the same accent at `pastOpacity` 0.5. This is one accent hue at two intensities, so the eye lands on "now" without introducing a second color (the §3 one-accent discipline). Crucially, **today is a partial, still-growing day**, so it is marked by **color, not height**: its bar honestly reflects today's spend-so-far (often low early in the day), and emphasizing it by color avoids the misread that a short bright bar would otherwise invite. This is the parallel to the calendar/forecast "Today is bright, the rest recede" emphasis, applied to a chart.

### 4.3 The floor, the baseline, and the degenerate series

A `minBarHeight` of 2 keeps a **zero or sub-pixel day visible as a baseline tick**, so a `$0` day reads as a recorded-but-zero day, not a gap in the data. The bars sit on a 1px `colors.border` **baseline** that grounds the chart. The mockup's variant strips fix the degenerate cases the renderer already guards: an **all-zero window** (`windowMax` 0) draws every bar at the floor (a quiet flat line, never a divide-by-zero, the renderer's existing guard), and a **sparse early-month series** (one to three days) draws those few bars left-anchored with today still the bright one. The fully **empty** series (`days: []`) is not a flat chart at all but a calm empty body, designed with the Daily Spend face (section 6.2).

## 5. Spend MTD face

Spend MTD is the headline glance: the month-to-date total as one number. `supportedSizes: ['small', 'medium']`, default `small` ([`integration-claude.md`](integration-claude.md) §4.1). There is no empty state: a connected org always has a total, and `$0.00` is a valid one (section 5.3).

![The Spend MTD card. At the top an enlarged month-to-date figure shows the three-tier money typography: a reduced raised currency symbol, the dollars at the extra-large type step in tabular figures, and the cents at a reduced muted size. Below, the face at small, at medium with a run-rate line, and the valid zero-dollar state, with a token panel for the money group and a note on the run-rate derivation.](assets/design-claude-spend-mtd.svg)

<details>
<summary>Design tokens &amp; per-size layout</summary>

```
amount      : type.xl (40/700) dollars, tabular-nums, colors.text. The hero, the one glanceable value.
              money typography (section 5.1): $ at money.symbolScale 0.62 raised + colors.text; cents at
              money.fractionScale 0.62 + colors.textMuted, baseline-aligned. Echoed currency: USD -> "$",
              else the numerals are identical and the currency CODE trails as a muted type.meta suffix.
run-rate    : "$X.XX/day avg  ·  N days this month", type.meta (13). The $/day VALUE in colors.text
              (a small bright stat), the rest in colors.textMuted. perDay = amount / daysElapsed, derived
              in the renderer with no extra request (§4.1). The emphasized derived figure.
zero        : amount 0 -> "$0.00" as the hero (the normal value-first body), with the normal run-rate.
              A VALID figure, NOT the empty body Daily Spend uses (section 5.3).
small (1×1) : caption + amount; NO run-rate (no room). The caption STAYS rather than suppressing (money is
              not self-evident like a clock), a deliberate non-use of the §4.2 suppress hint; how the
              SERVICE · WIDGET string compacts to fit 1×1 (shown as "SPEND · MTD") is a host header detail.
medium (2×1): quiet "CLAUDE · SPEND (MTD)" caption + status/refresh cluster; amount; run-rate line below.
```
</details>

### 5.1 The cents-precision money typography

The amount is the value, and a money value has an internal hierarchy: the **dollars are the magnitude you glance at**, the cents are precision that should not compete. So the figure is drawn in three tiers within one value:

- **Dollars**: `type.xl` (40/700), `tabular-nums`, `colors.text`, with thousands separators. The magnitude that dominates; `tabular-nums` so a refresh does not shift its width.
- **Currency symbol** (`$`): reduced to `money.symbolScale` (0.62) and raised toward the cap height, in `colors.text`. Present but quiet; the magnitude, not the symbol, is the glance.
- **Cents** (`.XX`): reduced to `money.fractionScale` (0.62) and dropped to `colors.textMuted`, **baseline-aligned** with the dollars. Legible precision that recedes.

The cents are deliberately **baseline-aligned, not raised** into a superscript: a raised superscript reads as a retail price tag, where this is a calm ambient figure, so the reduced muted cents sit on the dollars' baseline and read as one quiet number. This is the within-value version of the system's "the value dominates, the chrome recedes" rule ([`design-widget-system.md`](design-widget-system.md) §3): here the magnitude dominates and the precision recedes, all inside the single hero. **Currency is echoed** from the payload: `USD` renders the `$` symbol; any other currency keeps the identical numeral treatment and trails the currency **code** as a muted `type.meta` suffix (e.g. `1,234.56 EUR`), so a non-USD org needs no redesign, only the echoed string (matching the renderer's shipped `formatMoney`).

### 5.2 The run-rate emphasis

The payload carries `daysElapsed`, so the renderer derives a **run-rate** with no extra request: `perDay = amount / daysElapsed` ([`integration-claude.md`](integration-claude.md) §4.1). This is the emphasized derived figure, the meta line below the amount: **"$X.XX/day avg · N days this month"** in `type.meta`, with the **$/day value in `colors.text`** (a small bright stat) and the label plus day count in `colors.textMuted`. The size (`type.meta` 13 against the `type.xl` 40 hero) keeps the run-rate firmly subordinate; the brightness of its value just marks it as the one figure in the meta worth reading, the same value-against-muted move the calendar's "when" line makes with accent. A month-end **projection** (`perDay * daysInMonth`) is the natural alternative the same payload affords and is named as a seam (section 10), not drawn; v1 leads with the run-rate the task and the shipped renderer fix.

### 5.3 The $0.00 valid-zero state (not an empty body)

This is the design judgment the spec asks for. `amount: 0` is a **valid figure**, not an empty state ([`integration-claude.md`](integration-claude.md) §4.1): a connected org early in the month has genuinely spent `$0.00`. So Spend MTD renders zero as the **normal value-first body**, the hero reading `$0.00` (same three-tier money typography, the cents reading `.00`) with the normal run-rate line (`$0.00/day avg · N days`). It is **not** drawn as the calm centered empty body Daily Spend uses for `days: []` (section 6.2). The distinction is the point, and it is a real semantic difference: Spend MTD's zero is a **known total that happens to be zero** (a value), while Daily Spend's empty `days[]` is **no series to draw** (an absence). Same "the data is quiet" situation, two correct renderings, because the data means different things. Drawing `$0.00` as an empty body would wrongly imply something is missing; drawing it as the hero says, correctly, "your spend this month is zero."

## 6. Daily Spend face

Daily Spend is the chart card: the daily series as a sparkline. `supportedSizes: ['wide', 'large']`, default `wide` ([`integration-claude.md`](integration-claude.md) §4.2). The same `DailySpendData.days` renders as two layouts, and on this widget **the chart is the hero and the total supports it**, the inverse of Spend MTD.

![The Daily Spend card at wide as a banner with the month-to-date total on the left and the sparkline filling the right, and at large as a square with a more prominent total, a taller sparkline with the today bar labelled with its value, and oldest-to-today axis endpoints. A third card shows the empty state: a calm centred flat-chart glyph with a muted No spend yet this month line and a quiet subline, with a panel noting it is the second consumer of the AOD-35 empty-body convention.](assets/design-claude-daily-spend.svg)

<details>
<summary>Design tokens &amp; per-size layout</summary>

```
total       : the MTD total, type.title (18/600, mapping the shipped 18/700), tabular-nums, colors.text, with the section 5.1 money
              treatment at a smaller step. A SUPPORTING anchor (equals SpendMtdData.amount over the same
              window), not the hero; under it a quiet "MONTH TO DATE" type.caption qualifier.
chart       : the section 4 sparkline. sparkline.chartHeight wide 44 / large 96; today bright, past @ 0.5.
wide (3×1)  : banner. caption header + cluster on top; the total on the LEFT; the sparkline filling the
              RIGHT as a horizontal strip; "Jun 1 ... Today" axis endpoints under it.
large (2×2) : square. caption header + cluster; a more prominent total; a TALLER sparkline filling the card;
              the today bar labelled with its value ("today $1.90", a large-only affordance); axis endpoints.
empty       : days[] empty -> renderer draws a calm centred flat-chart glyph (accent, the chart's own
              language) + "No spend yet this month" (type.body, colors.textMuted) + a quiet subline.
              A renderer-drawn empty body, NOT a host state; NO action (section 6.2, section 9.3).
```
</details>

### 6.1 The chart is the hero, the total supports it

On Spend MTD the number is the hero; on Daily Spend the **chart** is, so the composition inverts. The sparkline (section 4) is the largest, brightest element, and the **MTD total** is a supporting anchor in `type.title` (`colors.text`, `tabular-nums`), with a quiet "MONTH TO DATE" `type.caption` qualifier beneath it. The total is `DailySpendData.total`, which equals `SpendMtdData.amount` over the same window ([`integration-claude.md`](integration-claude.md) §4.2), so the two Claude widgets are coherent side by side: the same dollar figure, once as a headline (Spend MTD) and once as the anchor of its accumulation (Daily Spend). At **wide** (a 3×1 banner) the total sits on the left and the sparkline fills the right as a horizontal strip. At **large** (a 2×2 square) the total is a touch more prominent, the sparkline is taller (`chartHeight` 96 vs 44) and fills the card, and the roomier size affords a small **today value label** ("today $1.90") over the today bar, the one numeric annotation the sparkline carries. Both sizes show the oldest-to-today axis endpoints so the direction reads.

### 6.2 The empty body

The **empty** state (`days: []`, the normal "no spend yet this month" result, not an error) is drawn by the renderer as a **calm centered body**: a quiet flat-chart glyph (a flat baseline with a few floor ticks, in the chart's own accent, so the empty state speaks the widget's visual language), a `type.body` `colors.textMuted` line reading "No spend yet this month", and a quiet subline ("Costs appear as you use the API"). It carries **no action**, because nothing is wrong: an org simply has not spent yet this month. Because this fresh-but-empty body is renderer-drawn and AOD-37 §5 only specifies the host's six states, it is the seam that lands on the section 9.3 gap, now for the second time across the sibling designs.

## 7. Night, refresh, and the rest of the chrome (reused, not redrawn)

Both widgets reuse the AOD-37 chrome and behaviors unchanged, so this section only confirms the reuse (the mockups draw it; nothing here is bespoke):

- **Night / dim.** Both are `dimsWithAmbient: true` ([`index.ts`](../../apps/app/src/registry/services/anthropic_usage/index.ts)), so they take the **global overlay** ([`design-widget-system.md`](design-widget-system.md) §7.1): at night the host paints the dim overlay over the whole card uniformly, no widget code. Neither opts into the deep-red `useAmbient()` palette (that is the Clock's iconic night look, §7.3). The accent sparkline and the money figure simply darken with the card.
- **Refresh.** The idle refresh control sits in the header cluster ([`design-widget-system.md`](design-widget-system.md) §6); both widgets fetch (`admin_key`), so neither hides it (unlike the Clock). The mockups show it idle.
- **States.** The host draws all six lifecycle states (§5). Claude usage has **no `needs_config`** edge (zero-config, no `remote-options` field) but **does** have a `disconnected` edge: a revoked Admin key returns `401 -> reauth_required -> 409`, which the host renders as the `disconnected` reconnect prompt ([`integration-claude.md`](integration-claude.md) §9). Both are the host's §5 visuals; this design does not redraw them, exactly as AOD-35 did not.

## 8. Sizes and reconciliation

Each widget draws only the size classes it declares; the [AOD-10](https://linear.app/thexap/issue/AOD-10) §5 reconciliation rule maps a free-form rect to the nearest supported class, and the renderer fills that class's layout.

| Widget | `supportedSizes` | Default | Bodies designed here |
|---|---|---|---|
| Spend MTD | `small`, `medium` | `small` | section 5 (both) |
| Daily Spend | `wide`, `large` | `wide` | section 6 (both) |

Unlike AOD-35's Agenda (whose renderer counted a `large` class outside its declared sizes), neither Claude renderer branches on size at all today (`SpendMtdCard` and `DailySpendCard` take `{ data }` only), so there is no defensive out-of-`supportedSizes` class to design: the polish build adds size-awareness and fills exactly the two declared layouts per widget. The reconciliation rule covers any off-aspect rect by mapping it to the nearer of the two declared classes, and each face's body is defined for both, so a reconciled rect always has a layout to draw. No size-promotion question arises here (both widgets' declared sizes match [`integration-claude.md`](integration-claude.md) §4.1, §4.2).

## 9. New tokens and the flagged gap

### 9.1 The `sparkline` token group

The chart needs sizing and an intensity rule; everything else reuses [`design-widget-system.md`](design-widget-system.md) §3. Specified as an addition to [`unistyles.ts`](../../apps/app/unistyles.ts) for the polish build (not written here, per the convention):

```typescript
// Daily Spend sparkline (section 4). Bars draw in colors.accent; this group is sizing + intensity only.
sparkline: {
  chartHeight: { wide: 44, large: 96 }, // the tallest bar per size; the rest scale to the window max
  barGap: 2,           // px between bars (bars flex to fill the width)
  barRadius: 1,        // the bar corner
  minBarHeight: 2,     // a zero / tiny day still shows a baseline tick (a $0 day is not a gap)
  todayOpacity: 1,     // today's bar at full colors.accent
  pastOpacity: 0.5,    // earlier days recede to the same accent at half intensity
  baseline: 'border',  // the 1px floor the bars sit on, colors.border
}
```

It composes with the existing scale exactly as `weatherIcon` did in AOD-35 (a per-context sizing group for one widget family). **No color token is added:** the bars use `colors.accent` at two opacities, the baseline uses `colors.border` (section 4).

### 9.2 The `money` token group

The cents-precision figure needs its within-value scales; the colors reuse §3. Specified, not coded:

```typescript
// Spend MTD money typography (section 5.1). Scales relative to the type.xl dollars; colors reuse §3.
money: {
  symbolScale: 0.62,         // the currency symbol ($) vs the integer dollars; raised toward cap height
  fractionScale: 0.62,       // the .XX cents vs the integer dollars; baseline-aligned
  fractionColor: 'textMuted',// cents recede to colors.textMuted (a within-value precision tier)
}
```

Like `sparkline`, it adds **no color**: the dollars and symbol use `colors.text`, the cents use `colors.textMuted`. It is the money analogue of `weatherIcon`, a small sizing/intensity group AOD-37 could not have predicted without designing the figure.

### 9.3 Flagged gap: the shared "empty body" pattern is now on its second consumer

[AOD-35](https://linear.app/thexap/issue/AOD-35) surfaced a genuine AOD-37 gap and flagged it ([`design-calendar-weather.md`](design-calendar-weather.md) §10.2): **AOD-37 §5 specifies the six host-drawn states but has no visual for a fresh-but-empty body**, a `fresh` render whose data legitimately says "nothing." AOD-35 drew two such bodies to a proposed convention (Next Event's "Nothing next", Agenda's "Nothing left today") and named Linear's "no active cycle" as a third renderer that hits it.

**AOD-36 is now the second design to hit the same gap**, with Daily Spend's "No spend yet this month" (`days: []`, section 6.2). It applies the AOD-35 convention exactly: a **centered, calm body**, a quiet glyph (here a flat-chart line in accent), a `type.body` `colors.textMuted` line, and an optional quieter subline, with **no action** (distinct from the host's `error` / `needs_config` prompts, which carry an action, because nothing is wrong). This design does **not** silently fork it; it reuses the same shape.

Two sibling applications now independently need this body (AOD-35: Next Event, Agenda; AOD-36: Daily Spend), plus the named Linear case, so the pattern is **proven across services and widget kinds**. **Recommendation: promote it into AOD-37** as a tiny additive follow-up, a seventh, renderer-drawn body convention named in [`design-widget-system.md`](design-widget-system.md) §5 alongside the six host states, so Next Event, Agenda, Daily Spend, and Linear share one definition rather than three drifting copies. It is additive (no existing token or state changes), small (one short subsection), and now has the two-consumer evidence AOD-35 said would justify it. This design flags the promotion (it does not edit AOD-37, which is out of scope here); until it lands, the AOD-35 convention is the local target and these empties are drawn to it. **Important contrast:** Spend MTD's `$0.00` is **not** a consumer of this pattern, it is a valid value rendered as the hero (section 5.3); only Daily Spend's empty `days[]` is.

No other gap surfaced. The chrome, the six states, the type scale, the dim/ambient behavior, and the refresh affordance all carried Claude usage unchanged, the second reuse proof this design exists to give.

## 10. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| The **polish build** (lift `sparkline` + `money` into [`unistyles.ts`](../../apps/app/unistyles.ts); apply these visuals + per-size layouts to the two renderers) | I-M2 `type:tech-task` | This doc fixes the visuals and the tokens; the build implements them. |
| The **shared "empty body" pattern** promotion (now two consumers) | tiny [AOD-37](https://linear.app/thexap/issue/AOD-37) follow-up | Flagged and recommended (section 9.3); the convention is drawn here and in AOD-35; the system addition is additive and small. |
| A **month-end projection** on Spend MTD (`perDay * daysInMonth`) | future | v1 leads with the run-rate ($/day avg + days); the same payload affords a projection with no extra request. Additive (section 5.2). |
| A **`vs-prior-month` trend** on Spend MTD | future ([`integration-claude.md`](integration-claude.md) §10) | A literal prior-month delta needs a second window/call; out of this design and the data contract. |
| A **per-workspace / per-model breakdown** (a grouped chart) | future ([`integration-claude.md`](integration-claude.md) §5.3, §10) | v1 is org-wide and zero-config; a breakdown would add a config field and a grouped chart variant, additive to this sparkline. |
| **Motion** (the loading shimmer, the refresh spin, a bar-grow on refresh) | I-M2 build | Named by AOD-37 §10; these bodies are static layouts and add no new motion (a bar-grow animation is a build flourish, not specified). |
| An **area / line sparkline** style, or **per-bar value labels** beyond today | future | v1 is bars with a single today label by deliberate discipline (sections 4.1, 6.1); a richer chart is additive and would extend the `sparkline` token. |
| **Imperial / locale number formatting** (separators, currency placement) | future | Currency is echoed from the payload (section 5.1); locale-aware grouping is a build/formatting concern, not this layout. |

## 11. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. The design is an **application** of [`design-widget-system.md`](design-widget-system.md): section 3's reuse map shows every part of every face either reuses §3 to §7 unchanged or is a named bespoke body, and no chrome, state, token scale, dim behavior, or refresh affordance is redrawn (the second `area:design-system` proof, after AOD-35).
> 2. The **spend sparkline** is fixed: bars per daily bucket in `colors.accent`, scaled to the window max, with the **today emphasis** (full accent vs `pastOpacity` 0.5), the `minBarHeight` floor, the `colors.border` baseline, all month-to-date days shown (no slice), and the flat / sparse degenerate series, with the `sparkline` token specified, not coded.
> 3. The **Spend MTD** face is fixed across `small` / `medium`: the **cents-precision money typography** (`type.xl` dollars, reduced raised `$`, reduced muted baseline-aligned cents), the **run-rate emphasis** (`$/day avg` value in `colors.text` + days this month in `colors.textMuted`, derived in the renderer), the echoed-currency rule, and the **`$0.00` valid-zero state rendered as the hero, not an empty body**, with the `money` token specified.
> 4. The **Daily Spend** face is fixed across `wide` (banner) and `large` (square): the chart-is-hero / total-supports composition, the `type.title` MTD anchor, the today value label at large, and the renderer-drawn **"No spend yet this month" empty body**.
> 5. The system is **reusable a second time**: applying it surfaced exactly two new token groups (`sparkline`, `money`), each reusing the existing palette with no new color, and one flagged additive gap (the shared empty-body pattern, now on its second consumer, recommended for promotion into AOD-37), with no fork of AOD-37, and the **three mockups render**.

| Acceptance clause | Where |
|---|---|
| Application not redesign: the reuse map | Section 3 |
| Spend sparkline + today emphasis + scale + floor + degenerate series + `sparkline` token | Section 4; `design-claude-sparkline.svg`; section 9.1 |
| Spend MTD face (money typography; run-rate; $0.00 valid-zero) + `money` token | Section 5; `design-claude-spend-mtd.svg`; section 9.2 |
| Daily Spend face (wide banner, large square; composition; empty body) | Section 6; `design-claude-daily-spend.svg` |
| Night / refresh / states reused, not redrawn | Section 7 |
| Sizes + reconciliation | Section 8 |
| New tokens; the flagged empty-body gap (second consumer, promotion recommended); seams; acceptance | Sections 9, 10, 11 |

## 12. References

- [AOD-36](https://linear.app/thexap/issue/AOD-36): this design's tracking issue (`type:design`).
- [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)): the shared widget visual system this applies. §3 (tokens, incl. `type.xl`), §4 (chrome), §5 (states), §6 (refresh), §7 (dim/ambient), §9 (the Claude reuse row this realizes).
- [`design-calendar-weather.md`](design-calendar-weather.md) ([AOD-35](https://linear.app/thexap/issue/AOD-35)): the first sibling application, this design's structural template; §3 (the reuse map) and §10.2 (the empty-body gap this design is the second consumer of).
- [`integration-claude.md`](integration-claude.md) ([AOD-33](https://linear.app/thexap/issue/AOD-33)): the Claude usage data contract. §4 (the normalized `SpendMtdData` / `DailySpendData` over `DailyCost`, major-unit amounts, echoed currency), §4.1 ($0.00 valid), §4.2 (empty `days[]`), §9 (the lifecycle, incl. the reauth / disconnected edge), §10 (the visual seam handed here).
- [AOD-8](https://linear.app/thexap/issue/AOD-8): the render contract `{ data, config, size }` (§6.1) this preserves. [`architecture-registry.md`](architecture-registry.md).
- [AOD-10](https://linear.app/thexap/issue/AOD-10): the widget model. §5 (the size catalogue and reconciliation rule). [`widget-model.md`](widget-model.md).
- [AOD-4](https://linear.app/thexap/issue/AOD-4): the v1 widget set (Claude usage = Spend MTD + Daily Spend Sparkline on an `admin_key`).
- [AOD-14](https://linear.app/thexap/issue/AOD-14): the personal-engine "Claude Limits" widget; the explicit out-of-scope boundary.
- The two leaf renderers polished here: [`SpendMtdCard.tsx`](../../apps/app/src/registry/services/anthropic_usage/SpendMtdCard.tsx), [`DailySpendCard.tsx`](../../apps/app/src/registry/services/anthropic_usage/DailySpendCard.tsx); the types [`types.ts`](../../apps/app/src/registry/services/anthropic_usage/types.ts); the definitions [`index.ts`](../../apps/app/src/registry/services/anthropic_usage/index.ts); the host [`WidgetHostView.tsx`](../../apps/app/src/host/WidgetHostView.tsx); the theme [`unistyles.ts`](../../apps/app/unistyles.ts).
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
