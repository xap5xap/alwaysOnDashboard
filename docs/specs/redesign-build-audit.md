# Vela Redesign — Build Audit (rework vs new)

> Status: **authored 2026-07-13.** Scopes the code work to implement the Fable/Claude Design redesign
> on top of the existing pre-redesign app. Method: seven parallel code audits (one per area) against the
> designed set (the 8 shell PDFs + 4 card faces + the frozen color law), cross-checked against the current
> `apps/app/src` code and the still-open dogfood bugs AOD-93..104. Companion to the design record in
> [`claude-design/README.md`](../../claude-design/README.md), [`design-color-law.md`](design-color-law.md),
> and the memory note `aod-ui-redesign-pivot`. **Linear holds the tasks** (the new "Redesign Build" project);
> this doc holds the scoping narrative, the resolved decisions, the milestone/dependency plan, and the
> dogfood-closure map. It does not duplicate issue state.

## 0. Headline: this is a rework, not a greenfield

The pre-redesign shell is already built (AOD-67..75: component library, shell, route tree, dashboard editor,
connections, onboarding, paywall, kiosk, native runtime). The redesign build = implementing the **new Fable
UX on the existing app**. The extensibility seam (**services → widgets → layout**) is intact everywhere and
must stay that way: adding a service still touches only the registry. The biggest single rework is the Sky
surface (multi-dashboard + slot placement + add-flow); the biggest *keep* is the kiosk native runtime +
viewport auto-fit.

Two genuinely good findings de-risk the plan:
- **No schema migration is needed** for multiple dashboards or per-widget delete — the DB already supports
  both (`dashboards.position`, no per-user unique; `widget_instances` DELETE already granted under RLS). The
  single-dashboard limit and the missing delete are purely client-side.
- **The one true new-data task on the critical path is server-only and cheap** — Weather Current needs today's
  sunrise/sunset for the Transit arc, and its endpoint (`/v1/forecast`) is already allow-listed; it is a
  query-builder + normalize change in `operations.ts`, no proxy/allow-list edit.

## 1. Per-area scoping summary

Each area cites the load-bearing code anchors and a KEEP / REWORK / NEW verdict. Task-level detail is in Linear.

### 1.1 Foundation — tokens, color, widget framework  *(mostly REWORK + NEW seam)*
- **Tokens already three-tier** (`apps/app/unistyles.ts`): `primitive` ramps → semantic `colors` roles →
  component/screen/editor/wall token groups (numbers + role-name aliases). Themes are already first-class
  (`appThemes = { dark, light }`, role indirection throughout). **This is exactly the machinery the color-law
  "theme axis" extends** — adding **Signature** (data hues) + **Monochrome** (roles→bone) is a token remap on
  the existing seam, not a rebuild. NEW: the `--temp` / `--ink` / `--pane` / `--when` families + data-hue roles.
- **The card renderer is `host/WidgetHostView.tsx`** (not `widgets/`). It has **no fit-to-bounds** — it
  `overflow:hidden` clips (this is AOD-95/97 directly). NEW: a shared value-at-step / truncate-then-drop body.
- **`widgets/sizes.ts` holds the pre-pivot spans** (`medium 2×1`, `wide 3×1`, `tall 1×2`). REWORK to
  `S 1×1 / M 1×2 / W 2×1 / L 2×2` on a 2-col, 96px grid; retire 3-wide; align `UNIT_PX` (80) to the 96px row.
- Caption is a fixed `SERVICE · WIDGET` string. NEW: a per-widget strategy (`hidden` / `place` / `project` /
  `calendar`) with a `{config,data}` resolver. Clock needs headerless at **every** size (today only
  `hideHeaderAtSizes:['small']`).
- Lifecycle is 6 phases (`loading|fresh|stale|error|needs_config|disconnected`) that don't map 1:1 to the
  design's ghost/connecting/live/stale/error/empty. NEW: the **ghost** state; promote own-empty to first class.
- **Stub leaks three ways** (registry[0], the `STUB_SEED` bootstrap in `dashboardRepo.ts`, the server
  `BACKEND_REGISTRY`) — AOD-94. Remove in lockstep; move to a test-only registry.

### 1.2 Card faces — Clock / Weather / Linear / Calendar  *(REWORK over existing data)*
- **Clock → Meridian:** subtractive (strip the date line / zone kicker / GMT offset / wide-banner branch);
  chromeless; dusk→ember **~3h** ramp (today a 60-min transition in `kiosk/ambient.ts`); live+ghost only.
- **Weather Current → Transit:** the one new-data task (add `daily=sunrise,sunset&forecast_days=1` to
  `buildCurrentQuery` + `normalizeCurrent`, server `operations.ts` only). Expand S/M → all four sizes; arc at
  L, waterline at W/M, absent at S; muted condition **pane** (color roles). **Forecast → Range** (hi-lo
  span-bars, no pane). Normalize `WeatherIcon` to one line weight (kill the 1.5 snowflake overrides).
- **Linear → Soundings + The Log Line:** the 5-shape `PriorityGlyph` **already exists** to reuse; My Issues
  becomes count + priority silhouette (heavy→light sort, client). Current Cycle becomes a **21-knot ring** —
  **device-verify on the low-DPI wall; smooth-ring fallback** if the knots alias. "Warms on breach" = overdue
  (client, free); +blocked needs a server query change (out of v1 scope). needs_config already exists.
- **Calendar → Dressed Overall:** every event's time wears the `--when-*` imminence ladder (cool→warm,
  capped at balmy); no data change; caption = which calendar (**note:** the calendar's display name isn't in
  the payload — the caption strategy must persist the chosen label).
- **Claude usage: deferred** (no face this pass; the anthropic_usage cards exist from AOD-59/64; the
  spend-thermometer color is pre-specced). A single `could` issue tracks the future reface.
- Each face adds a numbers-only geometry token group to `unistyles.ts` (matches the existing
  `clockSize`/`weatherIcon`/`priorityIcon` precedent).

### 1.3 The Sky surface — dashboard, layout, add-flow  *(largest REWORK + NEW)*
- **Single dashboard is client-only; schema is multi-ready.** `loadDashboard` does `.limit(1)`;
  `bootstrapDashboard` seeds one `'Wall'` + the stub. NEW: a multi-dashboard data layer + paged pager + a Pro
  gate on the 2nd sky (`maxDashboards` exists as a client-only gate).
- **Placement is a 1-D vertical append** (`placement.ts` `defaultPlacementRect`) with **no free-cell scan** —
  AOD-103. Geometry is **continuous** free-drop (`geometry.ts`), so resize "snaps" via the `size` class
  flipping on release — AOD-98. REWORK to a **2-col slot grid** with a first-free-slot scan and live WYSIWYG
  snap.
- **No per-widget delete exists anywhere** — AOD-104 (launch blocker). NEW: delete-in-place (the RLS DELETE
  is already granted; connections survive).
- **Add UI is a plain list** (`WidgetPicker.tsx`) with no already-added state / preview / size / search —
  AOD-102. REWORK to the **Add-by-Seeing** preview-first gallery (real-size + on-your-sky preview,
  ghost-connect-in-place, "• ON THIS SKY", size-by-seeing). Ghost-connect needs the OAuth deep-link to return
  to the **picker** mid-add, not to Settings.
- NEW: Glance ↔ (Arrange) two-altitude dial; cross-sky card move.
- **Resolved contradiction:** `vela-DESIGN.md §5` still says the dashboard is "free-form, not a rigid wall of
  tiles"; the Many Skies card-grid contract is a structured 2-col grid. **The redesign supersedes the
  free-form model** — slot-grid placement is the current truth, and it is what actually fixes AOD-98/103.

### 1.4 Onboarding, paywall & entitlements  *(REWORK + a cross-cutting model change)*
- **Onboarding runs only after sign-in today** (`gate.ts` routes no-session → `/sign-in` first). INVERT it:
  onboarding is the **no-session front door** (Clock + Weather are local/keyless). NEW: the Raising-the-Sail
  cold open + deal-one-card engine + lazy account at first server-side connect (+ Apple/Google) + "skip seeds
  Clock+Weather, never empty." Closes AOD-93 and part of AOD-101.
- **Paywall has the 7-day trial baked in three places.** REWORK to The Fare v2: remove the trial everywhere;
  four contextual "first breaths" replace the 6-trigger map; errand-CTA vocabulary; monthly default; the store
  does the money (App Store deep-links; Restore in-app).
- **Entitlements = the shared server-enforced file** (`supabase/functions/_shared/entitlements.ts`, re-exported
  as `@vela/shared`). Collapse Pro from **six levers to two doors** (2nd sky + wall; all services + themes go
  free) and add a **third `paused` state** (free/pro/paused; on lapse nothing is deleted). **This must be
  coordinated with server enforcement.** The real RC/webhook signal is AOD-77 (out of scope) — build the state
  + UI, stub the signal.

### 1.5 Account, connections & app-level edges  *(REWORK + mostly-NEW edges)*
- KEEP: the gate/splash/`AppBar` shell, `AuthProvider`, the RLS read layer, the `affordance.ts` matrix, and
  the invalidation seam (`useConnectionActions` — this is how a connect relights cards today).
- REWORK: collapse Settings + Account into the **Below Deck** one-room screen (two shelves, no nav tree);
  reconnect-per-auth-kind that returns to the **sky** (not `/settings`); the status legend
  (expired/error/stale/healthy, no green, trouble-to-top); fix-a-broken-card-in-place (the `onReconnect` hook
  is currently unwired); three removes / hold-to-delete account (the account-delete backend is a no-op stub);
  the subscription shelf.
- NEW: **in-session OAuth** (`expo-web-browser` isn't a dep — OAuth is fire-and-forget `Linking.openURL`
  today); the app-level **Holding Course** edges (offline detection isn't wired at all — `netinfo` isn't a
  dep; offline vs Vela-down vs one-service-error are indistinguishable). Cold launch is already cache-first
  via the query persister — a good foundation to keep.
- Dogfood closers here: AOD-96 (disconnected card not tappable), AOD-99 (connections have no descriptions/
  icons), AOD-100 (keyboard covers the input — a straight KeyboardAvoidingView fix).
- **Brand-mark note:** the in-app `Wordmark` is **text-only** (renders no star); the retired 4-point star
  survives only in the app-icon PNGs + design assets. "Propagate the sail" = regenerate the icon PNGs from
  `vela-sail-mark.svg` (and optionally add a first in-app mark glyph).

### 1.6 Kiosk wall + ambient  *(mostly KEEP; targeted REWORK)*
- KEEP: the native runtime seam (`runtime.native.ts`: keep-awake / orientation / brightness / immersive /
  back-intercept / PIN / ambient timer), the viewport auto-fit (`wallFitScale` + `wall.padding=24`), the exit
  PIN + PinPad. The wall composes the **same** `LayoutCanvas → WidgetHost → WidgetHostView` chain as the app,
  so the new faces land on the wall for free (just verify at wall scale).
- REWORK: the **night color model** — today every non-Clock card gets a uniform black dim overlay; the color
  law wants near-black cards + a Weather-only indigo **pane** + the Clock as the only ember. The
  **never-alarm** edges — remove the three hard splash branches, suppress below-deck Retry/Connect/Reconfigure
  on the wall, dim-and-keep-last-value, empty sky → Clock fallback, a 1s-hold whisper pill.
- NEW: the multi-sky **cycle** (opt-in, off by default); the "which sky" 1s-hold (must disambiguate from the
  2s exit corner); the ember ramp lengthened to ~3h (one caveat: `transitionMinutes` drives dim + backlight +
  ember together); the OLED pixel-shift study (only bites on real OLED hardware; the dogfood Fire HD 8 is LCD);
  first-time pairing (gated on the standalone-vs-companion decision).

## 2. Resolved architectural decisions (recorded, not open)

1. **Slot-grid supersedes free-form.** Placement moves from continuous free-drop to a 2-col / 96px slot grid.
   This is the fix for AOD-98/103 and the frame every card face is sized against. Supersedes `vela-DESIGN.md §5`.
2. **Color: data-hue, not "warm the system."** The July-12 "warm the neutrals" idea was superseded by the
   data-hue law (Made Fast). The shell/chrome stays near-black with the **blue `#6E8BFF` as the interaction
   accent only** (taps); color on cards comes from data (temp/ink/pane/when). Faces bind to **roles**.
3. **Themes:** Signature (default) + Monochrome ship in v1, both free, on the role seam. Per-service is a
   future/Pro lever, off the first-run path.
4. **Pro = two doors** (2nd sky + wall); **all services + both v1 themes are free.** `paused` never deletes.
5. **Dogfood bugs stay as problem-records** in Platform & App Shell; build issues cross-reference "Resolves
   AOD-N" and those close when the redesign ships. No duplication/migration of the bug reports.
6. **Design record = the PDFs + `claude-design/README.md` + `design-color-law.md`.** Build issues cite them
   directly; only the color law got a translated markdown spec, and that is sufficient (see open item I).

## 3. Open decisions for Xavier (defaults chosen, easy to flip)

- **A. Project name / placement.** New sibling project **"Redesign Build"** (or "UI/UX Redesign (Build)") under
  the `alwaysOnDashboard v1` initiative, distinct from the retrospective design project "UI/UX Redesign".
- **B. "Tend" rename (ADR).** Default **Arrange** — the code already uses "Arrange mode" + an `arrange` token
  group, so it costs the least drift. (Alternatives: Edit; keep Tend.)
- **C. Standalone vs companion wall. RESOLVED (Xavier, 2026-07-13).** v1 = **Kiosk Mode on the device
  itself** (Fire HD / iPhone / iPad), the built and dogfooded standalone model, downloadable on all three.
  v1.1 = the **"wall" as a cast / second-screen target** (Fire TV, Apple TV, Amazon Echo Show, smart TV),
  a separate brainstorm (AOD-155, moved to the v1.1 Backlog), not the companion-tablet pairing the Fable
  copy assumed. Consequence: RB-37's pairing beat is deferred to v1.1; RB-58's hold keeps its v1 form with
  on-device copy ("which sky · exit to arrange," not "Tend from your phone").
- **D. Claude usage face.** Default a single `could` issue (visible, optional); the cards already work.
- **E. Spec-first stance.** Default **cite the PDFs** in issues rather than authoring a fresh markdown spec per
  surface (the design is fully recorded, just in PDF form; the color law already has a doc). Flip to a
  `type:spec` pass first if you want the shell surfaces written up like the color law.

## 4. Milestones & the dependency spine

Six milestones, dependency-sequenced. Foundation gates everything; faces and the Sky surface both consume the
grid + color-role seam; onboarding/paywall consume the Sky surface + connect mechanics + faces; the wall
consumes the faces + color + multi-dashboard.

| Milestone | Theme | Depends on | Closes (dogfood) |
|---|---|---|---|
| **RB-M1 Foundation** | color-law tokens + theme axis + slot-grid contract + fit-to-bounds + caption/chromeless + six-state/ghost + stub removal + offline plumbing + sail mark + Tend rename + the **palette device-verify gate** | — | AOD-94, AOD-95, AOD-97 |
| **RB-M2 Card faces** | Meridian / Transit + Range / Soundings + Log Line / Dressed Overall (Claude deferred) | M1 (grid + color roles) | — |
| **RB-M3 The Sky surface** | slot placement, delete-in-place, Glance/Arrange, multi-dashboard + pager + page altitude, cross-sky move, Add-by-Seeing | M1; faces for previews | AOD-98, AOD-102, AOD-103, AOD-104, AOD-96 (partly) |
| **RB-M4 Onboarding, paywall & entitlements** | Raising the Sail, The Fare v2, 2-door Pro + paused, lazy account | M3 (skies/add/connect), M2 (cards light) | AOD-93, AOD-101 |
| **RB-M5 Account, connections & edges** | Below Deck, reconnect-per-auth + real OAuth, status legend, 3 removes, subscription shelf, Holding Course edges | M1 (offline plumbing, theme); connect mechanics | AOD-96, AOD-99, AOD-100 |
| **RB-M6 Kiosk wall** | wall night color law + Weather pane, multi-sky cycle, which-sky hold, never-alarm edges, ember ramp, OLED study | M2 (faces), M1 (color), M3 (multi-dashboard) | — |

**The gate:** RB-M1's palette device-verify spike is the checkpoint before committing the frozen tokens
(panes / hairlines / Calendar cool-stops / thermometer / night frame on the real Fire HD 8 in a dark room —
web is density- and brightness-blind, the AOD-81 lesson). Faces do not build on an unverified palette.

## 5. Device-verify gates (Fire HD 8, low-DPI wall)

Web/gallery cannot reproduce any of these; each is an on-device task inside its issue:
- The **frozen palette** — panes for banding, hairlines for survival, contrast at night brightness (RB-M1 gate).
- The **Linear 21-knot Log Line ring** — hard fallback to the smooth ring if the knots alias.
- The **Weather condition pane** and the **Calendar cool-stops** at wall scale.
- The **full-wall composite** — the morning aggregate skews cool (cool temp + distant Calendar + cool sky
  pane); confirm it reads "calm + alive," not "cold monitor."

## 6. Known cross-cutting risks

- The **2-door + paused** entitlement change edits the server's trust line (`_shared/entitlements.ts`) — must
  land in lockstep with server enforcement, and `paused` can't be verified end-to-end until real RC (AOD-77).
- **Account-delete has no backend** (`Account.tsx` is a no-op); the hold-to-delete flow needs a server purge
  Edge Function built (flagged on that issue).
- **New native deps** (`expo-web-browser` for OAuth, `netinfo` for offline) each force an EAS rebuild + Fire
  HD 8 re-verify (the device-build recipe).
- **Google sign-in likely won't work on the Fire HD 8** (no Play services) — email must stay a fallback.
- **Gesture density** on the Sky surface (page pinch, cross-sky edge-hold, slot drag, "swipe never edits") is
  the densest in the app — budget a device pass.
