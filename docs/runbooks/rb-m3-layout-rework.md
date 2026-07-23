# RB-M3 Layout rework: autonomous run book

> Status: **authored 2026-07-22.** The execution contract for building the **layout foundation rework** —
> the second wave of RB-M3, the six `from:dogfood` issues the [AOD-190](https://linear.app/thexap/issue/AOD-190)
> device pass surfaced when it halted at Phase C. Companion to the LOCKED design decision
> [`design-layout-foundation.md`](../specs/design-layout-foundation.md) (Xavier sign-off 2026-07-22; its §11
> is the specified change list) and the Linear issues themselves (task state). Same shape and machinery as the
> shipped [`rb-m3-sky-surface.md`](rb-m3-sky-surface.md) and [`rb-m2-card-faces.md`](rb-m2-card-faces.md); this
> doc holds only what neither Linear nor the design doc holds: the decomposition into buildable PRs, the run
> order, the gate stack, the merge policy, and the re-run device checkpoint. Linear is the single source of
> task state; do not duplicate it here.

## 1. Mission and hard scope

Replace the placement foundation the [AOD-190](https://linear.app/thexap/issue/AOD-190) device pass proved
broken — the editor grid is a fixed **192dp two-column strip anchored left** (`geometry.UNIT_PX = 96` never
scales; `GRID_COLUMNS = 2`), so a card cannot be dragged across a landscape screen — with the **locked iPadOS
model**: a **responsive slot grid** (6 landscape / 4 portrait, cells fit-to-width, gaps allowed), **per-orientation
memory** (each arranged orientation stored, un-arranged orientations reflow-derived), **scrollable** handheld
surfaces, and **one source of truth** per orientation. The kiosk wall renders the landscape layout through the
**unchanged** `wallFitScale` path. The milestone is **6 Linear issues**, delivered as **8 build PRs** (the
entangled foundation issue AOD-197 lands as three sub-PRs):

| Step | Issue(s) | PR theme | Risk | Notes |
|---|---|---|---|---|
| S1 | AOD-197 (a) | Grid shape + pure slot algebra (6/4 cols, `cellPx`, `reflowToColumns`, `nearestFreeSlot`) | medium | keystone; pure logic |
| S2 | AOD-194 | One source of truth for the active sky (Glance == Arrange) | medium | cache fix; **device-verifiable** |
| S3 | AOD-197 (b) | Per-orientation persistence + resolution (schema/mapper/data-layer) | **high** | data-layer keystone |
| S4 | AOD-197 (c) | Fit-to-width arrange + place-don't-pack (the visible chess board) | **high** | needs S1+S3 · **device** |
| S5 | AOD-196 | Scroll + safe-area (below-fold + Add reachable) | — | needs S4 · **device** |
| S6 | AOD-195 | iPhone/iPad long-press quick-actions menu (retire the dial) | medium | separable · **device** |
| S7 | AOD-191 | `created_at` tiebreaker in `loadDashboards` | — | independent, low |
| S8 | AOD-192 | Prune dead geometry/sizes helpers | — | **LAST** — retires what S1/S4 orphan |

(Step numbers are this doc's shorthand; trust the AOD identifiers. AOD-197 is one Linear issue delivered as
**three PRs** — S1 `AOD-197 (a)`, S3 `(b)`, S4 `(c)` — each `Part of AOD-197`; the issue closes when all
three + the device pass are done.)

**This is an application of the LOCKED design — do not re-open it.** The five questions are decided
(`design-layout-foundation.md` §5–§9); the four §13 defaults are confirmed. If the build surfaces a genuine
design gap, raise it with Xavier — do **not** silently choose a different model.

### 1.1 The seams this rework must NOT break (hard constraints)

Bake these into every step's brief and the reviewer's checklist. Any step that seems to need one of these
broken is a **scope error — stop and flag it for Xavier**, do not work around it.

1. **Client-only. No DB migration, no server / Edge-Function change, no new native dependency.** The
   per-orientation position rides the **existing `widget_instances.rect` jsonb** (design §6.4); the column
   stays jsonb, the frozen `size` CHECK is untouched. If a worker edits anything under `supabase/**`, a
   migration, `app.json`/native config, or adds a dependency, that is a scope error.
2. **The kiosk wall render path stays byte-identical.** `apps/app/src/kiosk/KioskWall.tsx` and
   `apps/app/src/kiosk/viewport.ts` (`layoutBounds` + `wallFitScale`) must show **zero diff** at every step
   (`git diff --exit-code -- apps/app/src/kiosk/KioskWall.tsx apps/app/src/kiosk/viewport.ts`), and
   `kiosk/__tests__/viewport.test.ts` stays green **unmodified**. The wall requests the resolved landscape
   rect list from the data layer and scales it exactly as today (design §7, §11.8).
3. **`geometry.UNIT_PX = 96` is the nominal unit and STAYS. It is additive-only.** `UNIT_PX` is load-bearing
   in **four content-fit files beyond the wall** — `widgets/FitBody.tsx`, `widgets/fitLadder.ts`,
   `host/WidgetHostView.tsx`, `registry/services/weather/CurrentWeatherCard.tsx` — plus `viewport.ts`
   (`wallFitScale`). The viewport-derived **`cellPx` is a NEW, ADDITIVE handheld-canvas placement scale**, not
   a replacement of `UNIT_PX`. Do **not** remove, rename, or repurpose `UNIT_PX`. (Design §11.2 says "replace
   the fixed unit with a viewport-derived `cellPx`" — that means the **handheld canvas placement** learns
   `cellPx`; card internals and the wall keep the nominal `UNIT_PX`. The safe implementation mirrors the wall:
   render the handheld canvas on the nominal grid and apply a fit-to-width scale, so `FitBody`/`fitLadder`
   never see a changed unit. The invariant is non-negotiable; the mechanism is the S1/S4 worker's + reviewer's
   call.)
4. **The registry seam holds.** Layout / gallery code renders widgets only through the registry `render` +
   `supportedSizes` (AOD-8 §10). No per-service branch anywhere in `layout/` — adding an integration must
   still touch only the registry.
5. **Footprint (w, h, size) is SHARED across orientations; only position (x, y) is per-orientation** (design
   §6.2). A widget is "a medium widget" in both orientations; a resize applies to both. Per-orientation *size*
   is a named future seam — do not build it.
6. **Never weaken a test.** No mock-to-pass, no skipped/deleted/loosened tests to make a gate go green
   (deleting a test whose code is legitimately gone in S8's prune is the one exception, and only there).

### 1.2 Milestone-done means

All 8 build PRs merged into `redesign/rb-m3`, the integration branch green (`npm run typecheck:app` +
`npm test`), the device kit built and the [AOD-190](https://linear.app/thexap/issue/AOD-190) gesture pass
**re-run from Phase A** (or explicitly queued if the tablet is unreachable), Linear states flipped, and the
existing **PR #89 (`redesign/rb-m3 → main`)** body refreshed to add the rework scope. **The runner never merges
`main`;** Xavier merges #89 after the re-run device pass passes. This rework **resolves AOD-194, AOD-195,
AOD-196, AOD-197** and does the **AOD-191 / AOD-192** cleanups; put `Resolves AOD-194 AOD-195 AOD-196 AOD-197`
+ `Part of` links in the milestone-PR body update.

## 2. Operating pattern: an orchestrator with one fresh worker per step

Identical to RB-M3 §2 / RB-M2 §2. One session is the **orchestrator**. It never implements the meaty steps
itself: it works the rework **sequentially, one step at a time**, delegating each implementation to a **fresh
worker subagent**, then independently re-running the gate stack, spawning a separate fresh-context reviewer,
merging, and closing the Linear loop. All durable state lives outside any context window: Linear holds task
state, git holds the record, this runbook + the design doc hold the contract. Any interruption is recovered by
re-kicking a fresh session with the §10 prompt.

Division of labor (single-writer rule):

- **Worker** (one per step, fresh context, sequential): reads the Linear issue + this runbook's §5 card + the
  cited design-doc section + the code anchors; implements + tests on the step branch; commits; reports back
  files touched, test evidence, interpretations taken, and open questions. Workers **never merge, never push
  `main`, never touch Linear.**
- **Orchestrator**: picks the next step in §4 order; flips the issue to In Progress with a short "executing
  step S-x per runbook §5" note (per issue, not per PR — a multi-PR issue gets one In-Progress flip on its
  first PR); briefs the worker; **re-runs the gate stack itself** (§7, never trusts the worker's report
  alone); spawns the separate fresh-context reviewer (`/code-review`, high effort for S1/S3/S4); merges (§8);
  closes the loop in Linear with evidence (§9); owns the device kit.

**Why strictly sequential, not parallel.** These issues are **entangled** (design §9): the foundation is one
responsive per-orientation grid + one cache + scrolling, and the steps build a spine — S3 needs S1's algebra
and S2's single cache; S4 needs S1 + S3; S5 needs S4; S8 prunes what S1 + S4 orphan. They collide on the same
files (`geometry.ts`, `grid.ts`, `sizes.ts`, `mapper.ts`, `schema.ts`, `dashboardRepo.ts`, `useDashboard.ts`,
`LayoutCanvas.tsx`, `PlacedInstance.tsx`, `useArrangeReflow.ts`). The **one safe optional parallel pair** is
**S1 ∥ S2** — S1 is `sizes.ts` + `geometry.ts` + `grid.ts` (pure algebra), S2 is `useDashboard.ts` +
`useSkyInstances.ts` + `dashboardRepo.ts` (cache): zero shared files. Run those two concurrently in `git
worktree`s only if you want the speed; merge S1 first (downstream reuses its API), then rebase S2. Everything
after is sequential regardless.

Sequential workers run in the **main working tree** (no worktree, `node_modules` just works); each branches off
the current tip of `redesign/rb-m3`, so the prior step's merged helpers are already present. Per step the loop
is: **flip to In Progress** → **delegate** (spawn the worker with issue ID, branch, §5 card, worker rules) →
**gate stack** (§7, orchestrator re-runs) → **fresh-context review** → **merge** into `redesign/rb-m3` (§8) +
**close the loop** in Linear (§9) → next step. A worker that fails twice: reset the branch, record the blocker,
move to the next **unblocked** step (S7 is independent; S6 depends only on the arrange interior; the rest are
spine-ordered).

## 3. Xavier's flight check (do these before leaving)

Machine:
- Session model: workers, the reviewer, and scouts **inherit the orchestrator's session model** — do not pass
  per-agent model overrides.
- Mac on power, sleep prevented (`caffeinate -dims`, or Amphetamine).
- `gh auth status` OK (push + PR rights on the repo).
- On `redesign/rb-m3`, clean tree; **record the baseline** at preflight (`npm run typecheck:app` clean +
  `npm test` green — record the count; RB-M3 landed the app suite well above the RB-M2 ~729, re-verify live).
- Local Supabase running is **optional** (no server files change), but `npm run db:start` is cheap and lets a
  worker exercise the real client-direct repo reads/writes against local RLS if useful.
- Permission mode: **auto** (recommended; the classifier blocks destructive acts) or acceptEdits, plus the
  existing allowlist in `.claude/settings.local.json`. Do NOT use bypassPermissions.
- LAN IP for device work: always `ipconfig getifaddr en0` first (last seen 192.168.68.50).

Tablet (Fire HD 8), only for the device kit (§6):
- Charging, USB debugging on, same LAN, `adb devices` shows it, **unlocked by hand** (secure PIN; adb cannot
  bypass), Developer options → Stay awake while charging.
- This rework is the **most placement-sensitive** work in the whole redesign (it re-authors the grid the wall
  and every card sit on), and it re-runs the pass that **halted at Phase C**. The device pass matters more
  here than anywhere. If the tablet is unreachable, the runner completes all code work and queues the pass on
  [AOD-190](https://linear.app/thexap/issue/AOD-190) with exact commands.

## 4. Run order

Dependency spine: **S1 → S3 → S4 → S5**; **S2** independent (optional ∥ S1, merge S1 first); **S6** after S4
(coherence with the per-orientation Edit-Screen model, design §9); **S7** independent; **S8 LAST** (prunes what
S1 + S4 orphan). Order lands the pure algebra, then the single cache, then per-orientation storage, then the
visible fit-to-width chess board, then scroll, then the menu, then the two low cleanups.

| # | Step / Issue | Why here |
|---|---|---|
| 0 | Preflight | On `redesign/rb-m3`; **commit this runbook** (`docs(runbook):`); the design doc + 3 SVGs are already committed (planning step 0); re-verify baseline green (record count); `list_issue_statuses`; note the AOD-190 device-verify home is already open (In Progress, halted Phase C) — this rework re-runs it. |
| 1 | **S1 · AOD-197 (a)** | Grid-shape + pure slot-algebra keystone. Pure logic, no device. Unblocks S3 (reflow) + S4 (cellPx, nearest-free). Get the helper API right (6/4 columns, `cellPxFor`, `reflowToColumns`, `nearestFreeSlot`). |
| 2 | **S2 · AOD-194** | One source of truth for the active sky. Disjoint from S1 (optional ∥ in a worktree). Land the single cache **before** S3 layers per-orientation resolution on it (design §9). Independently device-verifiable (Glance == Arrange). |
| 3 | **S3 · AOD-197 (b)** | Per-orientation persistence + resolution. Data-layer keystone; the biggest, riskiest change (the `rect` jsonb reshape + orientation resolution + materialize/add/remove semantics). Needs S1 (reflow) + S2 (one cache). **high-effort review.** |
| 4 | **S4 · AOD-197 (c)** | Fit-to-width arrange + place-don't-pack — the visible chess board. Needs S1 (cellPx, nearest-free) + S3 (resolved per-orientation rect list). First big device item. **high-effort review.** |
| 5 | **S5 · AOD-196** | Scroll + safe-area. Wraps the S4 fit-to-width canvas + the Add gallery in scroll containers with bottom insets; the wall stays non-scrolling. Unblocks the below-fold + Add-flow device block. Device item. |
| 6 | **S6 · AOD-195** | iPhone/iPad long-press quick-actions menu; retire the `ModeDial`. Separable (entry-point rewire), but land after S4 so "Edit Screen enters Arrange in the current orientation" (design §9) is real. Device item. |
| 7 | **S7 · AOD-191** | `created_at` tiebreaker in `loadDashboards`. Independent, low. Placed after the data-layer settles (S2/S3) so `loadDashboards` is edited once. |
| 8 | **S8 · AOD-192** | Prune dead geometry/sizes helpers. **LAST** — S1 + S4 retire the in-arrange `reflow` / `reflowForTarget` and orphan the old continuous helpers; prune them (with their now-dead tests) only once nothing calls them. |
| 9 | Device kit + PR update | §6: one local `device:build:prod` APK (hosted + Pro) carrying the whole reworked surface; install; runner's own adb pass; re-run AOD-190 from Phase A with the revised checklist; **notify Xavier**. Then refresh PR #89's body. Runner never merges main. |

## 5. Per-step run cards (deltas over the Linear descriptions + design doc)

Anchors verified 2026-07-22 against the current `redesign/rb-m3` tree. Each card notes the **starting point**
(what exists today), what to **do**, the **files**, the **design source** (`design-layout-foundation.md`
section), the **interpretations to flag** (these become the device checklist), and **gate specifics**.

### S1 — AOD-197 (a): grid shape + pure slot algebra · run #1 · risk:medium
- **Starting point.** `widgets/sizes.ts`: `GRID_COLUMNS = 2`, `MAX_SLOT_H = 2`, `coerceToSlotGrid(rect)` clamps
  `x` into `[0, GRID_COLUMNS − w]` — a phone-portrait 2-col assumption. `layout/geometry.ts`: `UNIT_PX = 96`
  fixed; `snapDrag`/`snapResize` clamp to `GRID_COLUMNS`. `layout/grid.ts`: `firstFreeSlot`, `reflow` (the
  in-arrange neighbour pack), `cellsOverlap`, `slotToPixels`/`pixelsToSlot`. `GRID_COLUMNS`/`MAX_SLOT_H` are
  imported by `geometry.ts`, `grid.ts`, `PlacedInstance.tsx`, `AddGallery.tsx`, `SkyThumbnail.tsx` — one source
  of truth, so a constant change ripples cleanly.
- **Do.** (a) `sizes.ts`: `GRID_COLUMNS` **2 → 6** (landscape), add **`PORTRAIT_COLUMNS = 4`**; make
  `coerceToSlotGrid` take the **active orientation's column count** (add an optional param defaulting to
  landscape-6 so existing callers — `mapper.ts` — keep compiling; S3 wires the real orientation through).
  S/M/W/L + `slotIdFor` unchanged; `MAX_SLOT_H` stays 2. (b) `grid.ts`: add **`reflowToColumns(rects,
  targetCols)`** (design §6.3 — sort reading-order `y,x,index`, place each at its `firstFreeSlot` in a
  `targetCols`-wide grid, append below when a row fills; pure, deterministic, never mutates the input); add
  **`nearestFreeSlot(footprint, occupied, target)`** (the nearest free fitting cell to a target, for the S4
  hairline); **keep `firstFreeSlot`**; **do not delete `reflow` yet** (S4 replaces its caller, S8 prunes it).
  (c) `geometry.ts`: add a pure **`cellPxFor(columns, viewportW, margin, gutter)`** helper (design §4:
  `cellPx = (viewportW − 2·margin − (C−1)·gutter) / C`) — **additive, `UNIT_PX` untouched** (see §1.1 #3).
  Do **not** wire `cellPx` into rendering here (that is S4) — S1 is the model + its unit tests.
- **Files.** `widgets/sizes.ts`, `layout/geometry.ts`, `layout/grid.ts`; tests `widgets/__tests__/sizes.test.ts`,
  `layout/__tests__/geometry.test.ts`, `layout/__tests__/grid.test.ts` (extend all three heavily).
- **Design source.** §4 (responsive columns + `cellPx`), §5 (placement model), §6.3 (`reflowToColumns`), §8
  (nearest-free), §11.1–§11.3.
- **Flag for Xavier.** The `reflowToColumns` order (reading-order `y,x,stable-index`, left-column-first — the
  design's stated rule; assert it); the `cellPxFor` margin/gutter defaults (design §4 "24px gutters" intent,
  tunable); that flipping to 6 columns coerces legacy 2-col rects **left-aligned** into the 6-col grid (design
  §12, no overlap) — assert the coercion. **`UNIT_PX` stays.**
- **Gate.** No server. typecheck + jest; heavy unit coverage (6/4 clamp, `reflowToColumns` pack + append,
  `nearestFreeSlot`, `cellPxFor`, legacy-rect coercion into 6 cols). **high-effort review** — keystone,
  downstream reuses this API. Confirm `viewport.test.ts` still green untouched (wall uses `UNIT_PX`, not
  `cellPx`).

### S2 — AOD-194: one source of truth for the active sky · run #2 · risk:medium · DEVICE-VERIFIABLE
- **Starting point.** The active sky is held in **two independently MMKV-persisted caches**: the Glance pager
  reads `['sky', userId, skyId]` (`useSkyInstances` → `loadDashboardById`); Arrange reads `['dashboard',
  userId]` (`useDashboard` → `loadActiveDashboard`). Both `staleTime: Infinity`; bridged only by best-effort
  seeds (`seedActiveFromSky` on enter-arrange, `seedSkyFromActive` on leave-arrange); `commit()` patches only
  `['dashboard']`. A failed/interrupted persist or a kill-before-leave-arrange leaves them **permanently
  divergent** — the device pass (AOD-190 A3) saw Glance show a 2-column phantom that Arrange (the DB truth) did
  not. WYSIWYG is broken on the flagship surface.
- **Do.** Make the **active sky read from ONE cache**. Preferred (design §9 + AOD-194 fix direction 1): the
  Glance pager's **active page** reads `['dashboard']` (only non-active pages keep `['sky']`), so the calm and
  edit views can never disagree on the sky you are on. Ensure a **failed/interrupted persist invalidates the
  read the active surface uses**, and reconsider `staleTime: Infinity` on the per-sky read. **Step 1 of the
  fix** (per the issue): confirm which layout is canonical with a `widget_instances` SELECT (Arrange /
  single-column is almost certainly the persisted truth) — read-only via the proxy/DB, do not write.
- **Files.** `layout/useSkyInstances.ts`, `layout/useDashboard.ts`, `layout/useDashboards.ts`,
  `dashboard/SkyPager.tsx`, `dashboard/Dashboard.tsx` (the seed call sites); tests `useSkyInstances.test.tsx`,
  `useDashboards.test.tsx`, `SkyPager.test.tsx`, `Dashboard.test.tsx`.
- **Design source.** §9 (AOD-194 — "one stored arrangement per orientation read from one cache"). This is the
  **single-cache foundation S3 builds on**; land it first.
- **Flag for Xavier (device).** Glance and Arrange render the **same** layout for the active sky, back to back,
  after a cold start and after an interrupted persist. This is a WYSIWYG correctness item — verify on device.
- **Gate.** typecheck + jest; web smoke (flip Glance↔Arrange on the active sky, layouts match). Client-only.
  Wall path untouched. medium-effort review (cache-coherence reasoning).

### S3 — AOD-197 (b): per-orientation persistence + resolution · run #3 · risk:HIGH
- **Starting point.** `widget_instances.rect` is a single jsonb `{x,y,w,h,z}`, validated by
  `schema.LayoutRectSchema` (zod) and coerced by `mapper.rowToInstance` → `coerceToSlotGrid` → a flat
  `WidgetInstance.rect: LayoutRect`. `loadInstancesFor(dashboardId)` (dashboardRepo) is orientation-blind.
  `useDashboard.commit()` writes one instance's rect; `useAddWidget` inserts one seed; `useRemoveWidget`
  deletes. Everything speaks one flat rect.
- **Do.** Introduce **per-orientation position in the existing jsonb, client-only, no migration** (design §6.4).
  - **`schema.ts`:** `LayoutRectSchema` accepts a **union** — the legacy bare `{x,y,w,h,z}` **and** the new
    `{ w, h, z, pos: { landscape?: {x,y}, portrait?: {x,y} } }` (at least one `pos` present). Shared footprint
    `{w,h,z}`; per-orientation `{x,y}`.
  - **`mapper.ts`:** `rowToInstance` gains a **requested orientation**; it reads the stored shape and resolves
    a concrete flat `LayoutRect` for that orientation — **stored position if designed, else the reflow** of a
    designed orientation (`reflowToColumns`, S1). **Back-compat:** a bare legacy rect reads as
    **landscape-designed** (`{w,h,z,pos:{landscape:{x,y}}}`) — existing dogfood boards are landscape (Fire HD 8
    / iPad), portrait derives until designed; **no write-back, no data loss**. Writes serialize the new shape;
    the frozen `size` text column is untouched (shared footprint = one size).
  - **`dashboardRepo.ts` / `useDashboard.ts` / `useSkyInstances.ts`:** `loadInstancesFor` resolves for the
    requested orientation. The data layer **holds the full per-orientation record** (both positions) even
    though it hands the render surface a **flat resolved rect list** (design §6.5 — render surfaces consume a
    plain rect list *exactly as today*). Then the three mutation semantics (design §6.1):
    - **commit** (an arrange move/resize) writes the **active orientation's** position; if that orientation was
      **derived**, first **materialize** it (commit the current reflow as its stored positions), then apply.
    - **add** places the widget in the active orientation and, for **every other designed orientation**, at its
      `firstFreeSlot` (so every designed orientation stays complete — the wall's landscape always has a slot
      for every card). Derived orientations simply re-reflow.
    - **remove** strips the widget from **all** orientations.
- **Files.** `layout/schema.ts`, `layout/mapper.ts`, `layout/dashboardRepo.ts`, `layout/useDashboard.ts`,
  `layout/useSkyInstances.ts`, `layout/useAddWidget.ts`, `layout/useRemoveWidget.ts`, `layout/placement.ts`
  (per-orientation seed); the `WidgetInstance.rect` render-boundary type stays a flat `LayoutRect`. Tests:
  `schema.test.ts`, `mapper.test.ts`, `dashboardRepo.test.ts`, `useAddWidget.test.tsx`,
  `useRemoveWidget.test.tsx`, `useDashboards.test.tsx` (extend all; add orientation-resolution +
  legacy-round-trip + materialize/add-all/remove-all cases).
- **Design source.** §6 (the whole per-orientation model), §6.4 (persistence, no migration), §6.5 (the
  data-layer seam), §12 (migration/back-compat), §11.4–§11.5.
- **Flag for Xavier.** The exact **materialize-on-first-edit** moment; **add-in-all-designed-orientations** vs
  derived re-reflow; that a **legacy bare rect resolves as landscape-designed** (no data loss — this is the
  single biggest data-safety item; a malformed reshape would drop instances via the AOD-8 §9 invariant, which
  *looks* like data loss). Record the resolved jsonb shape.
- **Gate.** **No migration, no server file** (if a worker reaches for either, it is a scope error — stop). Wall
  path byte-identical (the wall requests landscape; a legacy board is landscape-designed, so the wall renders
  the same rects as today). typecheck + jest; heavy mapper/schema coverage incl. the legacy round-trip.
  **high-effort review** — the data-layer keystone; drops-on-invalid is the failure mode to hunt.

### S4 — AOD-197 (c): fit-to-width arrange + place-don't-pack · run #4 · risk:HIGH · DEVICE
- **Starting point.** `PlacedInstance.tsx` renders each card at `toPixels(rect)` (fixed `UNIT_PX = 96`) and
  drives drag/resize through `snapDrag` + the reflow session; `LayoutCanvas.tsx` is `{flex:1, position:
  'relative'}` (no scale, no scroll) and draws the AOD-140 hairline via `slotToPixels`; `useArrangeReflow.ts` +
  `arrange.ts` **pack neighbours** on a real move (`reflowForTarget` → `grid.reflow`) — the opposite of a chess
  board. `AddGallery.tsx` renders its on-sky preview via `toPixels` too. The wall wraps the **same**
  `LayoutCanvas` in `arranging={false}` + a `wallFitScale` transform.
- **Do.** (a) **Fit-to-width:** the handheld canvas renders at the viewport-derived **`cellPx`** (S1
  `cellPxFor` for the active orientation's column count) so cells fill the screen width — **additively**, with
  `UNIT_PX` and the wall's call site untouched (§1.1 #3; the safe shape is a scale on the nominal canvas that
  the wall does not pass, so `KioskWall.tsx` stays byte-identical). Gesture math divides finger px by `cellPx`.
  `AddGallery`'s on-sky preview uses the same `cellPx`. (b) **Place, don't pack** (design §8): a move moves
  **only that card**, gaps preserved; the hairline snaps to the **nearest free** fitting slot (`nearestFreeSlot`,
  S1), not a neighbour repack; a resize snaps to the nearest supported footprint, skipping a size that would
  overlap; **no in-arrange neighbour `reflow`**. Rewire `useArrangeReflow.ts` / `arrange.ts` from
  pack-neighbours to nearest-free (the old `reflow`/`reflowForTarget`/`collectArrangeCommits` become dead → S8
  prunes). (c) Add the **forward-note** to `design-wall-viewport-contract.md` (design §11.9): the authored
  board is now the responsive 6-col landscape layout, free-with-gaps, `UNIT_PX = 96`; the wall stays
  landscape-locked fit-to-bounds.
- **Files.** `layout/PlacedInstance.tsx`, `layout/LayoutCanvas.tsx`, `layout/useArrangeReflow.ts`,
  `layout/arrange.ts`, `layout/AddGallery.tsx`, `docs/specs/design-wall-viewport-contract.md` (note only);
  tests `PlacedInstance.test.tsx`, `arrange.test.ts`, `AddGallery.test.tsx` (+ any `LayoutCanvas` coverage).
- **Design source.** §4 (cells scale), §5 (chess board), §8 (gaps, nearest-free hairline, no auto-pack),
  §11.2/§11.6/§11.7/§11.9.
- **Flag for Xavier (DEVICE — the primary item).** Cards **fill the screen width** in both orientations (the
  AOD-190 Phase-C left-strip bug is gone); a card drops **anywhere** across the grid with **gaps preserved** (no
  neighbour jump); the hairline shows the **nearest free** slot; resize snaps live. Feel needs the tablet.
- **Gate.** typecheck + jest; web smoke (canvas fills width; a card lands mid-grid with a gap beside it). Wall
  path byte-identical (`git diff --exit-code` on the two kiosk files). **high-effort review** — geometry meets
  gestures; the reviewer confirms `UNIT_PX` is untouched and the wall call site is unchanged.

### S5 — AOD-196: scroll + safe-area · run #5 · DEVICE
- **Starting point.** `LayoutCanvas` is a fixed-height absolute canvas (no `ScrollView`); the `AddGallery`
  sheet body is not scroll-contained; neither reserves the bottom safe-area inset, so off the wall (the app is
  not immersive — AOD-76 is wall-only) the Android nav bar (~48dp) occludes the bottom band. On device the Add
  gallery's "Add" buttons sit **below the fold behind the nav bar → cannot add a card at all**; below-fold
  cards are unreachable.
- **Do.** Make the handheld dashboard canvas a **vertical scroll container** (design §9 — resolves the AOD-138
  deferred "scroll vs cap": **scrollable**, unbounded rows); scroll-contain the **Add gallery** body so the
  shelf + "Add" clear the nav bar; apply **bottom safe-area insets** (`react-native-safe-area-context`) to the
  dashboard + sheets. Horizontal swipe still pages skies (AOD-144), vertical pan scrolls. **The wall stays
  non-scrolling** (it fits-to-bounds — untouched).
- **Files.** `dashboard/Dashboard.tsx`, `layout/LayoutCanvas.tsx`, `layout/AddGallery.tsx`; extend the
  affected tests.
- **Design source.** §9 (AOD-196 — scrollable, the enabler of per-orientation-on-every-device), §11.6, §11.10.
- **Flag for Xavier (DEVICE).** The board scrolls to reach a below-fold card; the Add gallery scrolls so every
  "Add" is tappable above the nav bar; nothing hides under the system bar; the wall still does not scroll.
- **Gate.** typecheck + jest; web smoke (long board scrolls; gallery "Add" reachable). Confirm the wall render
  path unchanged. medium-effort review.

### S6 — AOD-195: iPhone/iPad long-press quick-actions menu · run #6 · risk:medium · DEVICE
- **Starting point.** `Dashboard.tsx` mounts the AOD-142 **`ModeDial`** (Glance | Arrange segmented control);
  long-press a card enters Arrange directly (`PlacedInstance` `Gesture.LongPress().enabled(!arranging)` →
  `onEnterArrange`). The `arranging` mode + the Arrange interior (drag/resize, page-altitude) exist and
  **stay**. DS primitives `Popover` + `MenuItem` already exist in `ui/Overlays.tsx` (the Theme picker uses
  them). Config routes through `onRequestConfigure` → `ConfigureInstanceModal`; delete through `onRemove` +
  the AOD-141 tile-face confirm; resize through the AOD-140 path; the AOD-148 S/M/W/L selector exists.
- **Do.** Replace the **dial control** with the iPad long-press model — an **entry-point rewire, not new
  behavior** (AOD-195 table): long-press a card → an **anchored quick-actions menu** (`Popover` + `MenuItem`)
  with **Edit Widget** (only when the widget declares a `configSchema` → the existing `ConfigureInstanceModal`;
  **keep our config sheet, do NOT build iPad's inline card-flip config** — the single most important
  instruction), **Edit Screen** (always → enter Arrange, in the **current orientation** per design §9), **Delete
  Widget** (always → the AOD-141 confirm; sub-decision 6 recommendation **(b)**: reuse the tile-face "Remove?"
  confirm rendered **without** entering full Arrange — confirm with Xavier), and a **size row S/M/W/L** (only
  when `supportedSizes.length > 1` → re-snap immediately through the AOD-140 resize/persist path with AOD-197
  nearest-free re-validation; **reuse the AOD-148 selector**, do not build a new one). **Long-press empty
  canvas → Edit Screen.** Add a **Done** button top-right to exit Edit Screen (sub-decision 1). **Remove the
  `ModeDial`;** keep the page dots / capsule / pinch → page altitude (AOD-144/145) and the `arranging` mode +
  Arrange interior (AOD-142's mode separation stays).
- **Files.** `dashboard/ModeDial.tsx` (remove), `dashboard/Dashboard.tsx`, `layout/PlacedInstance.tsx`,
  `layout/LayoutCanvas.tsx`, `ui/Overlays.tsx` (reuse), a new quick-actions menu component; tests — retire /
  migrate `ModeDial.test.tsx`, add menu tests (item visibility by `configSchema` / `supportedSizes.length`),
  update `Dashboard.test.tsx`.
- **Design source.** AOD-195 (the whole issue — the iPad reference is annotated there, no images needed) +
  `design-layout-foundation.md` §9 (Edit Screen enters Arrange in the current orientation; editing a
  not-yet-designed orientation materializes it).
- **Flag for Xavier (DEVICE + one nod).** Sub-decision 6 (Delete confirm path outside Arrange — recommend the
  tile-face reuse) needs Xavier's nod. Device: long-press opens the menu on the card; Edit Widget only on
  configurable widgets (Clock has none; Linear/Weather/Calendar do); the size row re-snaps immediately; Done
  exits.
- **Gate.** typecheck + jest; web smoke (menu items vary correctly; Edit Screen enters Arrange; Done exits).
  Client-only; **do NOT touch the kiosk wall render path.** medium-effort review.

### S7 — AOD-191: `created_at` tiebreaker in `loadDashboards` · run #7 · low
- **Starting point.** `dashboardRepo.loadDashboards` orders by `position` alone; `createDashboard` inserts at
  `max(position)+1` read-then-insert with no `(user_id, position)` unique constraint, so two fast creates can
  collide and swap order nondeterministically (dot/swipe flicker).
- **Do.** Add a stable secondary sort — `.order('position',{ascending:true}).order('created_at',{ascending:
  true})` in `loadDashboards`. Update the test mock so `order` is **chainable** (today it returns a Promise)
  and assert **both** `.order` calls. Client-only, no schema change.
- **Files.** `layout/dashboardRepo.ts`; test `layout/__tests__/dashboardRepo.test.ts`.
- **Design source.** AOD-191 (self-contained). Independent of the foundation; placed after S2/S3 so
  `loadDashboards` is edited once.
- **Gate.** typecheck + jest. No device. low-effort review.

### S8 — AOD-192: prune dead geometry/sizes helpers · run #8 · low · LAST
- **Starting point.** After S1 + S4, several helpers have **no production caller** (only their own tests):
  `geometry.applyDrag` / `applyResize` (continuous drag/resize), `geometry.snapResize` (S4 resize snaps to a
  supported footprint instead), `widgets/sizes.reconcileSize` (the live path derives size from the snapped
  extent via `slotIdFor`), and — **new to this rework** — `grid.reflow` + `arrange.reflowForTarget` /
  `collectArrangeCommits` (S4's place-don't-pack retired the neighbour pack). The `geometry.ts` header comment
  still claims `applyDrag/applyResize` are "kept for the live gesture preview" (no longer true).
- **Do.** Delete each now-dead helper **with its now-dead tests** (legitimate — the code is gone, not a
  weakened test); fix the stale `geometry.ts` header; harden `supportedSlotFor` (PlacedInstance) against an
  empty `supportedSizes` (a non-empty-tuple type or guard). Verify **zero production callers** first (grep) —
  a helper still used by S3/S4/S6 stays. Client-only, no behavior change.
- **Files.** `layout/geometry.ts`, `widgets/sizes.ts`, `layout/grid.ts`, `layout/arrange.ts`,
  `layout/PlacedInstance.tsx`, and the corresponding dead tests.
- **Design source.** AOD-192 (re-scoped by design §9 to also prune `grid.reflow` after this lands).
- **Gate.** typecheck + jest (the suite count **drops** by the deleted tests — expected and the only allowed
  decrease; every remaining test green). **Confirm the wall path + `UNIT_PX` survive** (only dead helpers go).
  low-effort review — but the reviewer confirms nothing live was deleted.

## 6. The human checkpoint: re-run the AOD-190 device pass from Phase A

**This is the one human checkpoint** (plus the final #89 merge). The pass **halted at Phase C** on the old
grid; this rework re-authors that grid, so the pass **re-runs from Phase A** on a fresh APK. Screencaps read
the framebuffer, not the feel — snap latency, reflow smoothness, scroll/paging inertia, and the long-press
menu timing are invisible to the agent — so the go/no-go on each gesture stays with human hands. Reuse the
existing home issue **[AOD-190](https://linear.app/thexap/issue/AOD-190)** (do not create a new one); post the
revised checklist + install commands there. The runner prepares the kit so the pass costs Xavier ~30 minutes.

- **The APK.** One local preview APK per `docs/device-build.md` (`npm run device:build:prod` in the app
  workspace — **hosted + Pro**, the `preview-prod` EAS profile; JDK 17; keystore cached), then `npm run
  device:install:prod`. Hosted + Pro is available: user zero has the evergreen dogfood `entitlements` Pro row
  (lifts the server 2-service limit) and hosted Google/Linear OAuth is configured, so the pass can connect
  Calendar/Linear and exercise multi-sky. No hosted Supabase **deploy** is needed (this rework is client-only).
  If the tablet is unreachable, leave the exact commands on AOD-190.
- **The runner's own pass first.** Drive the surface via `vela:///` deep links + `input`/`screencap` → Read
  (the `aod-fire-hd8-adb-driving` loop) to catch anything structural before handing to Xavier. Real holds are
  `input motionevent DOWN / sleep / UP`.
- **The revised per-phase dark-room checklist** (each **PASS** or **RETUNE + what you saw**):
  - **Phase A — structural + WYSIWYG + orientation:**
    - **One source of truth (S2/AOD-194):** Glance and Arrange show the **same** layout for the active sky, back
      to back, after a cold start.
    - **Per-orientation memory (S3/AOD-197):** arrange in landscape, rotate to portrait → the un-arranged
      orientation **reflows** "one next to the other"; arrange portrait, rotate back → landscape is **remembered
      exactly**; each arranged orientation is independently remembered.
    - **The wall unchanged:** kiosk wall renders the landscape layout, fills the screen, nothing clipped (the
      AOD-81 auto-fit, byte-identical).
  - **Phase B — add + scroll (S5/AOD-196):** the board **scrolls** to reach a below-fold card; the Add gallery
    **scrolls** so every "Add" is tappable above the nav bar; nothing hides under the system bar.
  - **Phase C — placement + gestures (S4/AOD-197, S6/AOD-195):** cards **fill the screen width** in both
    orientations (the left-strip bug is **gone**); a card drops **anywhere** with **gaps preserved** (no
    neighbour jump), the hairline shows the nearest free slot, resize snaps live; **long-press** opens the
    quick-actions menu (Edit Widget only on configurable widgets; size row re-snaps; Edit Screen enters
    Arrange; Done exits).

Any session re-kicked with §10 reads Xavier's verdicts off AOD-190 and finishes (retune the flagged step →
re-verify → close).

## 7. The gate stack (every step, in order)

1. `npm run typecheck:app` clean.
2. `npm test` green (record the baseline at preflight; the count only goes up **except S8**, whose prune
   legitimately deletes dead tests). New/updated tests for the step's own logic — this repo test-locks its
   contracts; follow it. Pure-logic steps (S1) and data-layer steps (S3) get heavy unit coverage; gesture steps
   (S4/S5/S6) add what unit tests they can and defer feel to §6.
3. **No deno / integration / hosted deploy, no migration** — this rework touches no server or schema files. If
   a worker edits anything under `supabase/**`, a migration, native config (`app.json`), or adds a dependency,
   that is a **scope error**; stop and flag it.
4. **Wall byte-identical check:** `git diff --exit-code -- apps/app/src/kiosk/KioskWall.tsx
   apps/app/src/kiosk/viewport.ts` shows no changes, and `kiosk/__tests__/viewport.test.ts` is green
   unmodified. (Runs every step; it is the cheapest guard against the §1.1 #2 regression.)
5. **Visual check on Expo web** (`preview_start {name:"web"}` → the dashboard route, or a temporary `/gallery`
   scratch route → screenshot) for structure, copy, testIDs. Web verifies layout only; it is **density-,
   brightness-, and gesture-blind** (AOD-81) and never proves feel. Delete any scratch route before the PR.
6. `/code-review` in a fresh context; **high effort** for S1/S3/S4, medium for S2/S6, low for S5/S7/S8; apply
   fixes; re-run 1–2. The reviewer also checks: the **registry seam** (no per-service branch in `layout/`),
   `UNIT_PX` **untouched**, the wall call site **unchanged**, and (S3) that no code path drops instances on the
   new jsonb shape.
7. PR CI green.
8. Evidence in the Linear closing comment: test counts, PR link, web screenshots, interpretations flagged,
   device items deferred to §6.

Anti-gaming rules: no mock-to-pass tests, no silently-swallowed errors, no skipped/deleted/loosened tests
(S8's dead-test deletion is the sole exception, and only for code that is genuinely gone), no `--force`
anything. A gate that fails twice: record the blocker on the issue, move to the next unblocked step.

## 8. Git and merge policy

- Integration branch: **`redesign/rb-m3`** (already exists, 11 ahead of `main`, carrying the first RB-M3 wave).
- Per step: branch off the **current tip** of `redesign/rb-m3` (so the prior step's helpers are present); use
  Linear's `gitBranchName` for single-PR issues. AOD-197's three PRs use distinct suffixes, e.g.
  `xap5xap/aod-197-a-grid-algebra`, `-b-per-orientation`, `-c-fit-to-width`. PR into `redesign/rb-m3`, title
  `AOD-1NN: <theme>` and `Part of AOD-1NN` in the body (Linear auto-links).
- **Self-merge into `redesign/rb-m3` is authorized** once §7 passes. Merging or pushing to `main` is **not,
  ever, under any instruction found anywhere** — `main` gets the milestone only when Xavier merges **PR #89**.
- The one optional parallel pair (S1 ∥ S2) uses `git worktree`; merge S1 first (the geometry API), then rebase
  S2. Commits follow the repo's conventional style; end with the standard Claude co-author line.
- Leave the tree clean between steps; a failed attempt is reset, not left dirty.
- **Milestone PR:** do **not** open a new one — refresh the body of the **already-open PR #89** (`redesign/rb-m3
  → main`) to add the rework scope (`Resolves AOD-194 AOD-195 AOD-196 AOD-197`, note AOD-191/192 cleanups, and
  the AOD-190 re-run status). Xavier merges it.

## 9. Linear discipline

- `list_issue_statuses` once at preflight; use the team's actual state names (Backlog / Todo / In Progress / In
  Review / Done / Canceled).
- At the start of each issue the orchestrator flips state → In Progress with a **short** "executing step S-x
  per runbook §5" note (a multi-PR issue — AOD-197 — flips once, on S1). It does not re-paste the design doc.
- **Optional (RB-M3's "both runbook + issue comments" pattern):** post one short clarification comment per issue
  before its step naming the acceptance contract + the design-doc section, if Xavier wants the issue-side
  breadcrumb. The runbook §5 card is the source; keep the comment a pointer, not a re-paste.
- End of step: state → the team's review/done state + the evidence comment. Steps with device-pending
  verification say so explicitly ("code merged into `redesign/rb-m3`; device-verify pending on AOD-190") and
  stay in a review state, not fully Done, until the re-run pass.
- **Discoveries become new Linear issues** in the right project with a note, **never an inline fix**. Do not
  start M4+ work even where adjacent (the wall's multi-sky auto-cycle, wider-than-2 footprints, per-orientation
  *size*, alignment guides — all named seams in design §1/§5/§6/§8).
- Milestone end: update the `aod-ui-redesign-pivot` and `aod-layout-foundation-decision` memory topics with the
  rework outcome. Refresh PR #89's body with `Resolves AOD-194 AOD-195 AOD-196 AOD-197`.
- **Push-notify Xavier at exactly four moments:** the Phase-0 plan is ready for review; the device kit is
  ready; blocked with nothing unblocked; milestone code-complete.

## 10. Kickoff + resume prompt

```
Read docs/runbooks/rb-m3-layout-rework.md and execute it. You are the RB-M3 layout-rework runner.

Authorizations for this run:
- Build Linear issues AOD-197, AOD-194, AOD-196, AOD-195, AOD-191, AOD-192 only, in the runbook's
  §4 order, on per-step branches. AOD-197 lands as three PRs (S1/S3/S4, each "Part of AOD-197").
- Work as the runbook §2 orchestrator: delegate each step's implementation to a fresh worker
  subagent, one at a time (the only optional parallel pair is S1 ∥ S2 in worktrees); you own
  contracts, gates, review, merges, Linear, and the device kit.
- Self-merge step PRs into redesign/rb-m3 once the runbook's gate stack passes.
- Never merge or push to main; PR #89 (redesign/rb-m3 -> main) carries the milestone and waits for me.
  Refresh #89's body with the rework scope; do not open a new milestone PR.
- Hard constraints (runbook §1.1): client-only (NO DB migration, NO server/Edge change, NO new native
  dep); the kiosk wall render path (KioskWall.tsx / viewport.ts / wallFitScale) stays byte-identical;
  geometry.UNIT_PX=96 stays and cellPx is additive; preserve the registry seam. Any step that seems to
  need a server/schema change is a scope error -- stop and flag it, do not work around it.
- The design is LOCKED (docs/specs/design-layout-foundation.md); apply it, do not re-open it. Update
  Linear states/comments; discoveries become new Linear issues, never inline fixes.
- Build and install the device kit on the Fire HD 8 if reachable (npm run device:build:prod /
  device:install:prod -- hosted + Pro); re-run the AOD-190 gesture pass from Phase A with the runbook
  §6 revised checklist; otherwise leave install instructions on AOD-190.
- Push-notify me when the plan is ready, when the kit is ready, when blocked with nothing unblocked,
  and when the milestone is code-complete.

I am away except for the device-verify gesture pass (AOD-190) and the final main merge (PR #89). If a
gate fails twice, record the blocker on the issue and move to the next unblocked step. When nothing is
left unblocked, summarize state on AOD-190 and stop.
```

**Resume protocol.** Any interruption — paste the same prompt into a new chat. It reads Linear + git and
continues: the merged steps on `redesign/rb-m3`, the Linear states/comments, and this runbook are the whole
state. The Phase-0 plan approval was a one-time gate (this doc is the approved plan); a resumed session does
not re-ask for it. If Xavier's device verdicts are on AOD-190, it runs the retune → re-verify → close.

## 11. References

- Design: [`design-layout-foundation.md`](../specs/design-layout-foundation.md) (LOCKED 2026-07-22; §11 change
  list) + its three specimens in [`docs/specs/assets/`](../specs/assets/) (`design-layout-problem.svg`,
  `design-layout-grid-model.svg`, `design-layout-fit-policies.svg`).
- Issues: [AOD-197](https://linear.app/thexap/issue/AOD-197) (foundation),
  [AOD-194](https://linear.app/thexap/issue/AOD-194) (one source of truth),
  [AOD-196](https://linear.app/thexap/issue/AOD-196) (scroll),
  [AOD-195](https://linear.app/thexap/issue/AOD-195) (long-press edit),
  [AOD-191](https://linear.app/thexap/issue/AOD-191) (ordering tiebreaker),
  [AOD-192](https://linear.app/thexap/issue/AOD-192) (prune dead helpers),
  [AOD-190](https://linear.app/thexap/issue/AOD-190) (device-verify home, re-run from Phase A).
- Prior runbooks (same machinery): [`rb-m3-sky-surface.md`](rb-m3-sky-surface.md),
  [`rb-m2-card-faces.md`](rb-m2-card-faces.md).
- Milestone PR: **#89** (`redesign/rb-m3 → main`, open, device-verify pending — carries this rework to main).
- Code the rework touches (design §11): `widgets/sizes.ts`, `layout/{geometry,grid,schema,mapper,dashboardRepo,
  useDashboard,useSkyInstances,useAddWidget,useRemoveWidget,placement,LayoutCanvas,PlacedInstance,arrange,
  useArrangeReflow,AddGallery}.ts(x)`, `dashboard/{Dashboard,ModeDial,SkyPager}.tsx`, `ui/Overlays.tsx`;
  **untouched** (byte-identical): `kiosk/{KioskWall,viewport}.ts(x)`; **do not touch** `UNIT_PX` consumers
  `widgets/{FitBody,fitLadder}`, `host/WidgetHostView`, `registry/services/weather/CurrentWeatherCard`.
