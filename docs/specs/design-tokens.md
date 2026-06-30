# Design: Vela design tokens (color, type, spacing, elevation, dark theme)

> Status: draft for review, 2026-06-29. Tracked by [AOD-19](https://linear.app/thexap/issue/AOD-19) (`type:design`, `area:design-system`; milestone DS-M1 "Brand & Tokens", project Design System). The **second deliverable in the Design System track**, the direct downstream of the brand identity ([AOD-18](https://linear.app/thexap/issue/AOD-18), PR #29, Done): [`design-brand.md`](design-brand.md) §5 / §6 / §8 adopted the shipped palette and type verbatim as the brand and **explicitly handed their formalization to this issue**. It follows the `type:design` deliverable convention in [`engineering-process.md`](../engineering-process.md): a `design-` doc under `docs/specs/` plus rendered SVG specimens in `docs/specs/assets/`, tokens **specified** (not written into [`unistyles.ts`](../../apps/app/unistyles.ts)), merged via PR.
>
> **It supersedes the issue's original "Produce (Figma)" wording.** AOD-19 was written before [AOD-37](https://linear.app/thexap/issue/AOD-37) set the repo's `type:design` convention (a `design-` doc + rendered SVGs in-repo, not a Figma file). This deliverable follows that established convention, the same one the brand identity and all four widget designs used; Figma is not part of this repo's design flow. No scope change, only the medium.
>
> **Design-first, surfaced for approval.** Two structural forks shape the whole system, so both were surfaced before anything was finalized (2026-06-29): **(1) how deep the primitive -> semantic -> component layering goes**, and **(2) the elevation treatment**. Approved: **a full three-tier color structure coded into the theme** (a primitive ramp, semantic roles that alias it, component groups that reference the semantics), and **surface-step elevation plus a scrim for floating UI** (no shadows). Section 3 records both.
>
> **Consistency is the hard constraint.** The app already ships a working token theme in [`unistyles.ts`](../../apps/app/unistyles.ts) (the [AOD-37](https://linear.app/thexap/issue/AOD-37) / [AOD-62](https://linear.app/thexap/issue/AOD-62) widget-era tokens, plus the four per-widget builds [AOD-63](https://linear.app/thexap/issue/AOD-63) / [AOD-64](https://linear.app/thexap/issue/AOD-64) / [AOD-65](https://linear.app/thexap/issue/AOD-65)). This design treats **every shipped value as a locked input it canonicalizes, not reinvents.** No shipped color, type step, spacing unit, or radius changes value. The one-accent rule holds; **no new hue is introduced.** Where AOD-19 adds an app-wide token not yet shipped (elevation, the floating scrim, `onAccent`, `focusRing`, `radius.full`, the rationalized full spacing/radius scale) it is **flagged additive** (section 9). The single change to a shipped value's **shape** (the color roles become aliases that resolve to named primitives, same resolved hex) is flagged as a **value-preserving structural delta** handed to the implementing `type:tech-task` (section 9). This design specifies the tokens; it does **not** edit [`unistyles.ts`](../../apps/app/unistyles.ts).

## 1. Purpose and scope

[`design-brand.md`](design-brand.md) fixed the Vela identity and, in §5.3 / §6.2 / §10, handed the **formalization of the palette and type as design tokens** to this issue. AOD-19 is that work: the **canonical token system the whole app themes from**, named once so the component library ([AOD-20](https://linear.app/thexap/issue/AOD-20)) and the kiosk wall presentation ([AOD-39](https://linear.app/thexap/issue/AOD-39)) theme against **stable role names, not raw hex**. It is the gating upstream of the rest of the Design System track.

It fixes exactly six things:

1. **The token taxonomy** (section 3): how tokens are layered and named (primitive -> semantic -> component for color; single scales with role mappings for type / spacing / radius), matched to the shipped Unistyles theme shape, with the one layering rule that keeps the system themeable.
2. **Color** (section 4): the primitive ramps (neutral, blue, the three status hues, the ambient-night embers), the **dark (primary)** and **light** semantic roles expressed as aliases of those primitives, the new app-wide semantic additions, and the ambient-night group, all preserving the shipped values verbatim and the one-accent rule.
3. **Elevation** (section 5): the approved **surface-step ladder** (a fill step plus a hairline border, never a drop shadow) and the **scrim** for genuinely floating UI, consistent with the flat ambient look ([`design-widget-system.md`](design-widget-system.md) §4.1).
4. **Type** (section 6): the `type.*` scale formalized verbatim as the **app-wide** type system (not just widgets), with the narrow style-token constraint that keeps the theme typing clean, and the one candidate field flagged for app text.
5. **Spacing and radius** (section 7): the 4px-base spacing scale rationalized into canonical rungs with roles, and the radius scale formalized (`sm` / `md` / `lg` verbatim, `full` added for pills).
6. **The dim / night ambient variant** (section 8): the `overlay` dim token and the deep-red `night.*` group as the ambient variant tier, consuming the `phase` / `dimLevel` signal the kiosk runtime ([AOD-11](https://linear.app/thexap/issue/AOD-11) §8) produces, with the scrim-vs-overlay distinction drawn.

**In scope:** the canonical taxonomy and the four token axes (color, type, spacing/radius, elevation) plus the ambient variant, specified as a consistent **superset** of the shipped theme, with every delta to a shipped value flagged (section 9) and the seam to AOD-20 / AOD-39 shown (section 10).

**Out of scope (named so the frame is clear):** see section 11. In short: editing [`unistyles.ts`](../../apps/app/unistyles.ts) or any code (the implementing `type:tech-task`); the component library and its component-scoped tokens ([AOD-20](https://linear.app/thexap/issue/AOD-20)); the kiosk wall presentation design ([AOD-39](https://linear.app/thexap/issue/AOD-39)); app navigation / screens ([AOD-17](https://linear.app/thexap/issue/AOD-17) / [AOD-21](https://linear.app/thexap/issue/AOD-21) / [AOD-27](https://linear.app/thexap/issue/AOD-27) / [AOD-28](https://linear.app/thexap/issue/AOD-28) / [AOD-29](https://linear.app/thexap/issue/AOD-29)); store assets ([AOD-42](https://linear.app/thexap/issue/AOD-42)); re-deciding the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18), Done) or the styling engine ([AOD-16](https://linear.app/thexap/issue/AOD-16), Done, Option C / Unistyles v3); and restyling the widgets.

## 2. Locked context this builds on

| Source | What it locks | How this design uses it |
|---|---|---|
| [`unistyles.ts`](../../apps/app/unistyles.ts) | The **shipped tokens**: dark + light `colors.*` (background / surface / surfaceAlt / border / text / textMuted / accent / skeleton / warning / error / success), the `type.*` scale, the deep-red `night.*` palette, `overlay`, `dot`, `clockSize`, `spacing(n)=n*4`, `radius {sm,md,lg}`, and the per-widget groups (`weatherIcon` / `sparkline` / `money` / `priorityIcon` / `progress`). | Sections 4 to 8 canonicalize **every one of these verbatim**. No value changes. The color roles are re-expressed as aliases of named primitives (section 9, value-preserving). |
| [`design-brand.md`](design-brand.md) §5 / §6 / §8 | The palette and `type.*` **adopted verbatim** as the brand, the **single-accent** rule (one accent per theme, no new base color), dark-first, and the explicit hand-off of formalization to AOD-19 (§5.3 / §6.2 / §10). | This design **is** that formalization. It keeps the one-accent rule and introduces no hue (section 4.6). |
| [`design-widget-system.md`](design-widget-system.md) §3 | The three visual rules (the value dominates, the chrome recedes, night is first-class), the token foundation (`type.*`, `night.*`, `overlay`, `dot`, `clockSize`), and the one-accent rule. | Section 4 generalizes the foundation app-wide; section 6 reuses the type scale; section 8 reuses `overlay` + `night.*`. |
| [`design-widget-system.md`](design-widget-system.md) §4.1 | The card is **flat: border-defined, no shadow** (shadows read as glare on an ambient display). | Section 5 derives elevation as **surface-step + border + scrim**, never a drop shadow. The approved structural choice. |
| [`design-widget-system.md`](design-widget-system.md) §7 / [AOD-11](https://linear.app/thexap/issue/AOD-11) §8 | The day/night dim: the `overlay` default (`dimsWithAmbient: true`), the `useAmbient()` opt-in, the deep-red night, all consuming `AmbientContext { phase, dimLevel }` from the kiosk curve (`computeAmbient`). | Section 8 canonicalizes `overlay` + `night.*` as the ambient variant tier; it **consumes** the signal and does not build the schedule. |
| [AOD-16](https://linear.app/thexap/issue/AOD-16) (Done) / [`product-vision.md`](product-vision.md) | The styling engine is **Option C, a token/theme engine** (react-native-unistyles v3): one typed theme the chrome and leaves style against. The "calm ambient surface" pitch. | Section 3 picks a taxonomy that **matches the Unistyles theme shape** (a typed object spread into per-theme variants), not a parallel system. |
| [`engineering-process.md`](../engineering-process.md) | The `type:design` deliverable convention (a `design-` doc + SVG specimens, tokens specified not coded, merged via PR) and the chain decision -> spec -> design -> tech-task. | This deliverable follows it; sections 9 and 11 hand the reconciliation to a `type:tech-task`. |
| The `aod-unistyles-style-token-gotcha` build note (AOD-62, PR #24) | **Do not put a full `TextStyle` in the theme**: the `type.*` token is narrowed to `Pick<TextStyle, 'fontSize'\|'fontWeight'\|'letterSpacing'\|'fontVariant'\|'textTransform'>`, or Unistyles' deep-style typing floods `tsc`. `night` / `overlay` / `dot` / `clockSize` are plain strings/numbers and are fine. | Section 6 **preserves** the narrow `TypeToken`; section 9 notes the primitive/semantic strings are safe and the `lineHeight` candidate stays inside the `Pick`. |

What is already true, and what this adds: the product already **themes** correctly (a single Unistyles theme, dark default + light, the chrome and leaves reading `theme.*`). This design does not change how theming works or what anything looks like. It **names the structure** the shipped tokens already imply, adds the app-wide tokens a component library and a kiosk surface will need (elevation, a scrim, the rationalized scales), and writes the whole set down once as the canonical contract AOD-20 and AOD-39 build against.

## 3. The token taxonomy (the structure)

A token system is only useful if every surface references the **same stable names** and a theme swap changes values in **one place**. The shipped theme already half-does this: `colors.*`, `type.*`, `spacing`, `radius` are role-ish names, and the per-widget groups (`weatherIcon`, `sparkline`, ...) are component-scoped. AOD-19 makes the structure explicit and complete.

![The Vela color token taxonomy: a row of primitive ramps (neutral, blue, the three status hues, the ambient-night embers), a dark semantic column and a light semantic column whose roles each alias a primitive step, and a component row showing the per-widget groups that reference only the semantic roles, with the one layering rule that a tier may only reference the tier below it.](assets/design-tokens-color.svg)

### 3.1 Three tiers (the approved structure)

The approved choice is a **full three-tier color structure coded into the theme**:

| Tier | What it is | Examples | May reference |
|---|---|---|---|
| **Primitive** | Raw, role-free values. The palette's vocabulary. Theme-independent. | `neutral.900` `#0B0B0F`, `blue.400` `#6E8BFF`, `ember.500` `#C2362B` | nothing (literals) |
| **Semantic** | A role mapped to a primitive. The **only tier code references for color.** Theme-scoped (dark / light pick different primitives). | `background -> neutral.900`, `accent -> blue.400`, `text -> neutral.100` | a primitive |
| **Component** | A widget- or component-scoped group. Sizes / intensities, and the semantic colors it draws with. | `progress`, `sparkline`, `weatherIcon`, and future `button` / `input` (AOD-20) | a semantic token |

**The one layering rule:** a tier may only reference the tier **below** it. A component never reaches past the semantic layer to a primitive; a semantic role never hard-codes a hex. This is what makes the theme swappable: change a primitive and every semantic role that aliases it updates; change a semantic role's alias (dark vs light) and every component that uses it follows. It is also the rule that keeps a future theme (a third "high-contrast" variant, say) a matter of re-aliasing, not a rewrite.

### 3.2 Why full depth for color, single scales elsewhere

The three-tier depth is applied to **color**, where it earns its keep: color is the axis a theme swaps (dark / light / ambient-night), so the primitive-vs-role split is what a swap pivots on. The other axes are **single scales with role mappings**, not three tiers, because they have no meaningful primitive-vs-semantic split:

- **Type:** a step *is* its value (`hero` = 44/700). The scale is the vocabulary; roles map to steps ("a primary button label uses `label`"). Section 6.
- **Spacing:** the unit *is* the value (`spacing(3)` = 12). One 4px-base scale; roles name the common rungs. Section 7.
- **Radius:** `md` *is* 14. One scale; roles map to it. Section 7.
- **Elevation:** a derived semantic ladder (which surface role + border), not a new primitive. Section 5.

Forcing a primitive tier onto type or spacing would be ceremony with no swap to justify it, the over-engineering the brief warns against. Applying it to color (and to the ambient-night embers) is where a theme actually pivots. This is the deliberate reading of "full three-tier in the theme": full depth where a theme swaps (color), a single scale where it does not.

### 3.3 How it maps to the Unistyles shape

The structure fits the shipped Unistyles theme shape (a typed object spread into per-theme variants) with no parallel system. The proposed shape, **specified here, not written into [`unistyles.ts`](../../apps/app/unistyles.ts)** (that is the tech-task, section 9):

```typescript
// TIER 1 - primitive: theme-independent, shared (the way sharedTokens is shared today).
const primitive = {
  neutral: { 0:'#FFFFFF', 50:'#F6F6FA', 100:'#F4F4F8', 200:'#EEEEF3', 300:'#E4E4EC',
             400:'#DADAE2', 500:'#9B9BA8', 600:'#6B6B78', 700:'#2A2A36', 750:'#23232E',
             800:'#1F1F29', 850:'#16161D', 900:'#0B0B0F', 950:'#000000' },
  blue:  { 400:'#6E8BFF', 600:'#3F5BD6' },          // the one accent, two theme steps
  amber: { 400:'#F2B84B', 600:'#B5791B' },          // status: warning
  red:   { 400:'#FF6B6B', 600:'#D64545' },          // status: error
  green: { 400:'#4CB782', 600:'#2F8F63' },          // status: success
  ember: { 500:'#C2362B', 600:'#8A201B', 700:'#5E1714',
           850:'#2E1214', 900:'#140709', 950:'#0A0506' }, // ambient-night reds
} as const;

// TIER 2 - semantic: roles alias primitives. Values identical to today; only the source changes.
const darkColors = {
  background: primitive.neutral[900],  surface: primitive.neutral[850],
  surfaceAlt: primitive.neutral[800],  border:  primitive.neutral[700],
  skeleton:   primitive.neutral[750],  textMuted: primitive.neutral[500],
  text:       primitive.neutral[100],  accent:  primitive.blue[400],
  warning: primitive.amber[400], error: primitive.red[400], success: primitive.green[400],
  // additive (section 4.4): onAccent, scrim, focusRing
};
// lightColors aliases the light steps (section 4.3); night.* aliases ember.* (section 8).
```

The renderers and chrome keep reading `theme.colors.accent`, `theme.type.hero`, `theme.spacing(3)` exactly as today. Only the **internal source** of a color value moves from a literal to `primitive.*`. Nothing downstream of `theme.colors.*` changes.

## 4. Color

The color system is the shipped palette, formalized into the three tiers. **No value changes; no hue is added.**

### 4.1 Primitive ramps

Six ramps. Every shipped color value has exactly one primitive home, and every primitive maps to at least one semantic role (no orphan primitives).

| Ramp | Steps (verbatim) | Role family |
|---|---|---|
| `neutral` | `0` #FFFFFF · `50` #F6F6FA · `100` #F4F4F8 · `200` #EEEEF3 · `300` #E4E4EC · `400` #DADAE2 · `500` #9B9BA8 · `600` #6B6B78 · `700` #2A2A36 · `750` #23232E · `800` #1F1F29 · `850` #16161D · `900` #0B0B0F · `950` #000000 | Surfaces, borders, text, the scrim/overlay black. |
| `blue` | `400` #6E8BFF · `600` #3F5BD6 | The one accent (dark / light). |
| `amber` | `400` #F2B84B · `600` #B5791B | Status: warning (stale). |
| `red` | `400` #FF6B6B · `600` #D64545 | Status: error. |
| `green` | `400` #4CB782 · `600` #2F8F63 | Status: success (within-floor confirm). |
| `ember` | `500` #C2362B · `600` #8A201B · `700` #5E1714 · `850` #2E1214 · `900` #140709 · `950` #0A0506 | Ambient-night (deep red), theme-independent. |

The `neutral` ramp is deliberately **denser at the dark end** (the steps `700`-`900` are the packed ambient surface ladder, surface / surfaceAlt / skeleton / border, deliberately close so they separate by a hairline border, not a big jump, section 5). The half-steps `750` / `850` are honest about that packing; the lighter rungs are sparser. Step numbering follows the convention "lower = lighter, higher = darker," so the dark theme reads from the high end and the light theme from the low end.

### 4.2 Semantic roles, dark (primary)

Dark is the canonical ambient surface ([`design-brand.md`](design-brand.md) §5.2). Each role is one alias; the justification is why that step.

| Role | Alias | Value | Justification |
|---|---|---|---|
| `background` | `neutral.900` | #0B0B0F | The near-black field behind the cards. The darkest surface; everything else is a step up from it. |
| `surface` | `neutral.850` | #16161D | The card fill, one hairline step above the field so the card reads as a lit panel. |
| `surfaceAlt` | `neutral.800` | #1F1F29 | A raised surface (a nested chip, a selected row, a popover body): one further step. The elevation ladder (section 5). |
| `border` | `neutral.700` | #2A2A36 | The 1px card edge. Defines the card without a shadow (§4.1). |
| `skeleton` | `neutral.750` | #23232E | The loading shimmer, between surfaceAlt and border so it reads as "content pending," not a real surface. |
| `textMuted` | `neutral.500` | #9B9BA8 | The receding chrome (titles, labels, meta). Quiet against the value. |
| `text` | `neutral.100` | #F4F4F8 | The hero value and primary text. The brightest element; the value dominates (§3). |
| `accent` | `blue.400` | #6E8BFF | The one accent: actions, the in-flight refresh, a card's one highlighted figure. Reads as starlight on the field (the brand mark, [`design-brand.md`](design-brand.md) §3). |
| `warning` / `error` / `success` | `amber.400` / `red.400` / `green.400` | #F2B84B / #FF6B6B / #4CB782 | The status dot and badge only. **Reserved, never brand color** (§4.6). |

### 4.3 Semantic roles, light (foreground variant)

The light theme is the foreground-app variant (daylight use, the store on white). Same role names, aliasing the low end of `neutral` and the deeper `blue.600`.

| Role | Alias | Value |
|---|---|---|
| `background` | `neutral.50` | #F6F6FA |
| `surface` | `neutral.0` | #FFFFFF |
| `surfaceAlt` | `neutral.200` | #EEEEF3 |
| `border` | `neutral.400` | #DADAE2 |
| `skeleton` | `neutral.300` | #E4E4EC |
| `textMuted` | `neutral.600` | #6B6B78 |
| `text` | `neutral.850` | #16161D |
| `accent` | `blue.600` | #3F5BD6 |
| `warning` / `error` / `success` | `amber.600` / `red.600` / `green.600` | #B5791B / #D64545 / #2F8F63 |

Note the deliberate reuse: light `text` and dark `surface` are the same primitive (`neutral.850` #16161D). The themes are two readings of one neutral ramp from opposite ends, which is why a single primitive ramp serves both.

### 4.4 New app-wide semantic additions (flagged additive)

A component library needs a handful of roles the widget era never required. Each is **derived from an existing primitive (no new hue)** and is the minimal app-wide set; component-scoped tokens (button fills, input states) are handed to AOD-20 (section 10).

| New role | Value (dark / light) | Why it is needed now |
|---|---|---|
| `onAccent` | `neutral.0` #FFFFFF / #FFFFFF | The text/icon color **on** an accent fill (a primary button label, a selected pill). The moment a filled accent control exists, it needs a legible foreground; white clears WCAG AA on both `blue.400` and `blue.600`. |
| `scrim` | `neutral.950` @ 0.60 / @ 0.40 | The backdrop **behind a floating surface** (a modal, sheet, or menu), darkening the dashboard so the floating layer reads as above it. The elevation "floating" answer (section 5). Distinct from `overlay` (section 8). |
| `focusRing` | `accent` (aliases `blue.400` / `blue.600`) | A consistent keyboard / switch-control focus indicator. Names the role so an a11y focus ring is one token; aliases `accent` today, free to diverge to a higher-contrast value later without touching call sites. |

Two intentional non-additions, recorded so a later build does not re-mint them:

- **Low-emphasis accent** stays the **"one accent at multiple intensities via alpha"** idiom the widgets already use (`progress` track = accent @ 0.18, `sparkline` past = accent @ 0.5), not a new `accentMuted` token. The two intensities differ by purpose; a single token would force one value. If AOD-20 finds a genuinely shared low-accent surface, it promotes one `accentMuted` then, the section 3 way.
- **`divider` / `inputBorder`** default to `border`. They are named here as candidate aliases only; AOD-20 splits them from `border` if and when a component needs a distinct value.

### 4.5 The ambient-night semantic group

The deep-red `night.*` group (the Clock's `useAmbient()` opt-in, section 8) is a **semantic group** that aliases the `ember` primitives, kept verbatim under its shipped names so the Clock code is untouched.

| Role | Alias | Value |
|---|---|---|
| `night.bg` | `ember.950` | #0A0506 |
| `night.surface` | `ember.900` | #140709 |
| `night.border` | `ember.850` | #2E1214 |
| `night.primary` | `ember.500` | #C2362B |
| `night.secondary` | `ember.600` | #8A201B |
| `night.muted` | `ember.700` | #5E1714 |

### 4.6 The one-accent rule holds; no new hue

The single most identity-defining choice is restraint: **one accent per theme** on a near-black field, with the status hues reserved for the lifecycle dot and badge ([`design-widget-system.md`](design-widget-system.md) §3.1, [`design-brand.md`](design-brand.md) §5.1). This design keeps it exactly. The primitive ramps add **no hue** the shipped theme did not have: `blue` is the one accent, `amber` / `red` / `green` are the three reserved status hues, `ember` is the existing ambient-night red, and `neutral` is greyscale. There is no brand secondary, no gradient, no rainbow. Naming the primitives does not loosen the rule; it makes "there is exactly one accent ramp" visible in the structure.

## 5. Elevation

The approved treatment is **surface-step plus a scrim, never a drop shadow.**

![The Vela elevation model without shadows: a base field, a raised card one surface-step above it with a hairline border, and a level-two raised surface for popovers and menus, then a floating modal shown as a scrim darkening the field behind a level-two surface, contrasted with a crossed-out drop shadow labeled "reads as glare on an emissive display."](assets/design-tokens-elevation.svg)

### 5.1 Why no shadows

A drop shadow is a daylight-paper metaphor: it implies a light source and an object casting onto a page. Vela is an **emissive ambient display**, often a wall or shelf in a dim room, where the surface itself is the light. A shadow on an emissive panel reads as glare or smudge, not depth, and it fights the "field of points of light" concept the brand is built on ([`design-widget-system.md`](design-widget-system.md) §4.1, [`design-brand.md`](design-brand.md) §3). So elevation is expressed the way the shipped theme already implies it: a **step in surface fill plus a hairline border.**

### 5.2 The surface-step ladder

The shipped `background -> surface -> surfaceAlt` ladder **is** the elevation system, now named. Elevation is a semantic ladder mapping a level to a surface role plus its border (it adds no color):

| Level | Role | Fill / border | Use |
|---|---|---|---|
| `elevation.base` (0) | the field | `background`, no border | The dashboard backdrop behind the cards. |
| `elevation.raised` (1) | a card | `surface` + 1px `border` | A widget card, a settings row group, an onboarding panel. The default panel. |
| `elevation.overlay` (2) | a raised surface | `surfaceAlt` + 1px `border` | A popover, a dropdown menu body, a selected/expanded row, a chip on a card. One step above its parent. |

Separation comes from the fill step and the border, both already in the theme. The ladder is the same in dark and light because it is defined in **role** terms (`surface`, `surfaceAlt`, `border`), which each theme already maps.

### 5.3 Floating UI: the scrim

A genuinely **floating** surface (a modal dialog, a bottom sheet, a full menu) needs more separation than a fill step, because it sits above arbitrary content, not a known parent. On an emissive surface the right move is not a shadow but to **darken everything behind it**: paint the new `scrim` token (section 4.4, `neutral.950` at 0.60 dark / 0.40 light) over the dashboard, then place the floating surface at `elevation.overlay` on top. The field recedes, the floating layer reads as above, and no shadow is drawn. This is the floating-elevation answer the component library ([AOD-20](https://linear.app/thexap/issue/AOD-20)) consumes for its modals and sheets. The scrim is fixed (a property of "something floats"), distinct from the dynamic dim `overlay` (section 8).

## 6. Type

The `type.*` scale is adopted **verbatim** as the **app-wide** type system, not just the widget scale. The same ten steps that size widget values also size buttons, inputs, settings rows, onboarding headings, and paywall copy, so the foreground app and the ambient surface share one vertical rhythm.

![The Vela type scale as the app-wide system: the ten named steps from display at ninety-six through badge at ten, each with its size, weight, tracking, and an app-context use, and a note that numeric steps carry tabular figures and the token is a narrow Pick of TextStyle.](assets/design-tokens-scale.svg)

| Step | Size / weight | Tracking · numerics | App-wide role |
|---|---|---|---|
| `display` | 96 / 700 | −1 · tabular | The wall hero (Clock `large`). |
| `hero` | 44 / 700 | −0.5 · tabular | A primary value: temperature, spend, Clock `medium`; a paywall price. |
| `xl` | 40 / 700 | tabular | A large value in a denser card; an onboarding stat. |
| `title` | 18 / 600 | | A card's primary line; a settings section title; a dialog title. |
| `heading` | 15 / 600 | | A labeled condition; a settings row label; a form group head. |
| `body` | 14 / 500 | | Default body text; the empty-body line; onboarding paragraph; a button label at default size. |
| `label` | 13 / 600 | | An accent-or-muted label above a value; a small button label; an input label. |
| `meta` | 13 / 400 | | Muted secondary detail; a settings row subtitle; a helper line. |
| `caption` | 11 / 500 | +1 | The quiet `SERVICE · WIDGET` header; a section kicker; an input hint. |
| `badge` | 10 / 700 | +1 · uppercase | The stale / error badge; a "PRO" tag; a count pill. |

### 6.1 One family, brand and product

The type voice is a humanist geometric sans, the **in-app system stack** (SF Pro on iOS, Roboto on Android), which the renderers already draw and the wordmark sets at weight 500 ([`design-brand.md`](design-brand.md) §6.1). There is no separate brand font; `fontFamily` is intentionally implicit (the system stack) and is **not** a token. Numeric steps (`display` / `hero` / `xl`) carry `fontVariant: ['tabular-nums']` so a ticking or refreshing value does not jitter, the value-first rule of [`design-widget-system.md`](design-widget-system.md) §3.

### 6.2 The narrow style-token constraint (preserved)

The `type.*` token is **not** a full `TextStyle`. It is narrowed to the properties the scale carries:

```typescript
type TypeToken = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'letterSpacing' | 'fontVariant' | 'textTransform'>;
```

This is a hard constraint, not a style choice: typing the tokens as full `TextStyle` poisons Unistyles' deep-style mapping and floods `tsc` across every file that touches the theme (the AOD-62 build note, `aod-unistyles-style-token-gotcha`). AOD-19 **preserves** the narrow `Pick`. The one candidate field for app text is **`lineHeight`**: widget values are single-line and never needed it, but multi-line app copy (onboarding paragraphs, paywall body, a settings description) will want a controlled line-height. Adding it stays inside the narrow token, `Pick<TextStyle, ... | 'lineHeight'>`, so it does not reintroduce the typing problem. It is **flagged, not forced** (section 9), to be set per-step by AOD-20 when the first multi-line app text lands.

## 7. Spacing and radius

### 7.1 Spacing: the 4px-base scale, rationalized

Spacing is the shipped function `spacing(n) = n * 4`, kept verbatim. AOD-19 rationalizes the **canonical rungs** and their roles, so app screens (AOD-20 / AOD-17) compose from the same scale the widgets do rather than inventing gaps. The base unit is 4; the function accepts any `n` (including fractional for a 2px hairline), but the canonical app rhythm is:

| Rung | Value | Role |
|---|---|---|
| `spacing(1)` | 4 | The tightest gap: icon-to-text, a glyph inset. |
| `spacing(2)` | 8 | Intra-card row gap (the widget body gap, §3.4). |
| `spacing(3)` | 12 | **Card padding** (the canonical card inset, §3.4). |
| `spacing(4)` | 16 | A comfortable element gap; a list row's vertical padding. |
| `spacing(6)` | 24 | A section gap; the inter-card gutter on the dashboard. |
| `spacing(8)` | 32 | A large section break; a screen's content top gap. |
| `spacing(12)` | 48 | Screen margins; a big empty-state block. |

The widget system fixed only `spacing(2)` and `spacing(3)`; naming the larger rungs (16 / 24 / 32 / 48) is the **app-wide** extension AOD-20 and the screens need. No value changes; the function is unchanged.

### 7.2 Radius: the scale, with `full` added

| Token | Value | Role | Status |
|---|---|---|---|
| `radius.sm` | 8 | Chips, inputs, small controls, the status badge. | shipped, verbatim |
| `radius.md` | 14 | **The canonical card** (and most panels). | shipped, verbatim |
| `radius.lg` | 22 | Large surfaces: sheets, modals, the paywall panel. | shipped, verbatim |
| `radius.full` | 9999 | A pill or a fully-rounded end: the Current Cycle progress bar, a count pill, a toggle. | **added** |

`radius.full` formalizes an ad-hoc value: the progress bar currently computes its fully-rounded end as half its height at the draw site ([`design-widget-system.md`](design-widget-system.md), the `progress` group). Naming `full` lets pills and bars reference one token instead of recomputing, and gives AOD-20's toggles and tags a rounded end. The brand app-icon corner (~22% of the edge, [`design-brand.md`](design-brand.md) §4.1) is an **icon-export** rule, not a UI radius token; it stays with [AOD-42](https://linear.app/thexap/issue/AOD-42).

## 8. The dim / night ambient variant

Vela is an ambient surface that must not blast light at night. Two shipped tokens carry that, both **consumed from** the kiosk runtime's `AmbientContext { phase, dimLevel }` ([AOD-11](https://linear.app/thexap/issue/AOD-11) §8, `computeAmbient`); AOD-19 canonicalizes them as the **ambient variant tier** and does **not** build the schedule or the curve.

![The Vela ambient variant: on the left the global dim overlay shown over a card at dimLevel zero, mid, and full night where a black overlay darkens uniformly; on the right the deep-red night palette recoloring a Clock; below, a note distinguishing the dynamic dim overlay driven by dimLevel from the fixed scrim behind a floating surface.](assets/design-tokens-elevation.svg)

### 8.1 `overlay`: the global dim (verbatim)

```typescript
overlay = { color: '#000000', maxDim: 0.72 }   // neutral.950 at a dimLevel-driven opacity
```

The host paints `overlay.color` (= `neutral.950`, pure black) at opacity `dimLevel * overlay.maxDim` across a `dimsWithAmbient: true` card. `dimLevel 0` is day (no overlay); `dimLevel ~0.7` is full night, where `0.7 * 0.72 ≈ 0.50` darkens the card without crushing it to black. The `0.72` ceiling matches the kiosk curve's `nightDim ~0.7` anchor ([AOD-11](https://linear.app/thexap/issue/AOD-11) §8.2). This is the default for almost every widget and every app surface: it dims uniformly with no per-widget code. Verbatim from the shipped theme.

### 8.2 `night.*`: the deep-red opt-in (verbatim)

A widget that wants a real **night appearance**, not just a darker one, sets `dimsWithAmbient: false`, reads `useAmbient()`, and recolors itself with the `night.*` group (section 4.5); the host then skips the overlay for it. The canonical opt-in is the Clock (`design-widget-system.md` §8.5): by night it draws the time in `night.primary`, the date in `night.secondary`, the kicker in `night.muted`, on `night.surface`, dimming further as `dimLevel` rises. The opt-in exists because the overlay can only **darken**, not **recolor** (it cannot turn white digits deep red). Verbatim from the shipped theme.

### 8.3 `overlay` vs `scrim`: two blacks, two roles

Both `overlay` (section 8.1) and `scrim` (section 4.4) paint `neutral.950` at an opacity, so the reconciliation must keep them distinct:

| Token | Opacity | Driver | Purpose |
|---|---|---|---|
| `overlay` | `dimLevel * 0.72`, **dynamic** | the ambient curve (time of day) | Dim the whole surface at night. |
| `scrim` | `0.60` dark / `0.40` light, **fixed** | a floating layer opening | Separate a modal / sheet from the field behind it (section 5.3). |

They can even stack (a modal opened at night sits over a dimmed dashboard), which is correct: the scrim adds floating separation, the overlay carries the time-of-day dim. Naming both prevents a build from collapsing them into one and breaking either night-dim or modal separation.

## 9. Deltas to the shipped theme (the reconciliation handoff)

This is the hard-consistency section the brief requires: the canonical set is a **superset** of the shipped theme, and every difference is listed here for the implementing `type:tech-task`. There is exactly **one** change to a shipped value's shape (value-preserving), and the rest are additions. **No shipped color, type step, spacing unit, or radius changes value.**

| # | Delta | Kind | Reconciliation |
|---|---|---|---|
| 1 | Color roles become **aliases of named primitives** (`accent -> blue.400`, etc.); a shared `primitive` object is added. | **Value-preserving structural.** Every resolved hex is identical to today (section 4). | Add `const primitive = {...}` (section 3.3); rewrite `darkTheme.colors` / `lightTheme.colors` and `night.*` as references to `primitive.*`. Rendered output byte-identical. |
| 2 | `elevation` ladder (`base` / `raised` / `overlay` -> surface role + border). | **Additive.** No new color (reuses `surface` / `surfaceAlt` / `border`). | Add an `elevation` group or document it as a convention (section 5.2). |
| 3 | `scrim` semantic token (`neutral.950` @ 0.60 dark / 0.40 light). | **Additive.** Reuses the black primitive. | Add `scrim` to each theme's colors (encoding, rgba string vs `{color,opacity}`, is the tech-task's call). |
| 4 | `onAccent` (#FFFFFF) and `focusRing` (aliases `accent`) semantic tokens. | **Additive.** Derived, no new hue. | Add to each theme's colors. |
| 5 | `radius.full = 9999`. | **Additive.** | Add to `radius`. |
| 6 | The rationalized spacing rungs and radius / type roles. | **Documentation.** No code value changes (the function and `sm/md/lg` are unchanged). | None required; the roles are a naming contract sections 6 and 7 record for AOD-20. |
| 7 | `type.*` may gain a `lineHeight` field. | **Candidate, additive.** Stays inside the narrow `Pick` (section 6.2). | Add `'lineHeight'` to `TypeToken` and set per step **when** AOD-20's first multi-line app text needs it. Not forced now. |

Typing safety, carried from the AOD-62 build note (`aod-unistyles-style-token-gotcha`): the new `primitive.*` and semantic values are plain strings, which Unistyles handles fine; the **only** typing trap is the `type.*` token, which must stay the narrow `TypeToken` `Pick` (delta 7 respects this). The three-tier restructure (delta 1) does not touch type typing.

## 10. Applying the system: AOD-20 and AOD-39

The test of a token system is that the downstream surfaces theme against it **without reaching for raw hex**. They do:

| Consumer | Themes against | What is theirs (designed there, not here) |
|---|---|---|
| **Component library** ([AOD-20](https://linear.app/thexap/issue/AOD-20)) | The semantic roles (`surface`, `border`, `text`, `accent`, `onAccent`, `focusRing`), the type steps, spacing rungs, `radius.*`, the `elevation` ladder + `scrim` for modals/sheets. | The **component-scoped token groups** (`button.*`, `input.*`, `toggle.*`) added under the component tier, each aliasing a semantic role; the components' states and interaction. |
| **Kiosk wall presentation** ([AOD-39](https://linear.app/thexap/issue/AOD-39)) | The same semantic roles and the **ambient variant** (`overlay`, `night.*`) it already consumes via `dimLevel` / `phase`; the larger type steps (`display` / `hero`) for across-the-room legibility. | The wall presentation profile (the larger type scale selection, the higher-contrast composition) over an existing layout, which it renders **without editing** the tokens. |

Both reference **stable role names**, so a future theme change (a new variant, a contrast bump) is a token edit they inherit, not a per-component or per-screen rewrite. This is the reuse the three-tier structure exists to guarantee, and the reason AOD-19 gates AOD-20 and AOD-39. Neither is designed here (section 11).

The existing per-widget groups (`weatherIcon`, `sparkline`, `money`, `priorityIcon`, `progress`, `clockSize`, `dot`) are already the component tier done right: numbers-only, drawing with semantic colors at the call site, never hard-coding a hex. AOD-19 names that tier; it does **not** restyle them.

## 11. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| **The reconciliation build** (add `primitive`, alias the color roles, add `elevation` / `scrim` / `onAccent` / `focusRing` / `radius.full` into [`unistyles.ts`](../../apps/app/unistyles.ts)) | a DS-M1 `type:tech-task` | The values and structure are fixed here (sections 4-9); the build implements them, rendered output unchanged. |
| **Component-scoped tokens** (`button.*`, `input.*`, `toggle.*`) and the components | [AOD-20](https://linear.app/thexap/issue/AOD-20) | The semantic roles + `onAccent` / `focusRing` / `elevation` / `scrim` they alias are fixed; the component groups are theirs. |
| **The kiosk wall presentation** (the larger-type, higher-contrast profile over a layout) | [AOD-39](https://linear.app/thexap/issue/AOD-39) | The tokens it themes against (semantic roles + ambient variant + the `display` / `hero` steps) are fixed; the profile is theirs. |
| **`type.lineHeight`** per step | [AOD-20](https://linear.app/thexap/issue/AOD-20) + the tech-task | Flagged as a narrow-`Pick`-safe addition (sections 6.2, 9); set when the first multi-line app text lands. |
| **`accentMuted` / `divider` / `inputBorder`** promotion | [AOD-20](https://linear.app/thexap/issue/AOD-20) | Named as candidates (section 4.4); promoted the section 3 way only if a shared need appears, not pre-minted. |
| **A third theme variant** (e.g. high-contrast / accessibility) | future | The three-tier structure makes it a re-aliasing of the semantic layer, not a rewrite (section 3.1). |
| **A light-theme ambient** treatment (a daytime foreground ambient beyond the dark default) | future | The dark theme is the canonical ambient surface; the light theme ships, its ambient polish is not v1 (carried from `design-widget-system.md` §10). |
| **Motion tokens** (durations, easings for the dim ramp, the refresh spin) | future / the I-M3 build | Named in `design-widget-system.md` §10 as a build refinement; not a color/type/spacing token. |

## 12. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. **The taxonomy is fixed and approved:** a **full three-tier color structure** (primitive -> semantic -> component) coded into the theme, with the one layering rule (a tier references only the tier below), full depth applied to **color** and single scales to **type / spacing / radius**, matched to the Unistyles theme shape (section 3; `design-tokens-color.svg`).
> 2. **Color is canonicalized verbatim:** six primitive ramps (`neutral` / `blue` / `amber` / `red` / `green` / `ember`), the **dark (primary)** and **light** semantic roles expressed as aliases with each role justified, the ambient-night group (`night.* -> ember.*`), and the new app-wide additions (`onAccent`, `scrim`, `focusRing`), with the **one-accent rule held and no new hue** (section 4).
> 3. **Elevation is fixed as the approved surface-step + scrim model:** a no-shadow ladder (`base` / `raised` / `overlay` = surface role + border) and a `scrim` for floating UI, consistent with the flat ambient look (section 5; `design-tokens-elevation.svg`).
> 4. **Type is the app-wide system:** the `type.*` scale verbatim across widgets and app screens, the narrow `TypeToken` `Pick` preserved, and `lineHeight` flagged as the one narrow-safe candidate for multi-line app text (section 6; `design-tokens-scale.svg`).
> 5. **Spacing and radius are rationalized:** the 4px-base spacing scale with canonical rungs and roles, and the radius scale (`sm` / `md` / `lg` verbatim, `full` added for pills) (section 7; `design-tokens-scale.svg`).
> 6. **The dim / night ambient variant is canonicalized:** `overlay` (dynamic dim) and `night.*` (deep-red opt-in) verbatim, consuming `phase` / `dimLevel` (not building the schedule), with the `overlay`-vs-`scrim` distinction drawn (section 8; `design-tokens-elevation.svg`).
> 7. **Consistency is explicit:** the canonical set is a **superset** of the shipped theme; the single value-preserving structural delta (color roles become primitive aliases) and every additive token are listed for the implementing `type:tech-task`, with **no shipped value changed** (section 9).
> 8. **The work is handed forward:** AOD-20 (component tokens + components) and AOD-39 (kiosk presentation) theme against the stable role names (section 10); the reconciliation is a separate `type:tech-task`; no code is changed (sections 9, 11). The **three specimens render** in the house dark style.

| Acceptance clause | Where |
|---|---|
| Taxonomy: three tiers, the layering rule, color-deep / scales-flat | Section 3; `design-tokens-color.svg` |
| Color: primitive ramps + dark/light semantics + night + additions, one accent, no new hue | Section 4; `design-tokens-color.svg` |
| Elevation: surface-step ladder + scrim, no shadows | Section 5; `design-tokens-elevation.svg` |
| Type: the scale app-wide, narrow Pick, lineHeight candidate | Section 6; `design-tokens-scale.svg` |
| Spacing + radius: rationalized scale, `radius.full` added | Section 7; `design-tokens-scale.svg` |
| Dim / night variant: overlay + night verbatim, overlay vs scrim | Section 8; `design-tokens-elevation.svg` |
| Deltas to the shipped theme; reconciliation handoff | Section 9 |
| Applying to AOD-20 / AOD-39; seams; acceptance | Sections 10, 11, 12 |

## 13. References

- [AOD-19](https://linear.app/thexap/issue/AOD-19): this design's tracking issue (`type:design`, `area:design-system`; milestone DS-M1 "Brand & Tokens", project Design System).
- [AOD-18](https://linear.app/thexap/issue/AOD-18): the brand identity ([`design-brand.md`](design-brand.md)). §5 / §6 / §8 adopted the palette and type verbatim and handed their formalization here. The direct upstream.
- [AOD-20](https://linear.app/thexap/issue/AOD-20): the component library. Themes against these roles; adds the component-scoped tokens (section 10). Blocked by this.
- [AOD-39](https://linear.app/thexap/issue/AOD-39): the kiosk wall presentation. Themes against these roles + the ambient variant (section 10). Blocked by this.
- [AOD-16](https://linear.app/thexap/issue/AOD-16): the UI-foundation decision (Option C, react-native-unistyles v3). The engine this taxonomy fits.
- [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)): §3 the token foundation + one-accent rule, §4.1 flat / no-shadow (the elevation basis), §7 the dim / ambient behavior this canonicalizes.
- [AOD-11](https://linear.app/thexap/issue/AOD-11) ([`kiosk-mode.md`](kiosk-mode.md)): §8 the schedule and `computeAmbient` curve that produce `phase` / `dimLevel`, consumed (not built) by section 8.
- [`unistyles.ts`](../../apps/app/unistyles.ts): the shipped tokens this canonicalizes verbatim. Specified here, not edited.
- [`product-vision.md`](product-vision.md): the "calm ambient surface" pitch and the Option C UI-foundation context.
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
- Assets: [`design-tokens-color.svg`](assets/design-tokens-color.svg), [`design-tokens-elevation.svg`](assets/design-tokens-elevation.svg), [`design-tokens-scale.svg`](assets/design-tokens-scale.svg).
