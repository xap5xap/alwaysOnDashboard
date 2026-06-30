# Design: Vela dashboard + free-form layout editor

> Status: draft for review, 2026-06-30. Tracked by [AOD-27](https://linear.app/thexap/issue/AOD-27) (`type:design`, `area:layout` + `area:app`; milestone PS-M2 "App shell", project Platform & App Shell). The **flagship core-screen design**: the dashboard interior that fills the app shell. It follows the `type:design` deliverable convention in [`engineering-process.md`](../engineering-process.md): a `design-` doc under `docs/specs/` plus rendered SVG mockups in `docs/specs/assets/`, screen-scoped tokens **specified** (not written into [`unistyles.ts`](../../apps/app/unistyles.ts)), merged via PR.
>
> **It supersedes the issue's original "Produce (Figma) ... using DS-4 components" wording.** AOD-27 was written before [AOD-37](https://linear.app/thexap/issue/AOD-37) set the repo's `type:design` convention (a `design-` doc + rendered SVGs in-repo, not a Figma file). This deliverable follows that established convention, the same medium supersession [AOD-37](https://linear.app/thexap/issue/AOD-37) / [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-17](https://linear.app/thexap/issue/AOD-17) / [AOD-21](https://linear.app/thexap/issue/AOD-21) used. The "DS-4 components" the issue names are the [AOD-20](https://linear.app/thexap/issue/AOD-20) component library ([`design-component-library.md`](design-component-library.md)). No scope change, only the medium.
>
> **It is an application of the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell, not a redesign of it.** [`design-core-navigation.md`](design-core-navigation.md) ([AOD-21](https://linear.app/thexap/issue/AOD-21)) designed the shared navigation **shell** once and explicitly handed the dashboard's **interior** here: §5 fixed the dashboard **frame** (the hub header, the `elevation.base` canvas where widget cards mount, the dashboards-switcher entry) and deferred the free-form editor to AOD-27; §7 fixed the **presentation** of the widget picker and the per-instance config sheets (scrim + `elevation.overlay` + grabber) and deferred their **interiors** here. This design fills that canvas. It is the exact relationship the per-widget designs ([AOD-35](https://linear.app/thexap/issue/AOD-35) / [AOD-36](https://linear.app/thexap/issue/AOD-36) / [AOD-30](https://linear.app/thexap/issue/AOD-30)) have to [`design-widget-system.md`](design-widget-system.md).
>
> **What this fixes, and what it must not touch.** It fixes **visuals only**: the dashboard view, the arrange / edit mode and its drag / resize affordances, the empty state, the add-widget picker interior, the per-instance config sheet interior, and the dashboards switcher interior, each expressed as a composition of the [AOD-20](https://linear.app/thexap/issue/AOD-20) components, the [AOD-37](https://linear.app/thexap/issue/AOD-37) widget card chrome, and the coded tokens, laid out inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell. It does **not** edit [`unistyles.ts`](../../apps/app/unistyles.ts), does **not** write screen or layout-engine code, and does **not** re-open the IA ([AOD-17](https://linear.app/thexap/issue/AOD-17)), the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)), the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18)), the shell ([AOD-21](https://linear.app/thexap/issue/AOD-21)), the components ([AOD-20](https://linear.app/thexap/issue/AOD-20)), or the cards ([AOD-37](https://linear.app/thexap/issue/AOD-37)). Where the editor needs a value the theme does not name, it is **flagged as an editor-scoped token addition** (section 10), the way [AOD-21](https://linear.app/thexap/issue/AOD-21) / [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-37](https://linear.app/thexap/issue/AOD-37) flagged theirs; the build adds it later.
>
> **Design FOR what already exists.** The free-form layout engine ([AOD-7](https://linear.app/thexap/issue/AOD-7)) is **built in code**. The app already renders the dashboard, arrange mode (long-press, drag, corner-handle resize, Done), the picker, and the config sheet, functionally but unpolished. This design **canonicalizes** what those surfaces do ([`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx), [`LayoutCanvas.tsx`](../../apps/app/src/layout/LayoutCanvas.tsx), [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx), [`WidgetPicker.tsx`](../../apps/app/src/layout/WidgetPicker.tsx), [`ConfigureInstanceModal.tsx`](../../apps/app/src/layout/ConfigureInstanceModal.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx), [`useDashboard.ts`](../../apps/app/src/layout/useDashboard.ts)) and flags every extension **additively** (section 11), not a greenfield redraw.

## 1. Purpose and scope

[`app-ia.md`](app-ia.md) (the IA) fixed where the dashboard, the widget picker, the per-instance config, and the dashboards switcher live and how each is reached. [`design-core-navigation.md`](design-core-navigation.md) (the shell) fixed the frame around them. This design lays out the **interior** of that frame: how widget instances sit on the canvas, how a user arranges them, how a dashboard starts empty, and how the two sheets and the switcher look inside.

It is to the dashboard frame what the per-widget designs are to the widget system: an **application** of a fixed shell, composing the [AOD-20](https://linear.app/thexap/issue/AOD-20) components and reusing the [AOD-37](https://linear.app/thexap/issue/AOD-37) cards, not an invention of new chrome.

It fixes exactly six things:

1. **The dashboard view** (section 3): widget instances placed free-form on the `elevation.base` canvas, each reusing the [AOD-37](https://linear.app/thexap/issue/AOD-37) card chrome, plus the free-form coordinate model the engine already uses (nominal units rendered at `UNIT_PX`).
2. **The arrange / edit mode** (section 4): the long-press entry, the selection treatment, the drag-to-move and corner-handle resize affordances, the Configure pill, and the Done / tap-empty exit, with the gesture-end commit path.
3. **The empty state** (section 5): the calm add-your-first-widget CTA that the empty dashboard shows, the layout [`app-ia.md`](app-ia.md) / [AOD-21](https://linear.app/thexap/issue/AOD-21) §8 deferred here.
4. **The add-widget picker interior** (section 6): the `addableWidgets` list grouped by service inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet, the configure-on-add path, and the picker states.
5. **The per-instance config sheet interior** (section 7): the generic `ConfigForm`, one input per schema field kind composed from the [AOD-20](https://linear.app/thexap/issue/AOD-20) controls, reached from three entry points.
6. **The dashboards switcher interior** (section 8): the dashboards list inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 modal route, the active-selection mark, and the New-dashboard create gate.

Plus the cross-cutting handoffs: the ownership overlap with [AOD-28](https://linear.app/thexap/issue/AOD-28) (section 9), the editor-scoped token additions (section 10), the reconciliation with the shipped surfaces (section 11), and the seams to the build and the sibling designs (section 12).

**In scope:** the dashboard interior (the six areas above), each as a visual + interaction contract expressed as a composition of the [AOD-20](https://linear.app/thexap/issue/AOD-20) components, the [AOD-37](https://linear.app/thexap/issue/AOD-37) cards, and the coded tokens, laid out inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell, plus the additions handed to the build (section 10).

**Out of scope (named so the frame is clear):**

- **The nav shell / global chrome**: the hub header, the `elevation.base` canvas field, the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet / modal **presentation** chrome, and the [AOD-21](https://linear.app/thexap/issue/AOD-21) §8 screen-level state visuals ([AOD-21](https://linear.app/thexap/issue/AOD-21), Done). This design lays out **inside** that frame; it does not redraw it.
- **The widget card visual system + lifecycle + empty body** ([AOD-37](https://linear.app/thexap/issue/AOD-37), Done): the cards on the canvas **reuse** the card chrome, the six lifecycle states, and the §5.1 empty body unchanged. Not restyled here.
- **The component library** ([AOD-20](https://linear.app/thexap/issue/AOD-20), Done): the picker rows, the config controls, the sheets, the buttons, and the lock / PRO overlay are **composed**, not redesigned.
- **The settings + connections surface, including the service credential form** ([AOD-28](https://linear.app/thexap/issue/AOD-28)): this design owns the widget-**instance** config sheet; AOD-28 owns the service **credential** form (the overlap is resolved in section 9).
- **Onboarding and the full paywall layout** ([AOD-29](https://linear.app/thexap/issue/AOD-29)), and **the kiosk wall** ([AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11)).
- **Re-deciding** the IA / nav model ([AOD-17](https://linear.app/thexap/issue/AOD-17)), the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)), the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18)), or the shell ([AOD-21](https://linear.app/thexap/issue/AOD-21)).
- **Writing screen / engine code**: a future `type:tech-task` polishes the shipped surfaces to this design.

## 2. Locked context this builds on

| Source | What it locks | How this design uses it |
|---|---|---|
| [`design-core-navigation.md`](design-core-navigation.md) ([AOD-21](https://linear.app/thexap/issue/AOD-21)) | The **app shell**: the hub header (§3, §5), the `elevation.base` canvas, the §7 presentation chrome (pushed / modal route / in-screen sheet, all `scrim` + `elevation.overlay` + grabber), and the §8 screen-level states. | This design lays out the canvas **interior** and reuses the §7 chrome verbatim for the picker, the config sheet, and the switcher. No new chrome. |
| [`app-ia.md`](app-ia.md) ([AOD-17](https://linear.app/thexap/issue/AOD-17)) | The **surfaces** and their presentation: Dashboard (§5 row 3, pushed home), Widget picker (row 4, sheet), Per-instance config (row 5, sheet), Create / switch dashboard (row 6, modal route); the §4.4 presentation rule; the §6.2 hub; the §10 multi-dashboard seam. | Sections 3 to 8 lay out exactly the surfaces it assigns AOD-27, with the presentation it fixes. No new surface, no re-presented one. |
| [`design-component-library.md`](design-component-library.md) ([AOD-20](https://linear.app/thexap/issue/AOD-20)) | Buttons (§5), inputs (§6), toggles / segmented / pills (§7), the row-group and list row (§8), sheets / modals (§9), badges (§10), and the lock / PRO overlay (§11), all theming against the coded roles. | The empty CTA, the picker rows, the config controls, the switcher rows, and the create-gate lock row **compose** these. Not redesigned. |
| [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)) | The widget **card chrome** (§4), the six lifecycle states (§5), and the empty body (§5.1). | The cards on the canvas (section 3) **reuse** the chrome unchanged; the host `needs_config` prompt is one of the three config-sheet entries (section 7). |
| [`unistyles.ts`](../../apps/app/unistyles.ts) ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)) | The **coded tokens**: the semantic `colors.*` roles, the `elevation` ladder, `scrim` / `onAccent` / `focusRing`, `radius.full`, and the `type` / `spacing` scales. | Every value is a role reference; section 10 adds only the editor geometry the theme does not name (`arrange`). |
| [`design-brand.md`](design-brand.md) ([AOD-18](https://linear.app/thexap/issue/AOD-18)) | The **one-accent rule**, the dark-first ambient surface, the calm voice. | One accent on every surface; the empty CTA and the prompts follow the calm voice; the dashboard reads as "looked at, not interacted with". |
| [`apps/app/src/entitlements/Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx) ([AOD-12](https://linear.app/thexap/issue/AOD-12)) | The **UX-only gate**: `children` when entitled, `fallback` otherwise; the server still refuses an over-limit request. | The switcher's New-dashboard create gate (section 8) **is** the `Gate` fallback (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 lock row), routing to the paywall, never an enabled control. |
| The shipped engine + screens ([`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx), [`LayoutCanvas.tsx`](../../apps/app/src/layout/LayoutCanvas.tsx), [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx), [`geometry.ts`](../../apps/app/src/layout/geometry.ts), [`WidgetPicker.tsx`](../../apps/app/src/layout/WidgetPicker.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx), [`useDashboard.ts`](../../apps/app/src/layout/useDashboard.ts), [`registry.ts`](../../apps/app/src/registry/registry.ts)) | The **functional-but-unpolished** free-form engine ([AOD-7](https://linear.app/thexap/issue/AOD-7)), the picker, the config form, and the registry seam ([AOD-8](https://linear.app/thexap/issue/AOD-8)). | This design **canonicalizes** what they do (section 11) and designs for them; it flags every extension additively, not a greenfield redraw. |
| [`engineering-process.md`](../engineering-process.md) | The `type:design` deliverable convention and the chain decision -> spec -> design -> tech-task. | This deliverable follows it; sections 10 to 12 hand the build to a `type:tech-task`. |

What is already true, and what this adds: the app already **renders** the dashboard, drags and resizes widgets, picks new ones, and configures them, themed against the Unistyles theme. This design does not invent those surfaces. It **names the interior contract** they share, canonicalizes the drift the unpolished surfaces carry (the inline sign out and email in the header, the hardcoded `rgba` backdrops, the `background` sheet fills, the native `Switch`, the `colors.background`-on-accent labels), and writes the dashboard interior down once as the contract the build and the sibling designs reference.

## 3. The dashboard view (the placed canvas)

The Dashboard is the hub ([`app-ia.md`](app-ia.md) §6.2) and the product's reason to exist: an ambient surface you glance at. This section fixes how widget instances sit on it. The frame is the [AOD-21](https://linear.app/thexap/issue/AOD-21) §5 dashboard frame (the hub header over the `elevation.base` canvas); the **interior** is a set of [AOD-37](https://linear.app/thexap/issue/AOD-37) cards placed free-form.

![The Vela Dashboard view: a device frame with the AOD-21 hub header over an elevation-base canvas holding five widget cards placed free-form at varied sizes, each reusing the AOD-37 card chrome; beside it the free-form placement model showing a rect stored in nominal units rendered at eighty pixels per unit, the split between the frame AOD-21 fixes and the interior this design fills, and a token block.](assets/design-dashboard-view.svg)

<details>
<summary>The canvas, the cards &amp; the placement model</summary>

```
frame   : AOD-21 §5. The hub header (wordmark + Add + Settings + switcher ›) over the elevation.base canvas.
canvas  : elevation.base (colors.background, no border). The field widget instances mount into.
card    : REUSED from design-widget-system §4 (surface + 1px border + radius.md + the quiet caption header). Not restyled here.
place   : each instance is an absolutely-positioned rect { x, y, w, h } in NOMINAL units, rendered at UNIT_PX = 80 px/unit.
model   : nominal units make a layout device-independent (author on web, reload on the Fire HD 8). snapUnit -> 0.01u kills float drift.
hint    : a single quiet "Long-press a widget to arrange." line (type.meta / textMuted). Canonicalized from Dashboard.tsx.
```
</details>

- **The canvas is `elevation.base`** ([`unistyles.ts`](../../apps/app/unistyles.ts) `elevation`): `colors.background`, no border, no shadow. The cards mount into it and carry their own `elevation.raised` chrome, reused from [`design-widget-system.md`](design-widget-system.md) §4 unchanged. The dashboard is flat: a shadow reads as glare on an ambient display ([`design-widget-system.md`](design-widget-system.md) §4.1).
- **Placement is free-form and absolute.** Each instance is a `LayoutRect { x, y, w, h }` in **nominal units** ([`geometry.ts`](../../apps/app/src/layout/geometry.ts)), rendered at `UNIT_PX = 80` pixels per unit. Storing geometry in nominal units (not pixels) keeps a persisted layout device-independent, the [AOD-7](https://linear.app/thexap/issue/AOD-7) decision the engine already encodes. The cards may be any size and sit anywhere; this is a free-form canvas, not a fixed grid.
- **The size class follows the rect.** A widget declares `supportedSizes`; the engine reconciles the rect to the nearest supported class (`reconcileSize`, [AOD-10](https://linear.app/thexap/issue/AOD-10) §5.2) and hands the leaf that class. The rect is authoritative; the class is derived. The card draws its body at that class, owned by [AOD-37](https://linear.app/thexap/issue/AOD-37) and the per-widget designs.
- **The resting hint is quiet.** The shipped [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) shows a one-line "Long-press a widget to rearrange." This design keeps it as a single `type.meta` / `textMuted` line, consistent with the "looked at, not interacted with" ethos; a calmer first-run-only treatment is a build option (section 11), not redrawn here.

## 4. The arrange / edit mode

Arrange mode is the editor ([AOD-7](https://linear.app/thexap/issue/AOD-7)): the one moment the ambient surface becomes interactive. It is entered by a long-press, fixes a single selected card's affordances, and is left by Done or a tap on empty canvas. This section canonicalizes the affordances the shipped [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx) already draws and names their tokens.

![The Vela arrange mode: a device frame whose hub header shows a single accent Done pill, with two dimmed cards above one selected card lifted off a faint dashed origin outline; the selected card carries an accent border over a surfaceAlt fill, a Configure pill at its top-left, and a resize handle at its bottom-right; beside it the arrange-mode affordances with their entry and exit, the drag and resize mechanics, a note that placement is continuous free-form not snap-to-grid, and a token block.](assets/design-dashboard-arrange.svg)

<details>
<summary>The affordances, the gesture mechanics &amp; tokens</summary>

```
enter    : a long-press (>= 350ms) on any card enters arrange mode (the iOS-style jiggle). Dashboard.tsx owns the flag.
header   : arranging replaces the hub actions with a single accent Done pill (onAccent label).
selected : the dragged card draws bodyArranging = an accent border over a surfaceAlt fill. The one card you are moving.
configure: a Configure pill at the card's top-left (accent fill, onAccent label) -> the per-instance config sheet (section 7).
resize   : a handle at the card's bottom-right: a 24pt accent dot ringed in colors.background, inside a 44pt hit target.
drag     : moves rect.{x,y}; the origin is clamped >= 0. Live geometry on the UI thread (reanimated), no re-render mid-drag.
resize() : grows rect.{w,h} on the far edges; minimum extent 1x1 unit (MIN_W / MIN_H).
commit   : at gesture-end -> optimistic cache repaint + a 500ms-debounced RLS write; reconcileSize derives the new size class.
exit     : the Done pill, or a tap on the empty canvas (the full-bleed exit catcher). Both clear the arranging flag.
```
</details>

- **Enter by long-press.** A long-press (`>= 350ms`) on any card enters arrange mode ([`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx), the [AOD-49](https://linear.app/thexap/issue/AOD-49) UX choice). The dashboard owns the `arranging` flag so both exits work.
- **The header collapses to Done.** While arranging, the hub header drops Add / Settings / switcher and shows a single accent **Done** pill (`onAccent` label). This is the [AOD-21](https://linear.app/thexap/issue/AOD-21) §3 pushed-header trailing-action pattern applied to the hub: arrange is an editable mode, and Done is its one exit control.
- **The selected card is the only one styled.** The card under the gesture draws `bodyArranging`: an `accent` border over a `surfaceAlt` fill. Nothing else changes; the other cards keep their resting chrome. One accent, one selected card, no jiggle-everything noise.
- **Two affordances, opposite corners.** The **Configure pill** sits top-left (accent fill, `onAccent` label) and opens the per-instance config sheet for **any** widget, not only a `needs_config` one (the [AOD-52](https://linear.app/thexap/issue/AOD-52) generic-configure cut). The **resize handle** sits bottom-right: a 24pt accent dot ringed in `colors.background`, inside a 44pt hit target so it is reliably grabbable on touch. They are at opposite corners so neither overlaps the other.
- **The gesture math is the tested math.** Drag moves `rect.{x,y}` (origin clamped `>= 0`); resize grows `rect.{w,h}` on the far edges (minimum `1x1` unit). Live geometry runs on the UI thread via reanimated shared values, so a drag never triggers a React re-render (the always-on hot path, [AOD-25](https://linear.app/thexap/issue/AOD-25)). On gesture-end the engine commits: an optimistic cache repaint for an instant redraw, then a 500ms-debounced RLS write, and `reconcileSize` derives the new size class. A glance never blocks on I/O.
- **Exit by Done or empty tap.** The Done pill and a tap on the empty canvas (the full-bleed exit catcher, [`LayoutCanvas.tsx`](../../apps/app/src/layout/LayoutCanvas.tsx)) both clear the flag. Arrange mode is deliberately easy to leave, because the resting state is the point.

## 5. The empty state

A brand-new dashboard has no instances. [`app-ia.md`](app-ia.md) and [AOD-21](https://linear.app/thexap/issue/AOD-21) §8 fixed the empty-state **pattern** (a calm line + a primary action, never an error) and deferred the exact empty-**dashboard** layout here. This section fixes it.

![The Vela empty dashboard: a device frame whose hub header sits over an empty canvas holding one centered calm CTA, a soft dashed add glyph over the line your dashboard is empty, a quieter get-started subline, and one accent Add widget primary button; beside it the empty-state anatomy, the two empties one entry distinction, the AOD-21 relationship, and a token block.](assets/design-dashboard-empty.svg)

<details>
<summary>The empty-dashboard CTA &amp; tokens</summary>

```
layout  : centered in the canvas: a glyph over a line over an optional subline over one primary button.
glyph   : a soft dashed "add" mark (a rounded square + plus) in colors.accent. The brand's add metaphor; not an alert glyph.
line    : "Your dashboard is empty." (type.body / colors.text). Canonicalized from Dashboard.tsx.
subline : one quiet line, "Add a widget to get started." (type.meta / colors.textMuted). The calm voice (design-brand §7).
button  : ONE primary "Add widget" (the AOD-20 §5 primary: accent fill + onAccent label) -> opens the picker (section 6).
not     : never an error treatment (no red, no alert glyph). Nothing is wrong; the dashboard is simply new.
```
</details>

- **A calm centered CTA.** A soft `accent` add glyph, a `type.body` line ("Your dashboard is empty."), an optional quieter `type.meta` subline, and one [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 **primary** button ("Add widget"). It is the calm-voice empty the brand calls for ([`design-brand.md`](design-brand.md) §7), never an error treatment.
- **Two empties, one entry.** The **screen** empty (zero instances, this design) always offers "Add widget" and never assumes a service is connected. The **picker** empty (nothing addable, section 6) is the picker's own state and points to Settings -> Connections. The screen offers the entry; the picker resolves whether anything is addable. Keeping them separate is why the empty dashboard does not need to know the connection state.
- **It canonicalizes the shipped CTA.** The shipped [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) already renders "Your dashboard is empty." + an "Add widget" button with a `colors.background`-on-accent label; this design keeps the copy and the layout and reconciles the label to `onAccent` (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 primary, section 11).

## 6. The add-widget picker interior

The add-widget picker is an in-screen sheet over the dashboard ([`app-ia.md`](app-ia.md) §4.4, row 4): it carries the active dashboard, so it stays off the router. [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 fixed its **presentation** (scrim + `elevation.overlay` + grabber); this section fixes its **interior**, the `addableWidgets` list grouped by service.

![The Vela add-widget picker: a bottom sheet over a dimmed dashboard under a scrim, with a grabber, an Add widget title and Close, then the addable widgets grouped by service, Linear with My Issues and Current Cycle, Google Calendar with Next Event and Todays Agenda, and a Clock row; beside it the reused sheet presentation, the interior addableWidgets-grouped-by-service structure, the configure-on-add path and the picker states, and a token block.](assets/design-dashboard-add-widget.svg)

<details>
<summary>The picker interior, the configure-on-add path &amp; tokens</summary>

```
presentation : AOD-21 §7 in-screen sheet (scrim + sheet at elevation.overlay + grabber). An RN Modal owned by the dashboard.
source       : registry.addableWidgets(connected) -- only widgets whose parent service is connected; Clock (authClass 'none') exempt.
grouping     : grouped under the publishing service, in registry order (groupByService). A group label = type.caption.
row          : the AOD-20 §8 list row: widget title + a trailing accent "Add". Selecting it inserts into the active dashboard.
on-add       : requiresConfiguration(schema)? -> the config sheet first (submit "Add"); else add with schema defaults (AOD-51).
states       : loading "Checking connections..." · error "Could not load your connections." · empty "Connect a service in Settings" + Open Settings.
seam         : the AOD-8 §9/§10 registry seam -- the picker names no service and grows by one group per integration, zero edits here.
```
</details>

- **Reuses the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet.** The scrim darkens the dashboard, the sheet rises at `elevation.overlay` (`surfaceAlt`) with a grabber, and a header pairs the "Add widget" title with a Close. This design draws only the **interior**; the presentation is the shell's.
- **The interior is `addableWidgets`, grouped.** The picker offers exactly `registry.addableWidgets(connected)` ([`registry.ts`](../../apps/app/src/registry/registry.ts)): widgets whose parent service is connected, with `authClass: 'none'` (Clock) the sole exemption. They are grouped under their publishing service in registry order; each row is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 list row (a widget title with a trailing accent "Add").
- **Configure-on-add routes through the config sheet.** A widget whose schema has a required field with no default (`requiresConfiguration`) opens the per-instance config sheet first, submitting "Add" ([`WidgetPicker.tsx`](../../apps/app/src/layout/WidgetPicker.tsx)); everything else adds with schema defaults ([AOD-51](https://linear.app/thexap/issue/AOD-51)). The picker stays mounted behind the config sheet, so a cancel returns to it. This is the third entry to the config sheet (section 7).
- **The states are quiet.** Loading is "Checking connections..."; a connections error is "Could not load your connections."; and the empty case ("nothing addable") is the calm "Connect a service in Settings to add its widgets." plus an "Open Settings" action. The empty case is the picker's, distinct from the screen empty (section 5).
- **The [AOD-8](https://linear.app/thexap/issue/AOD-8) seam holds visually.** The picker names no service; it reads the registry and the live connection map and renders whatever is addable. Adding an integration grows this list by one group with zero edits to the picker, the canonical [AOD-8](https://linear.app/thexap/issue/AOD-8) §10 invariant, preserved in the design.

## 7. The per-instance config sheet interior

The per-instance config sheet is the second in-screen sheet over the dashboard ([`app-ia.md`](app-ia.md) §4.4, row 5): it carries a live `WidgetInstance`. [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 fixed its presentation; this section fixes its **interior**, the generic `ConfigForm` ([`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx)), one input per schema field kind, composed from the [AOD-20](https://linear.app/thexap/issue/AOD-20) controls.

![The Vela per-instance config sheet: a bottom sheet over a dimmed dashboard, with a grabber, a Configure My Issues title, a Sort segmented control with Priority selected, a Projects row of multi-select pills with two selected, a Show sub-issues toggle on, and Cancel and Save; beside it the sheet presentation and the three entry points, the field kinds mapped to AOD-20 components, the validation and the AOD-28 ownership split, and a token block.](assets/design-dashboard-configure.svg)

<details>
<summary>The field kinds, the three entries &amp; tokens</summary>

```
presentation : AOD-21 §7 in-screen sheet (scrim + sheet at elevation.overlay + grabber). Carries a live WidgetInstance.
entries      : (1) arrange-mode "Configure" pill · (2) host needs_config "Reconfigure" prompt (AOD-37 §5) · (3) configure-on-add (submit "Add").
               All three route through the dashboard's `configuring` state (ConfigureInstanceModal / ResolvedConfigFormModal).
field kinds (generic over WidgetConfigSchema -> AOD-20 controls):
  string / number  -> input (AOD-20 §6: surfaceAlt fill, border; placeholder -> textMuted)
  boolean          -> toggle (AOD-20 §7: radius.full track, accent on, onAccent knob)
  enum             -> segmented control (AOD-20 §7: exclusive, full-accent selected)
  remote-options   -> multi-select pills (AOD-20 §7: accentMuted selected) + loading / error+retry / needs_reconnect / empty sub-states
validation   : validateConfig is the single source of truth (AOD-10 §4.2); field errors render inline (type.meta / error).
actions      : Cancel (a ghost / textMuted) + Save (the AOD-20 §5 primary). On configure-on-add, Save reads "Add".
```
</details>

- **One input per field kind, generic over the schema.** The `ConfigForm` renders one control per `WidgetConfigField`, switching on its kind: `string` / `number` -> the [AOD-20](https://linear.app/thexap/issue/AOD-20) §6 input; `boolean` -> the §7 toggle; `enum` -> the §7 segmented control (exclusive, full-accent selected); `remote-options` -> the §7 multi-select pills (`accentMuted` selected) with their loading / error+retry / `needs_reconnect` / empty sub-states ([AOD-10](https://linear.app/thexap/issue/AOD-10) §4.3). It names no service and reads only the schema it is given, so it configures every widget.
- **Three entries, one sheet.** The sheet is reached three ways, all routing through the dashboard's `configuring` state: the arrange-mode **Configure** pill (section 4), the host's `needs_config` **Reconfigure** prompt ([AOD-37](https://linear.app/thexap/issue/AOD-37) §5), and **configure-on-add** from the picker (section 6). The same `ConfigForm` serves all three; only the title and the submit label ("Save" vs "Add") differ.
- **`validateConfig` is the one validation truth.** Field-level errors render inline ([`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx)); there is no second validator. The design keeps the inline error treatment (`type.meta` / `error`) and the required-field marker; the rules are [AOD-10](https://linear.app/thexap/issue/AOD-10) §4.2's, not re-decided here.
- **Cancel + Save.** Cancel is a low-weight action (`textMuted` / ghost); Save is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 primary. The shipped `colors.background`-on-accent submit label reconciles to `onAccent` (section 11).

## 8. The dashboards switcher interior

The dashboards switcher is a modal route ([`app-ia.md`](app-ia.md) §4.5, row 6): an app-global surface, deep-linkable, not tied to a live parent object. [AOD-21](https://linear.app/thexap/issue/AOD-21) §5 placed its **entry** (the hub-header switcher chevron) and §7 fixed its **presentation** (the modal route, scrim + dialog at `elevation.overlay`); [AOD-21](https://linear.app/thexap/issue/AOD-21) §13 and [`app-ia.md`](app-ia.md) §10 handed its **interior** and the active-selection here. This section fixes them.

![The Vela dashboards switcher: a centered modal dialog over a dimmed dashboard, with a Dashboards title and Close, a Home row marked active with a muted-accent highlight and an accent check, a Wall row, a divider, and a New dashboard action; beside it the reused modal-route presentation, the dashboards-list interior, the create gate with a mini lock-row specimen, a build-seam note, and a token block.](assets/design-dashboard-switcher.svg)

<details>
<summary>The switcher list, the create gate &amp; tokens</summary>

```
presentation : AOD-21 §7 modal route (scrim + dialog at elevation.overlay + Close). app-ia §4.5.
list         : reads the `dashboards` table, ordered by position (data-model §5.4). Each row = a small dashboard glyph + name.
active       : the active dashboard carries an accentMuted highlight + an accent check. Tap a row -> switch the active layout.
create       : "New dashboard" (+ glyph, accent) -> the create action.
gate         : on Free, maxDashboards = 1, so New dashboard is the AOD-20 §11 lock row -> Paywall (trigger=dashboards). UX-only; server enforces.
build        : today useDashboard bootstraps ONE dashboard; the multi-dashboard table + active-selection persistence are the build's (app-ia §10).
```
</details>

- **Reuses the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 modal route.** A scrim over the dashboard and a dialog at `elevation.overlay`, with a Close. The shell drew the presentation; this design draws the list.
- **The list is the `dashboards` table.** Each row is a small dashboard glyph and the dashboard name, ordered by `position` ([`data-model.md`](data-model.md) §5.4). The **active** dashboard carries an `accentMuted` highlight and an `accent` check; tapping another row switches the active layout (the canvas re-renders).
- **The create gate is the [AOD-20](https://linear.app/thexap/issue/AOD-20) lock row.** "New dashboard" is the create action. On Free, `maxDashboards = 1` ([AOD-12](https://linear.app/thexap/issue/AOD-12) §7.1), so it is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 lock row (a padlock, a `textMuted` title, a PRO `accentMuted` badge, a chevron) routing to the Paywall (`trigger=dashboards`). It is the `Gate` fallback ([`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx)): UX-only, never an enabled-but-trapped control, the server enforces the limit.
- **The interior is designed ahead of its backing.** Today [`useDashboard.ts`](../../apps/app/src/layout/useDashboard.ts) bootstraps a single dashboard; the multi-dashboard table and the active-selection persistence are the build's ([`app-ia.md`](app-ia.md) §10). This design fixes the switcher interior so the build has a target, the same design-ahead posture [AOD-21](https://linear.app/thexap/issue/AOD-21) took for the surfaces it scaffolded.

## 9. The ownership overlap with AOD-28 (named, not silent)

[AOD-28](https://linear.app/thexap/issue/AOD-28)'s description mentions "the per-instance config forms", but [`app-ia.md`](app-ia.md) §5 row 5 lists the **per-instance config sheet's design owner as AOD-27**. This is the same keystone-and-application overlap [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 resolved for the Settings / Account split, resolved here explicitly rather than claimed:

- **AOD-27 (this design) owns the widget-instance config sheet** (section 7): the generic `ConfigForm` over a `WidgetConfigSchema` ([`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx)), reached from the dashboard (arrange-mode Configure, host `needs_config`, configure-on-add). It carries a live `WidgetInstance` and configures a widget.
- **[AOD-28](https://linear.app/thexap/issue/AOD-28) owns the service credential form** ([`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx)): the API-key / location entry reached from Settings -> Connections per `authClass`. It carries a `ServiceDefinition` and connects a service.

Both are in-screen sheets that reuse the same [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 chrome; they differ in **interior** and in **what they parameterize** (a widget instance vs a service). The split is clean: the dashboard configures widgets (here); Settings connects services ([AOD-28](https://linear.app/thexap/issue/AOD-28)). Neither redraws the other's sheet.

## 10. Editor-scoped token additions (the AOD-21 §11 analog)

The dashboard interior composes almost entirely from the existing tokens, the [AOD-20](https://linear.app/thexap/issue/AOD-20) component groups, and the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell groups. Where it needs geometry the theme does not name, it adds an **editor-scoped component group**, carrying numbers plus role-name aliases (never a hex), the way [AOD-21](https://linear.app/thexap/issue/AOD-21) added `appBar` / `screen` and [AOD-20](https://linear.app/thexap/issue/AOD-20) added `button` / `input`. These are **specified here, not coded**; the build adds them to [`unistyles.ts`](../../apps/app/unistyles.ts).

| # | Addition | Kind | What it aliases / carries |
|---|---|---|---|
| 1 | `arrange` group | **Additive (component).** | `selectBorder -> accent` · `selectFill -> surfaceAlt` (the `bodyArranging` treatment) · `handle` geometry (dot `24`, hit `44`, ring `-> background`) · `configurePill` (a small accent pill: `bg -> accent`, label `-> onAccent`). Numbers + role names. |
| 2 | The canvas unit | **Composes, an engine constant.** | `UNIT_PX = 80` lives in [`geometry.ts`](../../apps/app/src/layout/geometry.ts), not the theme (it is layout math, not a style token). Named here so the design and the engine agree; no token added. |
| 3 | The two sheets + the switcher | **Composes, no new token.** | The picker, the config sheet, and the switcher reuse the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 / [AOD-20](https://linear.app/thexap/issue/AOD-20) §9 `sheet` / `modal` groups + `scrim` + `elevation.overlay`. No new token. |
| 4 | The interior controls | **Composes, no new token.** | The picker rows ([AOD-20](https://linear.app/thexap/issue/AOD-20) §8 `listRow`), the config controls (§6 `input`, §7 `toggle` / `segmented` / `pill`), the empty + Save buttons (§5 `button`), and the create-gate lock (§11 `lockRow`). No new token. |

Typing safety, carried from the AOD-62 build note (`aod-unistyles-style-token-gotcha`): `arrange` is numbers + role-name strings (plain, Unistyles-safe, like `elevation` and the [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-21](https://linear.app/thexap/issue/AOD-21) groups); it does not touch `type.*`, so it does not reintroduce the deep-style typing flood.

## 11. Reconciliation with the shipped surfaces (the AOD-21 §12 analog)

The dashboard interior is a **canonicalization** of the shipped engine and screens, not a greenfield redraw. Each drift the unpolished surfaces carry is listed here for the implementing `type:tech-task`. None changes a token **value**; they align the surfaces to the shell, the components, and the cards. Nothing below redraws a surface silently; several deltas are the same ones [AOD-20](https://linear.app/thexap/issue/AOD-20) §13 flagged, named here at their dashboard call sites.

| # | Surface today | Canonical (this design) | Kind |
|---|---|---|---|
| 1 | [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) header: `Vela` text + email + Add / Settings / **Sign out** inline. | The [AOD-21](https://linear.app/thexap/issue/AOD-21) §3 **hub header** (wordmark + Add + Settings + switcher); sign out relocated to Account ([AOD-21](https://linear.app/thexap/issue/AOD-21) §6). The arranging header shows only **Done**. | **canonicalize (AOD-21)** |
| 2 | [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx): the empty CTA + the persistent hint use `colors.background` on accent and ad-hoc sizes. | The **empty CTA** (section 5) on the `type` scale, the **primary** button label `-> onAccent`, the hint a single `type.meta` / `textMuted` line. | **canonicalize** |
| 3 | [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx): the Configure pill and Done pill label use `colors.background` on the accent fill. | The `arrange.configurePill` and the Done pill theme against **`onAccent`** (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 reconciliation), via the `arrange` group (section 10). | **canonicalize** |
| 4 | [`WidgetPicker.tsx`](../../apps/app/src/layout/WidgetPicker.tsx): the sheet hardcodes `rgba(0,0,0,0.6)` and fills with `colors.background`; rows are ad-hoc. | The [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet: backdrop `-> scrim`, sheet `-> elevation.overlay` (`surfaceAlt`); rows `-> the AOD-20 §8 list row`. | **canonicalize** |
| 5 | [`ConfigFormModal.tsx`](../../apps/app/src/widgets/ConfigFormModal.tsx): same hardcoded `rgba` backdrop + `background` fill. | The [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet: `scrim` + `elevation.overlay`. A single token change reskins every sheet. | **canonicalize** |
| 6 | [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx): a native `Switch`, `surface` input fill, hardcoded placeholder `#7A7F8C`, enum pills `accent`-on-`background`, `background`-on-accent submit. | The [AOD-20](https://linear.app/thexap/issue/AOD-20) controls: `toggle` (§7), `input` (§6, `surfaceAlt`, placeholder `-> textMuted`), `segmented` (§7), Save `-> primary` (`onAccent`). | **canonicalize (AOD-20)** |
| 7 | No multi-dashboard switcher interior; [`useDashboard.ts`](../../apps/app/src/layout/useDashboard.ts) bootstraps one dashboard. | The **switcher interior** (section 8) drawn as a scaffold the build fills; the `dashboards` table + active-selection are the build's ([`app-ia.md`](app-ia.md) §10). | **add (scaffold)** |

These are **build** items (the PS-M2 / polish `type:tech-task`), not this design's edits; this design fixes the target, the build moves the call sites. The `arrange.*` token group (section 10) and the [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-21](https://linear.app/thexap/issue/AOD-21) group additions those designs already flagged are its inputs.

## 12. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| **The polish build** (apply this design to [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) / [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx) / [`WidgetPicker.tsx`](../../apps/app/src/layout/WidgetPicker.tsx) / [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx); add the `arrange` group) | a PS-M2 `type:tech-task` | The interior visuals and the `arrange` token are fixed here; the build implements them and reconciles section 11. |
| **Grid / alignment guides** (snap-to-grid, alignment lines, collision nudging) | future + the build | The engine is free-form and continuous (`snapUnit` only kills 0.01u float drift); guides are named here, not invented, so v1 stays the shipped free-form behavior. |
| **The multi-dashboard backing** (the `dashboards` table, the active-selection persistence, the switcher control wiring) | the build ([`app-ia.md`](app-ia.md) §10) | The switcher interior and the active mark are fixed; the table and the state are the build's. |
| **The service credential form interior** | [AOD-28](https://linear.app/thexap/issue/AOD-28) | This design owns the widget-instance config sheet; the credential form is AOD-28's (section 9). |
| **The full paywall layout** (the create-gate destination) | [AOD-29](https://linear.app/thexap/issue/AOD-29) | The create gate routes to the paywall (`trigger=dashboards`); the paywall body is [AOD-29](https://linear.app/thexap/issue/AOD-29)'s. The lock affordance is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 row. |
| **The kiosk wall presentation** | [AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11) | This design is the foreground editor; the glanceable kiosk wall over the same layout is theirs. |
| **Motion** (the long-press jiggle, the drag lift, the sheet slide, the modal rise, the resize feedback) | the build | Named (section 4); exact timings are a build refinement, the way [AOD-21](https://linear.app/thexap/issue/AOD-21) §10 and [AOD-20](https://linear.app/thexap/issue/AOD-20) §14 left motion to the build. |
| **Light-theme parity polish** | the build | The interior is defined in role terms, so light is a re-alias, not a redraw (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §3 layering rule). |

## 13. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. **The dashboard view is fixed** (section 3; `design-dashboard-view.svg`): widget instances placed free-form on the `elevation.base` canvas, reusing the [AOD-37](https://linear.app/thexap/issue/AOD-37) card chrome, with the nominal-unit / `UNIT_PX` placement model, inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §5 frame.
> 2. **The arrange / edit mode is fixed** (section 4; `design-dashboard-arrange.svg`): the long-press entry, the `accent`-border / `surfaceAlt` selection, the Configure pill and the 24pt / 44pt resize handle, the drag / resize math, the gesture-end commit, and the Done / tap-empty exit.
> 3. **The empty state is fixed** (section 5; `design-dashboard-empty.svg`): the calm centered CTA (glyph + line + subline + one primary "Add widget"), never an error, the empty-dashboard layout [AOD-21](https://linear.app/thexap/issue/AOD-21) §8 deferred.
> 4. **The add-widget picker interior is fixed** (section 6; `design-dashboard-add-widget.svg`): `addableWidgets` grouped by service inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet, the configure-on-add path, the loading / error / empty states, and the [AOD-8](https://linear.app/thexap/issue/AOD-8) seam.
> 5. **The per-instance config sheet interior is fixed** (section 7; `design-dashboard-configure.svg`): the generic `ConfigForm`, one [AOD-20](https://linear.app/thexap/issue/AOD-20) control per field kind (input / toggle / segmented / pills + the remote-options sub-states), the three entry points, and inline `validateConfig` errors.
> 6. **The dashboards switcher interior is fixed** (section 8; `design-dashboard-switcher.svg`): the dashboards list inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 modal route, the active-selection mark, and the New-dashboard create gate (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 lock row -> Paywall on Free).
> 7. **The work is handed forward** (sections 9 to 12): the [AOD-28](https://linear.app/thexap/issue/AOD-28) config-sheet-vs-credential-form overlap is resolved, the `arrange` editor-scoped token is specified, the reconciliation with the shipped surfaces is named, and the seams are left clean; no code is changed, no token is coded. The **six mockups render** in the house dark style.

| Acceptance clause | Where |
|---|---|
| Dashboard view: free-form canvas, AOD-37 cards, placement model | Section 3; `design-dashboard-view.svg` |
| Arrange mode: long-press, selection, drag / resize, Configure, Done | Section 4; `design-dashboard-arrange.svg` |
| Empty state: calm CTA, never an error | Section 5; `design-dashboard-empty.svg` |
| Add-widget picker: addableWidgets grouped, configure-on-add, states | Section 6; `design-dashboard-add-widget.svg` |
| Per-instance config sheet: field kinds, three entries, validation | Section 7; `design-dashboard-configure.svg` |
| Dashboards switcher: list, active mark, create gate | Section 8; `design-dashboard-switcher.svg` |
| AOD-28 overlap; editor-scoped token; reconciliation; seams | Sections 9 to 12 |

## 14. References

- [AOD-27](https://linear.app/thexap/issue/AOD-27): this design's tracking issue (`type:design`, `area:layout` + `area:app`; milestone PS-M2 "App shell", project Platform & App Shell).
- [AOD-7](https://linear.app/thexap/issue/AOD-7): the free-form layout-engine decision this design lays out the visuals for. The engine is built ([`LayoutCanvas.tsx`](../../apps/app/src/layout/LayoutCanvas.tsx), [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx), [`geometry.ts`](../../apps/app/src/layout/geometry.ts)).
- [AOD-21](https://linear.app/thexap/issue/AOD-21) ([`design-core-navigation.md`](design-core-navigation.md)): the app shell this applies. §5 the dashboard frame, §7 the sheet / modal presentation chrome, §8 the screen states, §13 the seam that hands the editor here. The direct upstream.
- [AOD-17](https://linear.app/thexap/issue/AOD-17) ([`app-ia.md`](app-ia.md)): the IA. §4.4 / §4.5 the presentation rule, §5 rows 3 / 4 / 5 / 6 the surfaces, §6.2 the hub, §7 the entry points, §10 the multi-dashboard seam.
- [AOD-20](https://linear.app/thexap/issue/AOD-20) ([`design-component-library.md`](design-component-library.md)): the components every surface composes (buttons, inputs, toggles / segmented / pills, list rows, sheets / modals, the lock / PRO overlay). Reused, not redesigned.
- [AOD-37](https://linear.app/thexap/issue/AOD-37) ([`design-widget-system.md`](design-widget-system.md)): the widget card chrome + lifecycle + empty body the canvas cards reuse; §5 the `needs_config` prompt that is one config-sheet entry.
- [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66) ([`unistyles.ts`](../../apps/app/unistyles.ts)): the coded semantic roles, the `elevation` ladder, `scrim` / `onAccent` / `focusRing`, `radius.full`, and the `type` / `spacing` scales the interior composes.
- [AOD-18](https://linear.app/thexap/issue/AOD-18) ([`design-brand.md`](design-brand.md)): the one-accent rule, the dark-first surface, and the calm voice the empty CTA and prompts keep.
- [AOD-8](https://linear.app/thexap/issue/AOD-8) ([`architecture-registry.md`](architecture-registry.md)) / [`registry.ts`](../../apps/app/src/registry/registry.ts): the services -> widgets -> layout seam the picker and config sheet preserve (`addableWidgets`, the config-form genericity).
- [AOD-10](https://linear.app/thexap/issue/AOD-10) ([`widget-model.md`](widget-model.md)): §4 the config model and field kinds, §4.2 `validateConfig`, §4.3 remote-options, §5.2 `reconcileSize`. The config sheet and the size reconciliation honor it.
- [AOD-12](https://linear.app/thexap/issue/AOD-12) ([`entitlement-model.md`](entitlement-model.md)) / [`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx): the UX-only gate the create-gate lock coordinates with (`maxDashboards` -> Paywall).
- [AOD-28](https://linear.app/thexap/issue/AOD-28) / [AOD-29](https://linear.app/thexap/issue/AOD-29) / [AOD-39](https://linear.app/thexap/issue/AOD-39): the sibling applications of the shell and the wall, and the credential-form / paywall / kiosk-wall owners (sections 9, 12).
- The shipped surfaces this canonicalizes: [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx), [`LayoutCanvas.tsx`](../../apps/app/src/layout/LayoutCanvas.tsx), [`PlacedInstance.tsx`](../../apps/app/src/layout/PlacedInstance.tsx), [`WidgetPicker.tsx`](../../apps/app/src/layout/WidgetPicker.tsx), [`ConfigureInstanceModal.tsx`](../../apps/app/src/layout/ConfigureInstanceModal.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx), [`ConfigFormModal.tsx`](../../apps/app/src/widgets/ConfigFormModal.tsx), [`useDashboard.ts`](../../apps/app/src/layout/useDashboard.ts).
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
- Assets: [`design-dashboard-view.svg`](assets/design-dashboard-view.svg), [`design-dashboard-arrange.svg`](assets/design-dashboard-arrange.svg), [`design-dashboard-empty.svg`](assets/design-dashboard-empty.svg), [`design-dashboard-add-widget.svg`](assets/design-dashboard-add-widget.svg), [`design-dashboard-configure.svg`](assets/design-dashboard-configure.svg), [`design-dashboard-switcher.svg`](assets/design-dashboard-switcher.svg).
