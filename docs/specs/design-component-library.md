# Design: Vela component library (cards, inputs, overlays, skeletons)

> Status: draft for review, 2026-06-30. Tracked by [AOD-20](https://linear.app/thexap/issue/AOD-20) (`type:design`, `area:design-system`; milestone DS-M2 "Components & Core Screens", project Design System). The **first DS-M2 deliverable**: the app-chrome component set every core screen and per-feature design composes from. It follows the `type:design` deliverable convention in [`engineering-process.md`](../engineering-process.md): a `design-` doc under `docs/specs/` plus rendered SVG specimens in `docs/specs/assets/`, component tokens **specified** (not written into [`unistyles.ts`](../../apps/app/unistyles.ts)), merged via PR.
>
> **It supersedes the issue's original "Produce (Figma)" wording.** AOD-20 was written before [AOD-37](https://linear.app/thexap/issue/AOD-37) set the repo's `type:design` convention (a `design-` doc + rendered SVGs in-repo, not a Figma file). This deliverable follows that established convention, the same supersession the widget system ([AOD-37](https://linear.app/thexap/issue/AOD-37)) and the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19)) used. No scope change, only the medium.
>
> **It is the third in a three-step ladder, one level up each time.** [AOD-37](https://linear.app/thexap/issue/AOD-37) designed the **widget visual system** (built by [AOD-62](https://linear.app/thexap/issue/AOD-62)); [AOD-19](https://linear.app/thexap/issue/AOD-19) designed the **token system** (reconciled into [`unistyles.ts`](../../apps/app/unistyles.ts) by [AOD-66](https://linear.app/thexap/issue/AOD-66), PR #31, Done); AOD-20 designs the **components**. A future DS-M2 `type:tech-task` builds them. Design-first, no vibe-coding.
>
> **Design-first, surfaced for approval.** Three structural choices shape the whole set, so all three are surfaced before anything is finalized (section 3): **(A)** the button variant taxonomy, **(B)** the input border treatment, and **(C)** whether `accentMuted` is promoted. Recommendations are recorded with each; the PR review is the approval gate, the way [AOD-19](https://linear.app/thexap/issue/AOD-19) surfaced its two forks and the brand surfaced its three directions. The one deferred token candidate AOD-19 handed here, `type.lineHeight`, is resolved additively in section 3.4.
>
> **Consistency is the hard constraint.** The components theme against the **real coded role names** [AOD-66](https://linear.app/thexap/issue/AOD-66) landed: the semantic roles, the `elevation` ladder, `scrim`, `onAccent`, `focusRing`, and the `type` / `spacing` / `radius` scales (incl. `radius.full`). Every component color is a **semantic role reference, never a raw hex.** The one-accent rule holds; no new hue (§4.6 of [`design-tokens.md`](design-tokens.md)) enters any component. The widget card chrome, the lifecycle states, and the empty body are **reused, not redesigned** (they stay owned by [`design-widget-system.md`](design-widget-system.md)); the lock/PRO overlay **coordinates with the entitlements `Gate` already in code** ([`apps/app/src/entitlements/Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx)). Where a component needs a value the theme does not yet name, it is **flagged as a component-scoped token addition** (section 12), specified the way the widget designs specified `weatherIcon` / `sparkline` / `money` / `priorityIcon` / `progress`; the build adds it later. This design specifies the components and their tokens; it does **not** edit [`unistyles.ts`](../../apps/app/unistyles.ts) or write component code.

## 1. Purpose and scope

[`design-tokens.md`](design-tokens.md) §10 / §11 names AOD-20 as the consumer that themes against the semantic roles and **adds the component-scoped token groups** (`button.*`, `input.*`, `toggle.*`). AOD-20 is that work: the **app-chrome component set** for the foreground app, Settings / SignIn / onboarding / paywall and the connection screens, designed **once** so the per-feature and per-screen designs it blocks are **applications** of it, not redesigns, exactly as [`design-widget-system.md`](design-widget-system.md) is the system the four widget designs applied.

It fixes exactly nine things:

1. **The structural forks** (section 3): the button variant taxonomy, the input border treatment, the `accentMuted` promotion, and the `type.lineHeight` resolution, surfaced for approval.
2. **The component tier and elevation in practice** (section 4): how a component token aliases a semantic role, and the `base` / `raised` / `overlay` / `scrim + overlay` ladder shown on real app surfaces.
3. **Buttons** (section 5): primary / secondary / ghost / destructive, all states and sizes, `onAccent` on fills, `focusRing`.
4. **Inputs** (section 6): the text field and its states, the label / placeholder / hint, the search-row variant, the settled border treatment.
5. **Toggles, segmented, and selectable pills** (section 7): the switch (`radius.full`), the exclusive segmented control, and the multi-select pills.
6. **Cards, panels, and row-groups** (section 8): the widget card reused, plus the app-chrome row-group, list row, and auth card.
7. **Sheets, modals, and popovers** (section 9): the floating-UI answer, `scrim` + `elevation.overlay`.
8. **Skeletons and badges** (section 10): the `skeleton` role and shimmer, the status / PRO / count badges.
9. **Lock / PRO overlays** (section 11): the freemium gate affordance, coordinated with the `Gate`.

**In scope:** the app-chrome component set (the nine families above), each as a complete visual + interaction contract (variants, states, sizes, the exact tokens consumed, and any component-scoped token additions), plus the additions handed to the DS-M2 build (section 12) and the seams to the screens / per-feature designs (section 14).

**Out of scope (named so the frame is clear):** see section 14. In short: coding anything (the [`unistyles.ts`](../../apps/app/unistyles.ts) edits or component code, the future DS-M2 build `type:tech-task`); the per-feature and core-screen designs that compose these ([AOD-21](https://linear.app/thexap/issue/AOD-21) / [AOD-27](https://linear.app/thexap/issue/AOD-27) / [AOD-28](https://linear.app/thexap/issue/AOD-28) / [AOD-29](https://linear.app/thexap/issue/AOD-29), and the INT / BIL / KIO designs); the kiosk wall presentation ([AOD-39](https://linear.app/thexap/issue/AOD-39), under K-M1); re-deciding tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66), Done) or the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18), Done); and restyling the widgets ([`design-widget-system.md`](design-widget-system.md) owns the card, the lifecycle, and the empty body).

## 2. Locked context this builds on

| Source | What it locks | How this design uses it |
|---|---|---|
| [`unistyles.ts`](../../apps/app/unistyles.ts) (AOD-66) | The **real coded tokens**: the `primitive` ramps, the semantic `colors.*` roles, `onAccent` / `focusRing` / `scrim`, the `elevation` ladder, `radius.full`, and the `type` / `spacing` scales. | Every component themes against these role names (sections 5 to 11). Nothing here re-decides a value. |
| [`design-tokens.md`](design-tokens.md) §3 / §10 / §11 | The three-tier taxonomy (primitive → semantic → component) and the **one layering rule**; the AOD-20 application table; the deferred candidates (`accentMuted`, `divider`/`inputBorder`, `type.lineHeight`). | Section 4 places the component groups under the component tier; section 3 resolves each deferred candidate additively. |
| [`design-widget-system.md`](design-widget-system.md) §4 / §5 / §5.1 | The **card chrome**, the six **lifecycle states**, and the **empty body**, plus the shared line-icon **glyph family** ([`glyphs.tsx`](../../apps/app/src/widgets/glyphs.tsx)). | Sections 8, 10 **reuse** these; the chrome glyph family extends to the component glyphs (lock, chevron, close). No restyle. |
| [`design-brand.md`](design-brand.md) §5 / §7 | The **one-accent rule**, the calm voice, and the wordmark. | Every component keeps one accent and no new hue; the auth card sets the wordmark (section 8); copy follows the voice. |
| [`apps/app/src/entitlements/Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx) | The **UX-only gate**: `children` when entitled, `fallback` otherwise; the server still refuses an over-limit request. | The lock/PRO overlay **is** the `Gate` fallback (section 11); it never runs the gated action. |
| The shipped screens / components ([`Settings.tsx`](../../apps/app/src/screens/Settings.tsx), [`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx), [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx), [`ConfigFormModal.tsx`](../../apps/app/src/widgets/ConfigFormModal.tsx)) | The **functional-but-unpolished** app chrome: buttons, fields, the native `Switch`, enum pills, the bottom-sheet modal. | This design canonicalizes what they already do and resolves their drift (section 13); it designs **for** what exists, not greenfield. |
| [`engineering-process.md`](../engineering-process.md) | The `type:design` deliverable convention and the chain decision → spec → design → tech-task. | This deliverable follows it; sections 12 and 14 hand the build to a `type:tech-task`. |

What is already true, and what this adds: the app already **renders** these surfaces (a sign-in card, a settings list, connect forms, a config sheet), themed against the Unistyles theme. This design does not invent the surfaces. It **names the components** those surfaces imply, fixes their states and the exact roles each consumes, resolves the inconsistencies the unpolished chrome carries (three different input fills, a hardcoded placeholder hex, `colors.background` used where `onAccent` now exists), and writes the set down once as the contract the DS-M2 build and every screen design references.

## 3. Structural choices surfaced for approval

Three forks shape the whole set; a fourth candidate is resolved. Each is decided **additively**, the §3 way: a component-scoped token is added only where a value is genuinely shared, and no semantic role is silently forked.

### 3.1 Fork A: the button variant taxonomy

**Recommendation: four variants, `primary` / `secondary` / `ghost` / `destructive`, plus three sizes (`sm` / `md` / `lg`).** This is exactly what the shipped chrome already expresses, unnamed: the accent-fill submit ([`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx)) is `primary`; the bordered/`textMuted` "Create an account" is `secondary`; the bare accent actions ("Back to dashboard", the connection actions, "Retry"/"Reconnect") are `ghost`; the `error`-colored "Disconnect" ([`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx)) is `destructive`. Naming these four (no more) keeps the "one vocabulary of actions" the widget system already teaches and avoids a fifth variant that would dilute the single accent. Section 5 fixes the set.

### 3.2 Fork B: the input border treatment

**Recommendation: do not split a semantic `inputBorder` or `divider` from `border`. Express them as component-scoped aliases instead.** The deferred candidate ([`design-tokens.md`](design-tokens.md) §4.4) asked whether `border` should fork. It should not: the resting field border and the row-group divider both read correctly as `border` today, so the semantic tier stays one `border` role. The component group names `input.border → border`, `input.borderFocus → focusRing`, `input.borderError → error`, and `rowGroup.divider → border`. Focus and error recolor the **border only** (the fill is unchanged), which is why a semantic fork is unnecessary: the *states* live in the component group, not the palette. Section 6 fixes this.

### 3.3 Fork C: the `accentMuted` promotion

**Recommendation: promote `accentMuted`, one shared low-accent interactive surface, as a semantic token (one accent at a low fixed alpha).** [`design-tokens.md`](design-tokens.md) §4.4 left this to AOD-20 "if a genuinely shared low-accent surface appears." It does: a faint accent tint recurs across at least four components, a pressed `ghost` / `secondary` button background, a selected multi-select pill, an accent / PRO badge fill, and the focus halo. That meets the "genuinely shared" bar for a semantic role (the §3 rule: promote to semantic when shared across components, keep component-scoped when local). `accentMuted` is the **one accent at low alpha** (no new hue, the one-accent rule holds). It is distinct from, and does **not** replace, the widget **data** alphas (`progress` track at 0.18, `sparkline` past at 0.5): those encode data intensity and stay per-widget; `accentMuted` is a **chrome surface** tint. Sections 5, 7, 10, 11 consume it.

The other half of the §4.4 candidate, a low-emphasis accent for **exclusive** selection, is **not** promoted: the segmented control keeps the full-accent fill (a strong, single selected state). `accentMuted` is for **multi-select and pressed** states, where a full fill would over-weight a non-exclusive choice.

### 3.4 Resolved: `type.lineHeight` for multi-line app copy

AOD-20 is where the first multi-line app text lands (onboarding paragraphs, paywall body, a settings description, an input hint, a dialog body). Per [`design-tokens.md`](design-tokens.md) §6.2 / §9 (delta 7), `lineHeight` is added to `type.*` **now**, for the steps that set multi-line copy: `body` → 20, `meta` → 18, `caption` → 16. It stays **inside the narrow `Pick`** (`Pick<TextStyle, ... | 'lineHeight'>`), so it does not reintroduce the deep-style typing problem the AOD-62 note warns about; the numeric / single-line steps (`display` / `hero` / `xl` / `title` / `heading` / `label` / `badge`) get no `lineHeight`. This is a token addition handed to the build (section 12).

## 4. The component tier and elevation in practice

A component token sits in the **component tier**: it carries geometry (numbers) and **role-name aliases**, never a hex, exactly like the shipped `elevation` group (`{ surface: 'surfaceAlt', border: true }`) and the per-widget groups (`weatherIcon` / `sparkline` numbers, colors drawn at the call site). The one layering rule holds: a component group references the **semantic** tier (`accent`, `onAccent`, `focusRing`, `surface`, `border`, `error`, …), and a theme swap re-aliases underneath it.

![The Vela component library on the elevation ladder: a dashed base field, a raised settings panel with rows and a primary button, an overlay popover menu one surface-step up, and a modal over a scrim with the dialog at the overlay level, no shadow anywhere; below, the nine component families, each a chip naming the component and the semantic roles it themes against.](assets/design-component-overview.svg)

<details>
<summary>The set &amp; elevation in practice</summary>

```
elevation.base    : the dashboard field         · background, no border
elevation.raised  : panels · cards · row-groups · surface + 1px border
elevation.overlay : popovers · menus            · surfaceAlt + 1px border
scrim + overlay   : modals · sheets             · scrim over the field + dialog at elevation.overlay

the nine families, each themed against roles (never hex):
  buttons              accent · onAccent · focusRing · error
  inputs / fields      surfaceAlt · border · focusRing · error · textMuted
  toggles · segmented  accent · onAccent · accentMuted · radius.full
  cards · panels · row-groups   surface · border · elevation.raised
  sheets · modals · popovers    scrim · surfaceAlt · elevation.overlay
  skeletons            skeleton · the shimmer sweep
  badges               warning · error · success · accentMuted · type.badge
  lock / PRO overlays  scrim · accentMuted · the Gate fallback seam
reuse, do not redesign: the widget card chrome + lifecycle + empty body (design-widget-system.md)
```
</details>

**Elevation in practice** (the brief's requirement, shown on real surfaces): `base` is the dashboard field; `raised` is every panel, card, and row-group (the settings list, the auth card); `overlay` is a popover or menu, one surface-step up; `scrim + overlay` is a modal or sheet, the `scrim` darkening the field and the dialog placed at `elevation.overlay`. No component draws a shadow, the same flat-ambient rule the card already follows.

## 5. Buttons

Four variants, every state, three sizes. Fills carry `onAccent`; focus draws `focusRing`; text buttons tint with `accentMuted` when pressed.

![Vela buttons in a matrix: columns are primary (accent fill, onAccent text), secondary (border, accent text), ghost (accent text), destructive (error fill, onAccent text); rows are default, pressed, focused with a two-pixel focusRing, disabled at low opacity, and loading with a spinner; below, the three sizes small, medium, large with their height, padding, and type step.](assets/design-component-buttons.svg)

<details>
<summary>Button variants, states, sizes &amp; tokens</summary>

```
variants (fill / label / border, all role refs):
  primary      bg accent       · fg onAccent · no border        (the one primary action per view)
  secondary    bg none         · fg accent   · border border    (a paired alternative, e.g. Cancel)
  ghost        bg none         · fg accent   · no border        (a low-weight action / link)
  destructive  bg error        · fg onAccent · no border        (Disconnect / Remove)
states:
  default   resting
  pressed   fills darken ~12% (an onPress overlay); text buttons (secondary/ghost) → accentMuted bg
  focused   a 2px focusRing offset from the edge (keyboard / switch-control)
  disabled  opacity 0.38; ghost/secondary label → textMuted
  loading   a spinner (onAccent on a fill, accent on a text button) + the label stays; control non-interactive
sizes (height · paddingX · type step):
  sm  32 · spacing(3)=12 · label    md  40 · spacing(4)=16 · body  (default)    lg  48 · spacing(5)=20 · heading
radius: radius.md (a full-pill button uses radius.full). gap icon→label: spacing(2)=8.
component tokens (section 12): button.height/paddingX/gap/radius + the variant role maps + button.pressedTint → accentMuted
```
</details>

**`onAccent` on every fill** is the one reconciliation the build applies: the shipped `primary` uses `colors.background` for its label ([`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx)); the coded `onAccent` role ([AOD-66](https://linear.app/thexap/issue/AOD-66)) is its purpose, so `primary` and `destructive` labels theme against `onAccent`. **`focusRing` is one token**, the same 2px accent ring on every interactive component, so the a11y focus treatment is consistent and lives at one call.

## 6. Inputs

One text field, four states, with the label / placeholder / hint, plus the search-row variant the credential form uses.

![Vela inputs: four text fields showing default (surfaceAlt fill, border), focus (border to focusRing), error (border to error, with an error line), and disabled (low opacity); a search-row variant with a field flexed beside a Search button and a results list on a raised surface; and the border resolution, naming input.border to border, input.borderFocus to focusRing, input.borderError to error, and the row-group divider to border.](assets/design-component-inputs.svg)

<details>
<summary>Input states, the search row &amp; the border resolution</summary>

```
text field (one fill: surfaceAlt; states recolor the BORDER only):
  default   fill surfaceAlt · border input.border (→ border) · value text, placeholder textMuted
  focus     border input.borderFocus (→ focusRing, 1.5px) + a faint focusRing halo
  error     border input.borderError (→ error) + an error line (type.meta, error) below
  disabled  opacity 0.4 · fill surface
label  : type.caption / textMuted, uppercase (the shipped field label)
hint   : type.meta / textMuted, below the field (multi-line uses the new lineHeight, §3.4)
placeholder : textMuted  (replaces the hardcoded #6B7280 / #7A7F8C in the shipped forms)
geometry : height 44 · paddingX spacing(3)=12 · radius.sm (8)
search row : field (flex) + a primary Search button; results in an elevation.raised group, rows split by border
component tokens (section 12): input.height/paddingX/radius + input.border/borderFocus/borderError + rowGroup.divider
```
</details>

The shipped forms each pick a different field fill (`surfaceAlt` in SignIn, `background` in [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), `surface` in [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx)) and hardcode the placeholder hex. The component fixes **one fill** (`surfaceAlt`) and resolves the placeholder to `textMuted`; section 13 hands the drift to the build.

## 7. Toggles, segmented, and selectable pills

The switch replaces the unstyled native `Switch`; the choice controls show the two accents in practice.

![Vela controls: a toggle switch in off (surfaceAlt track, muted knob), on (accent track, onAccent knob), disabled, and focused with a focusRing, the track a radius.full pill; a segmented control filling the chosen segment with the accent and onAccent text; and selectable multi-select pills using the accentMuted fill with an accent border and accent text for chosen items.](assets/design-component-controls.svg)

<details>
<summary>Toggle, segmented, pills &amp; the accentMuted / radius.full resolution</summary>

```
toggle / switch (track is radius.full):
  off       track surfaceAlt + border · knob textMuted (left)
  on        track accent · knob onAccent (right)
  disabled  opacity 0.4      focused  a 2px focusRing around the track
  geometry  track 52×30 · knob r 11 · radius.full
segmented control (EXCLUSIVE choice, the strong selected state):
  group surfaceAlt + border (radius.sm) · selected segment = accent fill + onAccent · others = text on the group
selectable pills (MULTI-SELECT, the soft selected state):
  selected = accentMuted fill + accent border + accent text · unselected = border + text · radius.full
accentMuted = one accent at a low fixed alpha (§3.3): pressed text buttons · selected pills/rows · accent badges · focus halo.
  NOT the widget data alphas (progress 0.18, sparkline 0.5) — those encode data and stay per-widget.
radius.full (9999) is the pill / track end (toggle, pills, count pills, the Current Cycle bar). Buttons/fields/cards keep sm/md/lg.
component tokens (section 12): toggle.* (track/knob role maps + geometry) + segmented.* + pill.* role maps
```
</details>

## 8. Cards, panels, and row-groups

The app chrome reuses the widget card chrome and adds the row-group, the list row, and the auth card. All sit at `elevation.raised`.

![Vela surfaces: a Connections row-group, a raised panel holding five list rows split by border dividers, each with an identity and a trailing affordance (destructive Disconnect, accent Connect or Reconnect, a warning dot, or a muted no-connection-needed); the list-row anatomy with slots for a leading glyph, the identity, and the trailing action; and the auth card used by sign-in, a raised surface at the large radius with the vela wordmark, a field, and a primary button.](assets/design-component-surfaces.svg)

<details>
<summary>Surfaces: card reuse, row-group, list row, auth card &amp; tokens</summary>

```
widget card (REUSED, design-widget-system §4): surface + 1px border · radius.md · padding spacing(3). Not redesigned here.
row-group (the Settings panel): surface + border · radius.md · rows split by rowGroup.divider (→ border)
list row : leading glyph (optional) · identity (title = type.title, subtitle = type.meta/textMuted) · trailing (action · status · chevron)
           row padding spacing(3); the connections list is this row repeated (ConnectionsList.tsx)
auth card (SignIn / paywall panel): surface + border · radius.lg (22) · padding spacing(6) · the wordmark + fields + a primary button
elevation : all at elevation.raised (surface + border); a nested chip / selected row steps to elevation.overlay
component tokens (section 12): card.padding/radius · rowGroup.divider · listRow.padding/gap · authCard.radius/padding
```
</details>

The list row generalizes the shipped [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx) and the Settings rows into one anatomy (leading / identity / trailing), so a settings row, a connection row, and a lock row are one component with different trailing slots.

## 9. Sheets, modals, and popovers

Floating UI is `scrim` + `elevation.overlay`, never a shadow. This is the elevation model's floating answer, shown on the three real overlay shapes.

![Vela overlays: a bottom sheet darkening the dashboard with a scrim and sliding a surfaceAlt sheet up with a grabber handle; a center modal with the same scrim and a centered confirm dialog at the overlay level; and a popover menu with no scrim, anchored to a Theme trigger, listing Dark selected with an accent check, Light, and System.](assets/design-component-overlays.svg)

<details>
<summary>Overlay shapes, the scrim rule &amp; tokens</summary>

```
bottom sheet : scrim over the field + a sheet at elevation.overlay (surfaceAlt) · top corners radius.lg · a grabber handle
               (this is ConfigFormModal.tsx; the build reconciles its hardcoded rgba(0,0,0,0.6) onto the scrim token)
center modal : scrim + a centered dialog at elevation.overlay · radius.lg · title (type.title) + body + button row
popover/menu : elevation.overlay (surfaceAlt + border) · NO scrim (anchored to a known trigger) · items split by border
the rule : floats over arbitrary content → add the fixed scrim (0.60 dark / 0.40 light); an anchored popover does not.
           scrim ≠ the dynamic night `overlay` (design-tokens.md §8.3): scrim is fixed (a floating layer), overlay is dimLevel-driven.
component tokens (section 12): sheet.radius/padding · modal.radius/padding · popover.radius + the scrim/elevation role refs
```
</details>

The bottom sheet is the shipped [`ConfigFormModal.tsx`](../../apps/app/src/widgets/ConfigFormModal.tsx), which hardcodes `rgba(0,0,0,0.6)` for its backdrop and fills the sheet with `background`. The component reconciles both: the backdrop becomes the `scrim` token and the sheet sits at `elevation.overlay` (`surfaceAlt`), so a single token change reskins every sheet.

## 10. Skeletons and badges

The loading skeleton shapes the real layout; the badges reuse the widget status mark and the badge type step.

![Vela feedback: a loading skeleton, a raised panel with a heading bar and three list rows of skeleton-colored shapes with a shimmer band sweeping across; and badges, a status group (warning dot stale, error dot error, success dot up-to-date) in the uppercase badge step, an accent group (PRO and NEW as accentMuted fills with accent text), and a count group (a primary accent pill and neutral surfaceAlt pills).](assets/design-component-feedback.svg)

<details>
<summary>Skeletons, badges &amp; tokens</summary>

```
skeleton : bars in the skeleton role, shaped to the real layout (header + rows), NOT a single bar.
           motion = a slow shimmer sweep (no spinner). Reuses the widget loading-skeleton pattern (design-widget-system §5).
           app-chrome use: a row-group loading, a list before data; replaces the ActivityIndicator placeholders.
badges (type.badge = 10/700/+1/uppercase):
  status : a dot (warning / error / success) + the uppercase label — the widget status mark, reused
  accent : PRO / NEW = accentMuted fill + accent text · radius.full
  count  : accent fill + onAccent (primary) · surfaceAlt + border (neutral) · radius.full
component tokens (section 12): skeleton.* (bar radii + the shimmer) · badge.* role maps (per kind)
```
</details>

## 11. Lock / PRO overlays

The freemium gate affordance is the `Gate` fallback, designed to coordinate with the entitlements component already in code.

![Vela lock overlays: the Gate seam, a normal Kiosk row with an Open action when entitled versus a dimmed lock row with a padlock, muted title, PRO badge, and chevron when not; a locked premium tile with the preview under a scrim, a padlock, a Pro feature line, and an Upgrade button; and the lock-row anatomy with callouts and the Gate code reference.](assets/design-component-pro-lock.svg)

<details>
<summary>The lock affordances, the Gate seam &amp; tokens</summary>

```
the Gate (apps/app/src/entitlements/Gate.tsx): <Gate feature fallback={<LockRow/>}>children</Gate>.
  entitled → render children (a normal control). not entitled → render the fallback (a lock). UX-only; server still enforces.
lock row : leading padlock glyph (textMuted) · title → textMuted · a PRO badge (accentMuted) · trailing chevron → paywall.
           dimmed; never an enabled gated control. (Replaces the plain "Kiosk Mode (Pro, locked)" text in Settings.tsx.)
locked tile : a premium pick in a picker — the preview under a scrim, a centered padlock (text), a "Pro feature" line, an Upgrade primary button.
glyphs : the padlock + chevron extend the shared chrome glyph family (glyphs.tsx): ~1.7 stroke, round caps. Per-component, no new token.
component tokens (section 12): lockRow.* role maps (it is a list-row variant) + the PRO badge (accentMuted) + the tile scrim ref
```
</details>

**The defining rule is the same one the `Gate` enforces:** the lock is **UX-only**. It routes to the paywall and never performs the gated mutation; the server refuses an over-limit request regardless of what the UI shows. The component never renders the gated control in an enabled-but-trapped state, it renders the lock instead. The full **paywall screen** is a per-screen design ([AOD-29](https://linear.app/thexap/issue/AOD-29)); AOD-20 owns only the lock affordance and the upgrade entry point.

## 12. Component-scoped token additions (the §9 analog)

The components add **component-scoped token groups** under the component tier, each carrying geometry plus role-name aliases, the way `weatherIcon` / `sparkline` / `progress` did. These are **specified here, not coded**; the DS-M2 build adds them to [`unistyles.ts`](../../apps/app/unistyles.ts). Plus the two cross-cutting additions the forks resolved (`accentMuted` semantic, `type.lineHeight`).

| # | Addition | Kind | What it aliases / carries |
|---|---|---|---|
| 1 | `accentMuted` (semantic) | **Additive, surfaced (3.3).** One accent at a low fixed alpha. | A new semantic role: the accent at ~0.14 (dark) / ~0.12 (light). No new hue. |
| 2 | `type.lineHeight` on `body` / `meta` / `caption` | **Additive, resolved (3.4).** Inside the narrow `Pick`. | `body` 20, `meta` 18, `caption` 16; other steps unchanged. |
| 3 | `button` group | **Additive (component).** | `height`/`paddingX` per size · `gap` · `radius` (md) · the four variant role maps (`bg`/`fg`/`border`) · `pressedTint → accentMuted`. |
| 4 | `input` group | **Additive (component).** | `height` · `paddingX` · `radius` (sm) · `border → border` · `borderFocus → focusRing` · `borderError → error` · `placeholder → textMuted`. |
| 5 | `toggle` group | **Additive (component).** | track / knob role maps (`on`: accent / onAccent; `off`: surfaceAlt / textMuted) · geometry · `radius.full`. |
| 6 | `segmented` + `pill` groups | **Additive (component).** | segmented: selected `accent`/`onAccent`; pill: selected `accentMuted` + accent border/text · `radius.full`. |
| 7 | `rowGroup` + `listRow` + `card` + `authCard` groups | **Additive (component).** | `divider → border` · row padding/gap · `card.radius → radius.md` · `authCard.radius → radius.lg`, paddings on the spacing rungs. |
| 8 | `sheet` + `modal` + `popover` groups | **Additive (component).** | `scrim` + `elevation.overlay` refs · `sheet`/`modal.radius → radius.lg` · `popover.radius → radius.md`. |
| 9 | `skeleton` (component) + `badge` groups | **Additive (component).** | skeleton bar radii + the shimmer; badge per-kind role maps (status dot colors, count fill, PRO = accentMuted) on `type.badge`. |
| 10 | `lockRow` group | **Additive (component).** | a `listRow` variant: title `textMuted`, the padlock glyph, the PRO `accentMuted` badge, the scrim on the locked tile. |

Typing safety, carried from the AOD-62 build note (`aod-unistyles-style-token-gotcha`): the component groups are numbers + role-name strings (plain, Unistyles-safe, like `elevation`); the **only** typing trap is `type.*`, and `type.lineHeight` (addition 2) stays inside the narrow `TypeToken` `Pick`, so it does not reintroduce the deep-style flood.

## 13. Deltas to the shipped chrome (the reconciliation handoff)

The components are a **canonicalization** of the shipped chrome. Each drift the unpolished screens carry is listed here for the implementing `type:tech-task`. None changes a token **value**; they align call sites to the coded roles and the new component groups.

| # | Drift today | Reconciliation |
|---|---|---|
| 1 | `primary` / `ConfigForm` submit label uses `colors.background` on the accent fill. | Theme against `onAccent` (its purpose). The fill is unchanged. |
| 2 | Three different field fills: `surfaceAlt` (SignIn), `background` (CredentialForm), `surface` (ConfigForm). | One fill: `surfaceAlt`, via the `input` group. |
| 3 | Hardcoded placeholder hex `#6B7280` / `#7A7F8C`. | `input.placeholder → textMuted`. |
| 4 | `ConfigFormModal` backdrop hardcodes `rgba(0,0,0,0.6)`; the sheet fills with `background`. | Backdrop → the `scrim` token; sheet → `elevation.overlay` (`surfaceAlt`). |
| 5 | The native unstyled `Switch` in `ConfigForm`. | The designed `toggle` (radius.full, accent on-track, onAccent knob, focusRing). |
| 6 | Ad-hoc font sizes (Settings title 24/800, SignIn brand 32, row 15/16). | The `type.*` steps (`title` / `heading` / `body`); the wordmark per [`design-brand.md`](design-brand.md). |
| 7 | The plain "Kiosk Mode (Pro, locked)" text fallback in `Settings.tsx`. | The designed `lockRow` (padlock, PRO badge, chevron → paywall). |
| 8 | `ActivityIndicator` placeholders for loading. | The `skeleton` component (shaped shimmer rows). |

These are **build** items (the DS-M2 `type:tech-task`), not this design's edits; this design fixes the target, the build moves the call sites.

## 14. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| **The component build** (add the component groups + `accentMuted` + `type.lineHeight` to [`unistyles.ts`](../../apps/app/unistyles.ts); build the components; reconcile section 13) | a DS-M2 `type:tech-task` | The components, their states, and every token alias are fixed here (sections 5 to 12); the build implements them. |
| **The core screens** (Settings, SignIn, onboarding) | [AOD-21](https://linear.app/thexap/issue/AOD-21) / [AOD-27](https://linear.app/thexap/issue/AOD-27) / [AOD-28](https://linear.app/thexap/issue/AOD-28) | They **compose** these components (the row-group, fields, buttons, sheets); the components are not redesigned per screen. |
| **The paywall screen** and the upgrade flow | [AOD-29](https://linear.app/thexap/issue/AOD-29) | AOD-20 owns only the lock affordance and the upgrade entry point (section 11); the paywall layout and the RevenueCat flow are theirs. |
| **The per-feature designs** (INT connection screens, BIL billing, KIO kiosk settings) | their DS-M2 / feature issues | They apply this set; any feature-specific component is specified there, the §3 way. |
| **The kiosk wall presentation** | [AOD-39](https://linear.app/thexap/issue/AOD-39) (K-M1) | A presentation profile over a layout; it themes against the same roles, not these app-chrome components. |
| **Motion** (the button press, the sheet slide, the skeleton shimmer rate, the toggle throw) | the DS-M2 build | Named (a press overlay, a slide-up, a slow shimmer); exact timings are a build refinement, not a token. |
| **A data-table / multi-column component** | future | Not needed by the v1 app-chrome surfaces (lists cover them); specified when a screen needs it. |
| **Dark/light parity polish** | the build | The components are defined in role terms, so light is a re-alias, not a redraw (the §3 layering rule). |

## 15. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. **The structural forks are surfaced and recommended** (section 3): the **button taxonomy** (primary / secondary / ghost / destructive + sm/md/lg), the **input border treatment** (component-scoped, no semantic fork), the **`accentMuted` promotion** (one shared low-accent surface, recommended), and the **`type.lineHeight`** resolution (added to body/meta/caption, inside the narrow `Pick`).
> 2. **The component tier and elevation in practice are fixed** (section 4; `design-component-overview.svg`): component groups carry geometry + role-name aliases (never hex), and `base` / `raised` / `overlay` / `scrim + overlay` are shown on real app surfaces.
> 3. **Buttons** are fixed (section 5; `design-component-buttons.svg`): four variants × default / pressed / focused / disabled / loading × three sizes, `onAccent` on fills, `focusRing` shared.
> 4. **Inputs** are fixed (section 6; `design-component-inputs.svg`): the text field states (default / focus / error / disabled), one `surfaceAlt` fill, `placeholder → textMuted`, the search-row variant, and the resolved border aliases.
> 5. **Toggles, segmented, and selectable pills** are fixed (section 7; `design-component-controls.svg`): the switch on `radius.full`, the full-accent segmented control, and the `accentMuted` multi-select pills.
> 6. **Surfaces** are fixed (section 8; `design-component-surfaces.svg`): the widget card **reused**, plus the row-group, the list row, and the auth card, all at `elevation.raised`.
> 7. **Overlays** are fixed (section 9; `design-component-overlays.svg`): sheets / modals / popovers as `scrim` + `elevation.overlay`, no shadow, with `ConfigFormModal` reconciled onto the `scrim` token.
> 8. **Skeletons, badges, and the lock/PRO overlay** are fixed (sections 10, 11; `design-component-feedback.svg`, `design-component-pro-lock.svg`): the shaped skeleton + shimmer, the status / PRO / count badges, and the lock affordance that **coordinates with the `Gate`** (UX-only, server-enforced).
> 9. **The work is handed forward** (sections 12 to 14): the component-scoped token additions + `accentMuted` + `type.lineHeight` are listed for the DS-M2 build; the reconciliation deltas are named; the screens and per-feature designs **compose** this set; no code is changed. The **eight specimens render** in the house dark style.

| Acceptance clause | Where |
|---|---|
| Structural forks: button taxonomy, input border, accentMuted, lineHeight | Section 3 |
| Component tier + elevation in practice | Section 4; `design-component-overview.svg` |
| Buttons: variants, states, sizes, onAccent, focusRing | Section 5; `design-component-buttons.svg` |
| Inputs: states, one fill, placeholder, search row, border aliases | Section 6; `design-component-inputs.svg` |
| Toggles / segmented / pills: radius.full, accentMuted | Section 7; `design-component-controls.svg` |
| Surfaces: card reuse, row-group, list row, auth card | Section 8; `design-component-surfaces.svg` |
| Overlays: scrim + elevation.overlay, the three shapes | Section 9; `design-component-overlays.svg` |
| Skeletons + badges | Section 10; `design-component-feedback.svg` |
| Lock / PRO overlay coordinated with the Gate | Section 11; `design-component-pro-lock.svg` |
| Component token additions; reconciliation deltas; seams | Sections 12, 13, 14 |

## 16. References

- [AOD-20](https://linear.app/thexap/issue/AOD-20): this design's tracking issue (`type:design`, `area:design-system`; milestone DS-M2 "Components & Core Screens", project Design System).
- [AOD-19](https://linear.app/thexap/issue/AOD-19) ([`design-tokens.md`](design-tokens.md)): the token system this themes against. §10 names AOD-20 as the component-token consumer; §11 hands the `accentMuted` / `divider`/`inputBorder` / `lineHeight` candidates here. The direct upstream.
- [AOD-66](https://linear.app/thexap/issue/AOD-66) (PR #31, Done): reconciled the AOD-19 tokens into [`unistyles.ts`](../../apps/app/unistyles.ts), so the components theme against **real coded roles** (`onAccent` / `focusRing` / `scrim` / `elevation` / `radius.full`).
- [AOD-37](https://linear.app/thexap/issue/AOD-37) ([`design-widget-system.md`](design-widget-system.md)): the widget visual system this parallels for app chrome; §4 the card chrome, §5 the lifecycle states, §5.1 the empty body, all **reused** not redesigned. Built by [AOD-62](https://linear.app/thexap/issue/AOD-62).
- [AOD-18](https://linear.app/thexap/issue/AOD-18) ([`design-brand.md`](design-brand.md)): the one-accent rule, the voice, and the wordmark the components keep.
- [AOD-21](https://linear.app/thexap/issue/AOD-21) / [AOD-27](https://linear.app/thexap/issue/AOD-27) / [AOD-28](https://linear.app/thexap/issue/AOD-28) / [AOD-29](https://linear.app/thexap/issue/AOD-29): the core-screen and per-feature designs that compose this set (section 14). Blocked by this.
- [AOD-39](https://linear.app/thexap/issue/AOD-39): the kiosk wall presentation; themes against the same roles, not these app-chrome components.
- The shipped chrome this canonicalizes: [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx), [`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx), [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx), [`ConfigFormModal.tsx`](../../apps/app/src/widgets/ConfigFormModal.tsx), [`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx), [`EmptyBody.tsx`](../../apps/app/src/widgets/EmptyBody.tsx), [`glyphs.tsx`](../../apps/app/src/widgets/glyphs.tsx).
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
- Assets: [`design-component-overview.svg`](assets/design-component-overview.svg), [`design-component-buttons.svg`](assets/design-component-buttons.svg), [`design-component-inputs.svg`](assets/design-component-inputs.svg), [`design-component-controls.svg`](assets/design-component-controls.svg), [`design-component-surfaces.svg`](assets/design-component-surfaces.svg), [`design-component-overlays.svg`](assets/design-component-overlays.svg), [`design-component-feedback.svg`](assets/design-component-feedback.svg), [`design-component-pro-lock.svg`](assets/design-component-pro-lock.svg).
