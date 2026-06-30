# Design: Vela core navigation / IA screens (the app shell)

> Status: draft for review, 2026-06-30. Tracked by [AOD-21](https://linear.app/thexap/issue/AOD-21) (`type:design`, `area:app` + `area:design-system`; milestone DS-M2 "Components & Core Screens", project Design System). The **core-screens half of DS-M2**: [AOD-20](https://linear.app/thexap/issue/AOD-20) (PR #32, Done) built the **components** half, this builds the **navigation shell** the components fill. It follows the `type:design` deliverable convention in [`engineering-process.md`](../engineering-process.md): a `design-` doc under `docs/specs/` plus rendered SVG mockups in `docs/specs/assets/`, screen-scoped tokens **specified** (not written into [`unistyles.ts`](../../apps/app/unistyles.ts)), merged via PR.
>
> **It supersedes the issue's original "Produce (Figma)" wording.** AOD-21 was written before [AOD-37](https://linear.app/thexap/issue/AOD-37) set the repo's `type:design` convention (a `design-` doc + rendered SVGs in-repo, not a Figma file). This deliverable follows that established convention, the same medium supersession [AOD-37](https://linear.app/thexap/issue/AOD-37) / [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-17](https://linear.app/thexap/issue/AOD-17) used. No scope change, only the medium.
>
> **It is the keystone of the core-screens phase, one level up from the per-feature designs.** It **applies** the IA ([AOD-17](https://linear.app/thexap/issue/AOD-17), [`app-ia.md`](app-ia.md)) and **composes** the components ([AOD-20](https://linear.app/thexap/issue/AOD-20), [`design-component-library.md`](design-component-library.md)) into the shared navigation shell **once**, so the per-feature screen designs ([AOD-27](https://linear.app/thexap/issue/AOD-27) dashboard + editor, [AOD-28](https://linear.app/thexap/issue/AOD-28) settings + connections, [AOD-29](https://linear.app/thexap/issue/AOD-29) onboarding) are **applications** of it, not redesigns. This is the exact relationship [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)) has to the per-widget designs.
>
> **What this fixes, and what it must not touch.** It fixes **visuals only**: the shared app shell / nav chrome, the core-nav screen scaffolds the IA defines, and the per-state and per-presentation visuals, expressed as compositions of the [AOD-20](https://linear.app/thexap/issue/AOD-20) components and the coded design tokens. It does **not** edit [`unistyles.ts`](../../apps/app/unistyles.ts), does **not** write screen code, and does **not** scaffold the expo-router routes (those are a future `type:tech-task`). It does **not** re-open the IA / nav model ([AOD-17](https://linear.app/thexap/issue/AOD-17)), the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)), or the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18)). Where the shell needs a value the theme does not name, it is **flagged as a screen-scoped token addition** (section 11), the way [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-37](https://linear.app/thexap/issue/AOD-37) flagged theirs; the build adds it later.
>
> **Consistency is the hard constraint.** The shell composes the **real coded roles** ([AOD-66](https://linear.app/thexap/issue/AOD-66): the semantic colors, the `elevation` ladder, `scrim`, `onAccent`, `focusRing`, `radius.full`, `type` / `spacing`), reuses the widget card chrome + lifecycle + empty body ([`design-widget-system.md`](design-widget-system.md) owns them) where the dashboard frames widgets, treats the lock / PRO overlay as the entitlements `Gate` fallback ([`apps/app/src/entitlements/Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx)), and keeps the one-accent rule and the dark ambient brand ([`design-brand.md`](design-brand.md)). It designs **for** the scaffolded screens ([`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx), [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx)) and the three real routes, canonicalizing what they do and flagging extensions additively (section 12), not redrawing them from scratch.

## 1. Purpose and scope

[`app-ia.md`](app-ia.md) (the IA) fixed the navigation **model**: the route tree, the fourteen-surface inventory, the routes between them, and the presentation rule. [`design-component-library.md`](design-component-library.md) (the components) fixed the **vocabulary** every screen composes from. AOD-21 sits between them: it lays out the **shared navigation shell** and the **core-nav screen scaffolds** by applying the IA and composing the components, so the per-feature designs that follow lay out a fixed shell rather than inventing their own chrome.

It is the navigation counterpart to [`design-widget-system.md`](design-widget-system.md): that doc designed the widget visual **system** once so the four widget designs were applications; this doc designs the **app-chrome shell** once so the three per-feature screen designs are applications.

It fixes exactly seven things:

1. **The app shell / global chrome** (section 3): the screen frame, the safe-area insets, the dark ambient field, and the two header patterns (the hub header and the pushed-screen header), composed from the [AOD-20](https://linear.app/thexap/issue/AOD-20) components.
2. **The navigation zones, the gate, and the auth-gated transitions** (section 4): the splash, the `(auth)` / onboarding / `(app)` zones drawn as screens, and the replace-semantics auth transitions, applying [`app-ia.md`](app-ia.md) §3 / §4.2.
3. **The Dashboard frame** (section 5): the hub header, the canvas field where widget cards mount, and the dashboards-switcher entry, framing the [AOD-27](https://linear.app/thexap/issue/AOD-27) editor interior.
4. **Settings home and Account** (section 6): the secondary hub (the row-group sections and the nav rows) and the account surface (sign out relocated, deletion, manage subscription).
5. **The presentation chrome** (section 7): the pushed screen, the modal route, and the in-screen sheet, applying the [`app-ia.md`](app-ia.md) §4.4 presentation rule and composing the [AOD-20](https://linear.app/thexap/issue/AOD-20) scrim + `elevation.overlay`.
6. **The screen-level states** (section 8): the splash, loading, empty, and error states of a whole surface, distinct from the per-widget lifecycle ([AOD-37](https://linear.app/thexap/issue/AOD-37) owns that).
7. **The kiosk entry chrome** (section 9): the two entry points, the `Gate` to paywall handoff, and the fullscreen entry transition, framing the kiosk **wall** ([AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11) own that).

Plus the cross-cutting handoffs: the transition treatments (section 10), the screen-scoped token additions (section 11), and the reconciliation with the shipped screens (section 12).

**In scope:** the shared shell and the core-nav screen scaffolds (the seven areas above), each as a visual + interaction contract expressed as a composition of the [AOD-20](https://linear.app/thexap/issue/AOD-20) components and the coded tokens, plus the additions handed to the build (section 11) and the seams to the per-feature designs (section 13).

**Out of scope (named so the frame is clear):**

- **The per-feature screen interiors** that lay out this shell: [AOD-27](https://linear.app/thexap/issue/AOD-27) (dashboard + free-form editor), [AOD-28](https://linear.app/thexap/issue/AOD-28) (settings + connections), [AOD-29](https://linear.app/thexap/issue/AOD-29) (onboarding, and the full paywall layout). This shell fixes the frame; they fill it.
- **The kiosk wall presentation** ([AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11)) beyond placing the kiosk entry and the entry transition (section 9).
- **The component library** ([AOD-20](https://linear.app/thexap/issue/AOD-20), Done) the screens compose and the **widget visual system** ([AOD-37](https://linear.app/thexap/issue/AOD-37), Done) the dashboard frames. Reused, not redesigned.
- **Re-deciding** the IA / nav model ([AOD-17](https://linear.app/thexap/issue/AOD-17)), the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)), or the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18)).
- **Scaffolding the routes or writing screen code**: a future `type:tech-task` builds the tree the IA defines and applies this shell.

## 2. Locked context this builds on

| Source | What it locks | How this design uses it |
|---|---|---|
| [`app-ia.md`](app-ia.md) ([AOD-17](https://linear.app/thexap/issue/AOD-17)) | The **navigation model**: the route tree, the auth-gated split, the fourteen-surface inventory, the routes, the presentation rule (pushed / modal / sheet), the `vela://oauth/done` deep-link. | This shell **applies** it verbatim: sections 4 to 9 lay out the surfaces it names, in the zones it places them, with the presentation it assigns. No new route, no redrawn nav tree. |
| [`design-component-library.md`](design-component-library.md) ([AOD-20](https://linear.app/thexap/issue/AOD-20)) | The app-chrome components: buttons, inputs, row-groups, list rows, sheets / modals / popovers, badges, the lock / PRO overlay, and `accentMuted` / `elevation` / `scrim` / `onAccent` / `focusRing` in practice. | Every screen **composes** these; sections 3 to 9 name which component each surface is. Not redesigned. |
| [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)) | The widget **card chrome**, the six lifecycle states, and the empty body. | The Dashboard canvas (section 5) **reuses** the card chrome unchanged; the screen states (section 8) are explicitly distinct from the per-widget lifecycle. |
| [`unistyles.ts`](../../apps/app/unistyles.ts) ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)) | The **real coded tokens**: the semantic `colors.*` roles, the `elevation` ladder, `scrim` / `onAccent` / `focusRing`, `radius.full`, and the `type` / `spacing` scales. | Every shell value is a role reference; section 11 adds only the geometry the shell needs (`screen`, `appBar`). Nothing re-decides a value. |
| [`design-brand.md`](design-brand.md) ([AOD-18](https://linear.app/thexap/issue/AOD-18)) | The **one-accent rule**, the dark-first ambient surface, the lowercase **vela** wordmark, the calm voice. | The hub header sets the wordmark (section 3); every surface keeps one accent and the dark field; copy follows the voice. |
| [`apps/app/src/entitlements/Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx) ([AOD-12](https://linear.app/thexap/issue/AOD-12)) | The **UX-only gate**: `children` when entitled, `fallback` otherwise; the server still refuses an over-limit request. | The Settings lock rows and the kiosk gate (sections 6, 9) **are** the `Gate` fallback, routing to the paywall, never the enabled control. |
| The shipped screens + routes ([`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx), [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx), [`app/_layout.tsx`](../../apps/app/app/_layout.tsx), [`index.tsx`](../../apps/app/app/index.tsx), [`settings.tsx`](../../apps/app/app/settings.tsx)) | The **functional-but-unpolished** surfaces and the three real routes. | This design **canonicalizes** what they do (section 12) and designs for them; it flags every extension additively, not a greenfield redraw. |
| [`engineering-process.md`](../engineering-process.md) | The `type:design` deliverable convention and the chain decision -> spec -> design -> tech-task. | This deliverable follows it; sections 11 to 13 hand the build to a `type:tech-task`. |

What is already true, and what this adds: the app already **renders** these surfaces (a sign-in card, a dashboard, a settings list), themed against the Unistyles theme. This design does not invent the surfaces. It **names the shell** they share, fixes the two header patterns and the presentation chrome once, resolves the drift the unpolished screens carry (the inline sign out, the plain locked-kiosk text, the ad-hoc states), and writes the shell down once as the contract the per-feature designs and the build reference.

## 3. The app shell / global chrome

Every screen sits inside one frame: the dark ambient field (`colors.background`), the safe-area insets (`rt.insets`), and a header. The app draws its own chrome (`headerShown: false` app-wide, [`app/_layout.tsx`](../../apps/app/app/_layout.tsx)), so the header is a composed component, not the native navigator bar. There are exactly **two header patterns**, and naming them once is what makes the shell reusable.

![The Vela app shell: a device frame showing the top safe-area inset, a header zone with the vela wordmark and a Settings action over a divider, a content field at elevation base where widget cards mount, and the bottom safe-area inset; beside it the two header patterns, a hub header pairing the wordmark with Add, Settings, and a switcher chevron, and a pushed header pairing a back chevron with a title and an optional trailing action; a legend of the shared nav glyphs; and a token block with the frame, header, and app-bar measurements.](assets/design-core-app-shell.svg)

<details>
<summary>Shell anatomy &amp; tokens</summary>

```
frame    : colors.background · paddingTop rt.insets.top · paddingX spacing(4..5) · no shadow (flat ambient)
hub header   : Dashboard home. wordmark (brand §4) left · Add + Settings + switcher › right · 1px bottom border
pushed header: a sub-screen. back ‹ + title (type.title) left · optional trailing action right · no border
actions  : a ghost button (accent), the AOD-20 §5 variant. focusRing on focus. tap target >= 44px.
nav glyphs : back ‹ · chevron › · close ✕ · add + · the shared chrome glyph family (glyphs.tsx), ~1.7 stroke, round caps
appBar   : height ~ spacing(14)=56 plus the top safe-area · title type.title · screen-scoped token (section 11)
```
</details>

- **The frame.** `colors.background` fills the screen; content is inset by the safe area (`rt.insets.top`, already applied in [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) / [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx)) and padded on the sides by `spacing(4..5)`. It is flat: no shadow anywhere, the same ambient rule the card follows ([`design-widget-system.md`](design-widget-system.md) §4.1).
- **The hub header** is the Dashboard home header: the lowercase **vela** wordmark on the left (the one place the wordmark appears in-app, [`design-brand.md`](design-brand.md) §4.2), and the glanceable actions on the right (Add, Settings, a dashboards-switcher chevron). It carries a 1px bottom border to separate the chrome from the canvas.
- **The pushed-screen header** is every sub-screen's header: a back chevron and the screen title (`type.title`), with an optional trailing action (for example a "Done" on an editable screen). No bottom border, because a pushed screen is content, not a hub.
- **The actions are ghost buttons** ([AOD-20](https://linear.app/thexap/issue/AOD-20) §5), `accent` label, no fill, the receding action treatment the shipped chrome already uses for Add / Settings. The `focusRing` is the shared 2px accent ring on focus.

## 4. The navigation zones, the gate, and the auth-gated transitions

The product has one hard split ([`app-ia.md`](app-ia.md) §3): **signed-out** sees one surface (Sign In), **signed-in** sees everything else, with a thin first-run gate routing a brand-new user through onboarding. This section draws those zones as screens and fixes the gate visual and the auth-gated transition treatment. It does **not** lay out the Sign In or Onboarding **interiors** (those are [AOD-29](https://linear.app/thexap/issue/AOD-29)); it fixes the shell that frames them and how they are reached.

![The Vela navigation zones drawn as device frames: the auth zone Sign In showing the auth card with the vela wordmark, two fields, and a primary button tagged interior owned by AOD-29; the onboarding first-run frame with a stepper, a connect-first-service prompt, and a primary, also AOD-29; the app zone Dashboard with the hub header and widget cards, tagged frame section 5; and below, the gate flow from launch to a loading splash to the index gate, branching to no session, session first run, and session onboarded, with a note that auth transitions replace the stack.](assets/design-core-nav-zones.svg)

<details>
<summary>The zones, the gate &amp; the transition rule</summary>

```
(auth)      : one surface, Sign In. The auth card (AOD-20 §8): surface + border + radius.lg + the wordmark. Interior = AOD-29.
onboarding  : first run, gated inside the signed-in zone. A stepper + connect-first-service prompt. Interior = AOD-29.
(app)       : Dashboard home + every signed-in surface. Frame = section 5.
gate        : index.tsx · reads useAuth() · loading -> splash · no session -> (auth) · session+first-run -> onboarding · else -> (app)
transition  : auth transitions REPLACE the stack (router.replace / <Redirect>) -> no back entry into a stale auth state (AOD-17 §6.1)
```
</details>

- **The gate** is `app/index.tsx` ([`app-ia.md`](app-ia.md) §4.2). While the session resolves it shows the **splash** (section 8); then it routes by `(session, onboarded)`. The gate is logic, not a durable surface, so the shell fixes only its **splash** and the **destinations** it routes to.
- **The auth-gated transitions replace the stack.** Sign In to home (the gate re-runs on auth), Onboarding to home, and sign out to Sign In all use replace semantics, so the OS back gesture never returns into a stale auth state. This is the [`app-ia.md`](app-ia.md) §6.1 rule made visual; this design applies it, it does not re-decide it.
- **The Sign In and Onboarding interiors are deferred** to [AOD-29](https://linear.app/thexap/issue/AOD-29) per the [`app-ia.md`](app-ia.md) §5 inventory (rows 1 and 2). The shell places the auth card ([AOD-20](https://linear.app/thexap/issue/AOD-20) §8) in the `(auth)` zone and the onboarding surface in the gated first-run slot; the form layout, the sign-up affordance, and the connect-first-service flow are [AOD-29](https://linear.app/thexap/issue/AOD-29)'s.

## 5. The Dashboard frame (the hub)

The Dashboard is the hub ([`app-ia.md`](app-ia.md) §6.2): one tap from everything. This section fixes its **frame** (the hub header, the canvas field, the switcher entry) and its **states** (section 8); the free-form **editor** interior (drag, resize, arrange mode, the widget picker and config sheets) is [AOD-27](https://linear.app/thexap/issue/AOD-27).

![The Vela Dashboard frame: a device frame with a top safe-area band, a hub header with the vela wordmark and the Add, Settings, and switcher chevron actions over a divider, and a canvas field at elevation base holding two small widget cards and one wide widget card that reuse the AOD-37 card chrome; beside it the split between the frame this design fixes (hub header, canvas field, dashboards switcher entry, screen states) and the interior AOD-27 fills (free-form editor, widget picker and config sheets, empty-dashboard layout), a dashboards switcher panel showing Home checked plus a New dashboard action, and a token block.](assets/design-core-dashboard-frame.svg)

<details>
<summary>The frame, the canvas &amp; the switcher</summary>

```
hub header : section 3 hub pattern · wordmark + Add + Settings + switcher › · 1px bottom border
canvas     : elevation.base (colors.background, no border) · the field widget cards mount into
card       : REUSED from design-widget-system §4 (surface + border + radius.md) · not redesigned here
switcher   : (app)/dashboards, a modal route (AOD-17 §4.5). scrim + dialog at elevation.overlay · Home (checked) · New dashboard
the frame  : hub header · canvas · switcher entry · screen states (section 8)
the interior (AOD-27): free-form editor · widget picker + per-instance config sheets · empty-dashboard CTA layout
```
</details>

- **The canvas is `elevation.base`** ([`unistyles.ts`](../../apps/app/unistyles.ts) `elevation`): the dashboard field, `colors.background`, no border. The widget cards mount into it and carry their own `elevation.raised` chrome, reused from [`design-widget-system.md`](design-widget-system.md) §4 unchanged.
- **The dashboards switcher** is the `(app)/dashboards` modal route ([`app-ia.md`](app-ia.md) §4.5). The shell places its **entry** (the switcher chevron in the hub header) and its **presentation** (a modal route, section 7); the switcher affordance and the multi-dashboard active-selection state are [AOD-27](https://linear.app/thexap/issue/AOD-27)'s and the build's ([`app-ia.md`](app-ia.md) §10).
- **The frame versus the interior.** This design fixes the chrome the Dashboard always has; [AOD-27](https://linear.app/thexap/issue/AOD-27) lays out what happens inside the canvas (the editor, the picker, the config sheets, the empty-state CTA). The seam is the canvas boundary.

## 6. Settings home and Account

Settings is the secondary hub ([`app-ia.md`](app-ia.md) §6.2) for Connections, Themes, Kiosk, and Account; Account holds sign out, deletion, and the manage-subscription link. Both are named explicitly in the AOD-21 goal ("settings home, account"). They compose the [AOD-20](https://linear.app/thexap/issue/AOD-20) row-group, list row, and lock row.

![The Vela Settings home and Account screens: Settings as a device frame with a pushed header, a Connections row-group tagged interior owned by AOD-28 showing Linear and Google Calendar connected with Disconnect and Weather with Connect, then a Themes lock row and a Kiosk Mode lock row each with a padlock, a muted title, a PRO badge, and a chevron, and an Account row with a chevron; Account as a device frame with a pushed header, an identity block with an email and a Free plan label, a Manage subscription row, a Sign out accent action, and a Delete account destructive action, with a note that sign out is relocated here.](assets/design-core-settings-account.svg)

<details>
<summary>Settings sections, Account rows &amp; the ownership split</summary>

```
Settings home (the secondary hub):
  CONNECTIONS  : a row-group (AOD-20 §8). The connections rows + connect/disconnect/reconnect detail are AOD-28.
  Themes       : a lock row (Gate fallback) -> paywall (trigger=themes) when Free · the themes picker is a pushed screen
  Kiosk Mode   : a lock row (Gate fallback) -> paywall (trigger=kiosk) when Free · the kiosk entry (section 9)
  Account      : a list row + chevron -> the Account screen (pushed)
Account:
  identity     : email + plan (Free/Pro) + an Upgrade action when Free
  Manage subscription : a row -> the RevenueCat / store-managed subscription
  Sign out     : an accent action, RELOCATED here from the Dashboard header (AOD-17 §5 / §9)
  Delete account : a destructive action (AOD-5 E2 in-app deletion)
```
</details>

- **Ownership split (Settings and Account).** The [`app-ia.md`](app-ia.md) §5 inventory lists the Settings home (row 7) and Account (row 11) **design owner** as [AOD-28](https://linear.app/thexap/issue/AOD-28), but the AOD-21 goal names "settings home, account" as core-nav screens. They reconcile as a keystone-and-application split, the same one this whole design embodies: **AOD-21 lays out the settings-home shell** (the screen frame, the section structure, the nav rows that route to Themes / Account / Kiosk, the placement of the Connections section) **and the Account screen** (the nav destination holding sign out, deletion, and subscription); **[AOD-28](https://linear.app/thexap/issue/AOD-28) designs the Connections interior** (the connection-row states, the connect / disconnect / reconnect detail, the credential form sheet) that fills the Connections section. The mockup tags the Connections group "interior -> AOD-28" to mark the seam.
- **The lock rows are the `Gate` fallback** ([AOD-20](https://linear.app/thexap/issue/AOD-20) §11, [`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx)): a padlock glyph, a `textMuted` title, a PRO `accentMuted` badge, and a chevron that routes to the paywall with the matching `trigger`. They replace the plain "Kiosk Mode (Pro, locked)" text the shipped [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx) renders (section 12). They are UX-only; the server enforces the limit.
- **Sign out is relocated to Account.** The shipped [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) header carries a Sign out action; the [`app-ia.md`](app-ia.md) §5 / §9 reconciliation moves it to Account so the Dashboard header keeps only glanceable concerns (Add, Settings, switcher). This is the one relocation the shell applies (section 12).

## 7. The presentation chrome

[`app-ia.md`](app-ia.md) §4.4 fixes three presentation kinds, chosen by one question: **does the surface carry a live object from a parent screen?** This section fixes how each kind looks as shell chrome, composing the [AOD-20](https://linear.app/thexap/issue/AOD-20) §9 overlays (`scrim` + `elevation.overlay`, never a shadow). It applies the rule; it does not re-decide which surface is which.

![The Vela presentation chrome across three device frames: a pushed Themes sub-screen with a back chevron, a default stack push; a modal route showing the Dashboard dimmed under a scrim with a centered paywall dialog at the overlay elevation carrying a close control and an Upgrade button; and an in-screen sheet showing the Dashboard dimmed under a scrim with a bottom sheet sliding up, a grabber handle, an Add a widget title, and two widget rows; below, the decision rule routing a live-object surface to a sheet, a deep-linkable global surface to a modal route, and otherwise a pushed screen, with the surface mapping for each.](assets/design-core-presentation.svg)

<details>
<summary>The three kinds, the scrim rule &amp; the mapping</summary>

```
pushed screen : a Stack push. full surface · own back entry · deep-linkable · route params only.
                Sign In · Onboarding · Dashboard · Settings · Themes · Account · Kiosk (fullscreen).
modal route   : a Stack.Screen with presentation:'modal'. scrim + dialog at elevation.overlay · a close/grabber.
                Paywall · Dashboards switcher. Deep-linkable, no live parent object.
in-screen sheet: a RN <Modal>, owned by the parent screen's state. scrim + sheet at elevation.overlay · a grabber.
                Widget picker · per-instance config · credential form. Carries a live object (a WidgetInstance / ServiceDefinition).
the rule      : carries a live object? -> sheet · else deep-linkable + global? -> modal route · else -> pushed screen
scrim         : the AOD-20 §9 / token. 0.60 dark / 0.40 light. A floating layer over arbitrary content. No shadow.
```
</details>

- **Pushed screen.** A `Stack` push: a full surface with its own back entry, deep-linkable, parameterized by route params only. The header is the section 3 pushed pattern.
- **Modal route.** A `presentation: 'modal'` route ([`app-ia.md`](app-ia.md) §4.4) for an app-global surface that is deep-linkable but not tied to a live parent object: the **Paywall** and the **Dashboards switcher**. The shell draws the OS modal as a `scrim` over the caller plus a dialog at `elevation.overlay`, with a close control (or grabber). The caller is unchanged underneath.
- **In-screen sheet.** A React Native `<Modal>` owned by the parent screen's state ([`app-ia.md`](app-ia.md) §4.4), for an ephemeral surface parameterized by a **live object**: the widget picker (the active dashboard), the per-instance config (a `WidgetInstance`), the credential form (a `ServiceDefinition` + `authClass`). These stay off the router on purpose; the shell draws them as bottom sheets (`scrim` + `elevation.overlay` + a grabber). Their **interiors** are the per-feature designs' ([AOD-27](https://linear.app/thexap/issue/AOD-27) picker / config, [AOD-28](https://linear.app/thexap/issue/AOD-28) credential form); the shell fixes the **presentation**.

## 8. The screen-level states (loading / empty / error)

A whole surface can be loading, empty, or in error, distinct from a single widget's lifecycle. [AOD-37](https://linear.app/thexap/issue/AOD-37) owns the **per-widget** states (the card's loading / stale / error / needs-config / disconnected, drawn inside each card); this section owns the **per-screen** states (the session resolving, the dashboard load failing). They compose the [AOD-20](https://linear.app/thexap/issue/AOD-20) skeleton and buttons.

![The Vela screen-level states across four device frames: a splash with a centered spinner and the vela wordmark while the session resolves at boot; a loading state with a skeleton title bar and a panel of three skeleton rows shaped to the layout; an empty state with the Dashboard hub header and a centered dashboard-is-empty message with an Add widget primary button; and an error state with a centered alert glyph, a could-not-load message, and a Retry action; with a footer distinguishing these whole-surface states from the per-widget lifecycle owned by AOD-37.](assets/design-core-states.svg)

<details>
<summary>The four screen states &amp; tokens</summary>

```
splash  : app boot, while the session resolves (the gate's loading branch). A centered spinner + the wordmark. The one spinner in the app.
loading : a shaped skeleton (AOD-20 §10): bars in the skeleton role mirroring the real layout (header + rows), a slow shimmer. Not a spinner.
empty   : a calm CTA, not an error. A muted line + a primary button (e.g. "Your dashboard is empty." + "Add widget"). The brand's calm voice.
error   : a centered alert glyph + a muted line + ONE accent action (Retry). The section-5 prompt vocabulary, screen-scaled.
tokens  : skeleton (#23232E) shaped bars · primary / ghost buttons · type.meta line · accent action · no new token
```
</details>

- **Splash.** The gate's loading branch ([`app-ia.md`](app-ia.md) §4.2): a centered spinner and the wordmark, the only place the app shows a spinner (every other load is a shaped skeleton). It is what the shipped [`index.tsx`](../../apps/app/app/index.tsx) already renders as an `ActivityIndicator`, now given the wordmark and the brand surface.
- **Loading.** A shaped skeleton ([AOD-20](https://linear.app/thexap/issue/AOD-20) §10): skeleton-colored bars mirroring the real layout with a slow shimmer, not a single bar and not a spinner. It replaces the screen-level `ActivityIndicator` placeholders.
- **Empty.** A calm CTA in the brand's voice ([`design-brand.md`](design-brand.md) §7): a muted line and a primary button, never an error treatment. This canonicalizes the shipped empty-dashboard CTA in [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) (the exact empty-dashboard layout is [AOD-27](https://linear.app/thexap/issue/AOD-27)'s).
- **Error.** A centered alert glyph, a muted line, and one accent action (Retry), reusing the [AOD-37](https://linear.app/thexap/issue/AOD-37) §5 prompt vocabulary at screen scale. This canonicalizes the shipped "Could not load your dashboard" error in [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx).

## 9. The kiosk entry chrome

Kiosk is the flagship feature ([`kiosk-mode.md`](kiosk-mode.md), [AOD-11](https://linear.app/thexap/issue/AOD-11)). The [`app-ia.md`](app-ia.md) §5 inventory (row 12) names **AOD-21** as the design owner of the kiosk **entry**, with the **wall** presentation going to [AOD-39](https://linear.app/thexap/issue/AOD-39). This section fixes the two entry points, the `Gate` to paywall handoff, and the fullscreen entry transition; it does **not** design the wall.

![The Vela kiosk entry chrome: two entry chips, a Dashboard Start Kiosk action and a Settings Kiosk Mode row behind the Gate with a padlock and a PRO badge, both flowing into a gate node that checks canUseKiosk; a Pro user enters the kiosk route, drawn as a near-black fullscreen wall with a large clock and a dashed note that the wall presentation is AOD-39 / AOD-11 with the chrome hidden; a Free user is sent to the Paywall modal with a Vela Pro title, a kiosk-needs-Pro line, and an Upgrade button; with a footer stating the entry pushes a fullscreen route with the gesture back disabled.](assets/design-core-kiosk-entry.svg)

<details>
<summary>The entries, the gate handoff &amp; the entry transition</summary>

```
entries    : (1) Dashboard "Start Kiosk" action · (2) Settings "Kiosk Mode" row (the Gate row, section 6)
gate       : canUseKiosk (AOD-12 Gate). Pro -> enter the kiosk route · Free -> Paywall (trigger=kiosk), never an enabled control.
kiosk route: (app)/kiosk?dashboardId · pushed FULLSCREEN · chrome hidden (no header) · gestureEnabled:false · OS back intercepted (AOD-11 §4.3)
exit       : the only exit is the AOD-11 gesture + PIN, back to the Dashboard. Not a casual back.
wall       : the wall presentation (the layout drawn as a glanceable wall) is AOD-39 / AOD-11, NOT this design.
```
</details>

- **Two entry points, one route** ([`app-ia.md`](app-ia.md) §5 row 12, §7). Both pass through the `canUseKiosk` `Gate`: a Pro user enters the kiosk route, a Free user routes to the Paywall (`trigger=kiosk`). The Settings entry is the lock row from section 6; the Dashboard entry is a "Start Kiosk" action.
- **The entry transition** is a pushed **fullscreen** route ([`app-ia.md`](app-ia.md) §4.4, §6.1): the chrome is hidden (no header), `gestureEnabled: false`, and the OS back is intercepted ([`kiosk-mode.md`](kiosk-mode.md) §4.3), so kiosk is not dismissible by a casual back. The only exit is the [AOD-11](https://linear.app/thexap/issue/AOD-11) gesture + PIN, which returns to the Dashboard.
- **The wall is not this design.** The mockup draws a placeholder wall (a large clock on a near-black field) only to show the chrome-hidden fullscreen frame; the actual wall presentation profile (the landscape layout, the dim curve, the pinning) is [AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11)'s.

## 10. Transitions (the visual treatment of the IA transition kinds)

The AOD-21 goal names "transitions" alongside the screens. [`app-ia.md`](app-ia.md) §6.1 owns the **transition kinds** and the back-stack behavior; this design fixes their **visual treatment** as shell chrome. It applies the rule, it does not invent new transitions.

| Transition | IA semantics ([`app-ia.md`](app-ia.md) §6.1) | Shell treatment |
|---|---|---|
| **Replace** | The auth transitions (gate -> home, Sign In -> home, Onboarding -> home, sign out -> Sign In). No back entry. | A cross-fade through the splash; the prior surface is gone, the back gesture never returns to it (section 4). |
| **Push** | Dashboard -> Settings -> Themes / Account. Ordinary stack. | The pushed-screen header (section 3) appears with a back chevron; standard platform push. |
| **Modal route** | Paywall, Dashboards switcher. Swipe-down or Close dismisses. | The `scrim` darkens the caller; the dialog rises at `elevation.overlay` (section 7); the caller is unchanged underneath. |
| **In-screen sheet** | Widget picker, config, credential form. Closed by the parent's state. | The `scrim` + a bottom sheet at `elevation.overlay` with a grabber (section 7); no router transition. |
| **Kiosk** | Pushed fullscreen, `gestureEnabled:false`, back intercepted. | Chrome hidden, fullscreen; exit only by the AOD-11 gesture + PIN (section 9). |

Motion specifics (the cross-fade duration, the sheet-slide easing, the modal-rise timing) are a **build refinement**, named here, not fixed (the same way [AOD-37](https://linear.app/thexap/issue/AOD-37) §10 and [AOD-20](https://linear.app/thexap/issue/AOD-20) §14 left motion to the build).

## 11. Screen-scoped token additions (the AOD-20 §12 analog)

The shell composes almost entirely from the existing tokens and the [AOD-20](https://linear.app/thexap/issue/AOD-20) component groups. Where it needs geometry the theme does not name, it adds a **screen-scoped component group**, each carrying numbers plus role-name aliases (never a hex), the way [AOD-20](https://linear.app/thexap/issue/AOD-20) added `button` / `input` and [AOD-37](https://linear.app/thexap/issue/AOD-37) added `clockSize` / `weatherIcon`. These are **specified here, not coded**; the build adds them to [`unistyles.ts`](../../apps/app/unistyles.ts).

| # | Addition | Kind | What it aliases / carries |
|---|---|---|---|
| 1 | `appBar` group | **Additive (component).** | `height` (~ `spacing(14)`=56) · `paddingX` (`spacing(4)`) · the title aliases `type.title` · background `colors.background` · the hub variant's 1px bottom border `colors.border`. Numbers + role names. |
| 2 | `screen` group | **Additive (component).** | `paddingX` (`spacing(4..5)`) · `paddingTop` composes `rt.insets.top` (runtime, not a token) · `gap` (`spacing(4)`). The shared content-region metrics. |
| 3 | The presentation chrome | **Composes, no new token.** | Pushed = a `Stack` push (a navigator option). Modal / sheet = the [AOD-20](https://linear.app/thexap/issue/AOD-20) §9 `sheet` / `modal` groups + `scrim` + `elevation.overlay`. No new token. |
| 4 | The screen states | **Composes, no new token.** | splash = a spinner + wordmark; loading = the [AOD-20](https://linear.app/thexap/issue/AOD-20) §10 `skeleton`; empty / error = `type` + buttons + `accent`. No new token. |
| 5 | The kiosk entry transition | **Composes, no new token.** | A fullscreen `Stack.Screen` with `gestureEnabled:false` (navigator options, not tokens). The lock row is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 `lockRow`. No new token. |

Typing safety, carried from the AOD-62 build note (`aod-unistyles-style-token-gotcha`): `appBar` and `screen` are numbers + role-name strings (plain, Unistyles-safe, like `elevation` and the AOD-20 groups); they do not touch `type.*`, so they do not reintroduce the deep-style typing flood.

## 12. Reconciliation with the shipped screens (the AOD-20 §13 analog)

The shell is a **canonicalization** of the shipped screens and the three real routes, not a greenfield redraw. Each drift the unpolished surfaces carry is listed here for the implementing `type:tech-task`. None changes a token **value**; they align the surfaces to the shell, the components, and the IA. Nothing below redraws a surface silently.

| # | Surface today | Canonical (this shell) | Kind |
|---|---|---|---|
| 1 | [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx) header: `Vela` text + email + Add / Settings / **Sign out** inline. | The **hub header** (section 3): the wordmark + Add + Settings + switcher; **sign out relocated** to Account (section 6). | **canonicalize + relocate** |
| 2 | [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx): ad-hoc empty CTA + `ActivityIndicator` load + inline error. | The **screen states** (section 8): the shaped skeleton, the calm empty CTA, the Retry error. | **canonicalize** (layout is [AOD-27](https://linear.app/thexap/issue/AOD-27)) |
| 3 | [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx): title (24/800) + `ConnectionsList` + plain "Kiosk Mode (Pro, locked)" text + "Back to dashboard" link. | The **settings-home shell** (section 6): the pushed header, the row-group sections, the Themes / Kiosk **lock rows**, the Account nav row. | **canonicalize + extend** |
| 4 | [`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx): the auth card (brand 32/800, fields, primary, "Create an account"). | Placed in the `(auth)` zone as the [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 auth card; the **interior** (form, sign-up, errors) is [AOD-29](https://linear.app/thexap/issue/AOD-29). | **place + defer** |
| 5 | `app/index.tsx`: gate renders `<SignIn/>` or `<Dashboard/>` inline; `ActivityIndicator` splash. | The gate + **splash** (sections 4, 8); the zones become the `(auth)` / `(app)` groups the IA defines (route work is the tech-task). | **canonicalize** (routes = tech-task) |
| 6 | No Account screen; no dashboards switcher; no Themes / Paywall / Kiosk screens. | Placed by the shell (sections 5, 6, 7, 9) as scaffolds the per-feature designs fill; the routes are added by the [`app-ia.md`](app-ia.md) §9 tech-task. | **add (scaffold)** |

These are **build** items (the DS-M2 / Phase-1 `type:tech-task`), not this design's edits; this design fixes the target, the build moves the screens and scaffolds the routes. The route additions themselves are the [`app-ia.md`](app-ia.md) §9 reconciliation, not re-specified here.

## 13. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| **The Dashboard editor interior** (free-form drag / resize / arrange, the widget picker + config sheet interiors, the empty-dashboard layout) | [AOD-27](https://linear.app/thexap/issue/AOD-27) | The frame, the canvas, the switcher entry, and the screen states are fixed here; the editor fills the canvas. |
| **The Connections interior + the full Settings interior** (connection-row states, connect / disconnect / reconnect, the credential form sheet interior) | [AOD-28](https://linear.app/thexap/issue/AOD-28) | The settings-home shell, the section structure, and the nav rows are fixed; the connections detail fills the section. |
| **The Sign In / Onboarding interiors and the full Paywall layout** | [AOD-29](https://linear.app/thexap/issue/AOD-29) | The `(auth)` and onboarding shells, the gate, and the paywall **presentation** (a modal route) are fixed; the form, the sign-up, the onboarding steps, and the paywall body are theirs. |
| **The kiosk wall presentation** | [AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11) | The kiosk **entry** and the fullscreen entry transition are fixed; the wall layout, dim curve, and pinning are theirs. |
| **The screen scaffolding** (the expo-router route files, the gate `<Redirect>`, the `(auth)` / `(app)` groups, the `vela://oauth/done` route, the session guard) | a future `type:tech-task` ([`app-ia.md`](app-ia.md) §9) | The shell visuals and the surface inventory are fixed; the build authors the route files. |
| **Motion** (the replace cross-fade, the sheet slide, the modal rise, the splash-to-home timing) | the build | Named (section 10); exact timings are a build refinement, not a token. |
| **Multi-dashboard active-selection + the switcher affordance** | [AOD-27](https://linear.app/thexap/issue/AOD-27) + build | The switcher **entry** and the modal **presentation** are placed; the active-dashboard state and the affordance are theirs ([`app-ia.md`](app-ia.md) §10). |
| **Light-theme parity polish** | the build | The shell is defined in role terms, so light is a re-alias, not a redraw (the AOD-20 §3 layering rule). |

## 14. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. **The app shell / global chrome is fixed** (section 3; `design-core-app-shell.svg`): the dark ambient frame, the safe-area insets, and the **two header patterns** (the hub header and the pushed-screen header), composed from the [AOD-20](https://linear.app/thexap/issue/AOD-20) components, with the shared nav glyphs.
> 2. **The navigation zones, the gate, and the auth-gated transitions are fixed** (section 4; `design-core-nav-zones.svg`): the splash, the `(auth)` / onboarding / `(app)` zones drawn as screens, and the replace-semantics auth transitions, applying [`app-ia.md`](app-ia.md) §3 / §4.2 with the Sign In / Onboarding interiors deferred to [AOD-29](https://linear.app/thexap/issue/AOD-29).
> 3. **The Dashboard frame is fixed** (section 5; `design-core-dashboard-frame.svg`): the hub header, the `elevation.base` canvas where the [AOD-37](https://linear.app/thexap/issue/AOD-37) cards mount, and the dashboards-switcher entry, with the editor interior deferred to [AOD-27](https://linear.app/thexap/issue/AOD-27).
> 4. **Settings home and Account are fixed** (section 6; `design-core-settings-account.svg`): the secondary-hub sections and nav rows, the Themes / Kiosk **lock rows** (the `Gate` fallback), and the Account screen with **sign out relocated**, deletion, and the subscription link, with the Connections interior deferred to [AOD-28](https://linear.app/thexap/issue/AOD-28).
> 5. **The presentation chrome is fixed** (section 7; `design-core-presentation.svg`): the pushed screen, the modal route, and the in-screen sheet, applying the [`app-ia.md`](app-ia.md) §4.4 rule and composing the [AOD-20](https://linear.app/thexap/issue/AOD-20) `scrim` + `elevation.overlay`.
> 6. **The screen-level states are fixed** (section 8; `design-core-states.svg`): the splash, the shaped-skeleton loading, the calm empty CTA, and the Retry error, distinct from the [AOD-37](https://linear.app/thexap/issue/AOD-37) per-widget lifecycle.
> 7. **The kiosk entry chrome is fixed** (section 9; `design-core-kiosk-entry.svg`): the two entries, the `Gate` to paywall handoff, and the fullscreen entry transition, with the wall presentation deferred to [AOD-39](https://linear.app/thexap/issue/AOD-39) / [AOD-11](https://linear.app/thexap/issue/AOD-11).
> 8. **The work is handed forward** (sections 10 to 13): the transition treatments, the screen-scoped token additions (`appBar` / `screen`), and the reconciliation with the shipped screens are specified; the per-feature designs **compose** this shell; no code is changed, no route is scaffolded. The **seven mockups render** in the house dark style.

| Acceptance clause | Where |
|---|---|
| App shell: frame, safe-area, two header patterns, nav glyphs | Section 3; `design-core-app-shell.svg` |
| Nav zones, the gate, the auth-gated transitions | Section 4; `design-core-nav-zones.svg` |
| Dashboard frame: hub header, canvas, switcher entry | Section 5; `design-core-dashboard-frame.svg` |
| Settings home + Account; lock rows; sign out relocated | Section 6; `design-core-settings-account.svg` |
| Presentation chrome: pushed / modal / sheet | Section 7; `design-core-presentation.svg` |
| Screen-level states: splash / loading / empty / error | Section 8; `design-core-states.svg` |
| Kiosk entry chrome + the Gate handoff | Section 9; `design-core-kiosk-entry.svg` |
| Transitions; screen-scoped tokens; reconciliation; seams | Sections 10 to 13 |

## 15. References

- [AOD-21](https://linear.app/thexap/issue/AOD-21): this design's tracking issue (`type:design`, `area:app` + `area:design-system`; milestone DS-M2 "Components & Core Screens", project Design System).
- [AOD-17](https://linear.app/thexap/issue/AOD-17) ([`app-ia.md`](app-ia.md)): the IA this applies. The route tree, the fourteen-surface inventory, the routes, the presentation rule, and the [`app-ia.md`](app-ia.md) §5 design-owner column that assigns this design the shell, the kiosk entry, and the paywall presentation. The direct upstream.
- [AOD-20](https://linear.app/thexap/issue/AOD-20) ([`design-component-library.md`](design-component-library.md)): the components every screen composes (buttons, inputs, row-groups, list rows, sheets / modals, badges, the lock / PRO overlay). Reused, not redesigned.
- [AOD-37](https://linear.app/thexap/issue/AOD-37) ([`design-widget-system.md`](design-widget-system.md)): the widget card chrome + lifecycle + empty body the Dashboard canvas frames. The system this design parallels for app chrome.
- [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66) ([`unistyles.ts`](../../apps/app/unistyles.ts)): the coded semantic roles, the `elevation` ladder, `scrim` / `onAccent` / `focusRing`, `radius.full`, and the `type` / `spacing` scales the shell composes.
- [AOD-18](https://linear.app/thexap/issue/AOD-18) ([`design-brand.md`](design-brand.md)): the one-accent rule, the dark-first surface, the wordmark, and the voice the shell keeps.
- [AOD-12](https://linear.app/thexap/issue/AOD-12) ([`entitlement-model.md`](entitlement-model.md)) / [`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx): the UX-only gate the lock rows and the kiosk handoff coordinate with.
- [AOD-11](https://linear.app/thexap/issue/AOD-11) ([`kiosk-mode.md`](kiosk-mode.md)): the kiosk runtime and exit lock the entry transition respects; the wall presentation owner.
- [AOD-27](https://linear.app/thexap/issue/AOD-27) / [AOD-28](https://linear.app/thexap/issue/AOD-28) / [AOD-29](https://linear.app/thexap/issue/AOD-29) / [AOD-39](https://linear.app/thexap/issue/AOD-39): the per-feature and wall designs that apply this shell (section 13). Blocked by this.
- The shipped surfaces this canonicalizes: [`Dashboard.tsx`](../../apps/app/src/dashboard/Dashboard.tsx), [`Settings.tsx`](../../apps/app/src/screens/Settings.tsx), [`SignIn.tsx`](../../apps/app/src/screens/SignIn.tsx), [`app/_layout.tsx`](../../apps/app/app/_layout.tsx), [`index.tsx`](../../apps/app/app/index.tsx), [`settings.tsx`](../../apps/app/app/settings.tsx).
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
- Assets: [`design-core-app-shell.svg`](assets/design-core-app-shell.svg), [`design-core-nav-zones.svg`](assets/design-core-nav-zones.svg), [`design-core-dashboard-frame.svg`](assets/design-core-dashboard-frame.svg), [`design-core-settings-account.svg`](assets/design-core-settings-account.svg), [`design-core-presentation.svg`](assets/design-core-presentation.svg), [`design-core-states.svg`](assets/design-core-states.svg), [`design-core-kiosk-entry.svg`](assets/design-core-kiosk-entry.svg).
