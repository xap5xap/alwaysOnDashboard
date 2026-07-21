# RB-M3 The Sky surface: autonomous run book

> Status: **authored 2026-07-21.** The execution contract for running milestone **RB-M3 The Sky surface**
> (Linear project "Redesign Build") autonomously while Xavier is away. Companion to
> [`redesign-build-audit.md`](../specs/redesign-build-audit.md) §1.3 (the scoping narrative), the three
> Sky-surface design boards in `claude-design/` (`Vela - Many Skies.pdf`, `Vela - Many Skies - v2.pdf`,
> `Vela - The sky fills in.pdf`), and the Linear issues themselves (task state). Same shape and machinery
> as the shipped [`rb-m2-card-faces.md`](rb-m2-card-faces.md); this doc holds only what neither Linear nor
> the specs hold: the run order, the gate stack, the merge policy, and the device checkpoint. Linear is the
> single source of task state; do not duplicate it here.

## 1. Mission and hard scope

Rebuild the dashboard **Sky surface** on the RB-M1 slot-grid contract: a real 2-column slot grid with
live-snap arrange, first-free-slot placement, multiple swipeable "skies" (dashboards) with a Glance/Arrange
dial and page-altitude thumbnails, and the preview-first Add-by-Seeing gallery. The milestone is 12 Linear
issues — **10 build + 1 already-shipped + 1 deferred**:

| RB | Linear | Title (short) | Risk | Notes |
|---|---|---|---|---|
| RB-20 | AOD-138 | 2-col **slot-grid** geometry model | medium | keystone; pure logic |
| RB-21 | AOD-139 | **First-free-slot** placement (+ rapid-add fix) | — | resolves AOD-103 |
| RB-22 | AOD-140 | **Slot drag + live-snap resize** (WYSIWYG) | medium | resolves AOD-98 · **device** |
| RB-23 | AOD-141 | Per-widget delete-in-place | — | **DONE** (PR #76) — not in this run |
| RB-24 | AOD-142 | **Glance / Arrange** mode dial | — | the edit-guard |
| RB-25 | AOD-143 | Multi-dashboard (**skies**) data layer | medium | load-bearing for M4/M5/M6 |
| RB-26 | AOD-144 | **Paged sky pager** in Glance (dots, Pro gate) | — | **device** |
| RB-27 | AOD-145 | **Page altitude** in Arrange (thumbnails) | — | should · **device** |
| RB-28 | AOD-146 | **Cross-sky card move** (carry to the edge) | — | could · **device** |
| RB-29 | AOD-147 | **Add-by-Seeing** gallery (preview-first) | — | resolves part of AOD-102 |
| RB-30 | AOD-148 | Already-added + **size-by-seeing** in the gallery | — | resolves AOD-102 |
| RB-31 | AOD-149 | Ghost-connect-in-place | medium | **DEFERRED to M5** (see §5) |

(RB numbers are this doc's shorthand; trust the AOD identifiers.) These are **applications of the frozen
RB-M1 seams** — do not rebuild the seams:

- `apps/app/src/widgets/sizes.ts` — `SIZE_CATALOGUE` (**S 1×1 / M 1×2 / W 2×1 / L 2×2**, cols×rows nominal
  units), `GRID_COLUMNS = 2`, `coerceToSlotGrid` (snaps a persisted rect to the 2-col grid on every DB read),
  `reconcileSize` (picks a size class from a continuous rect). **The grid already exists at the read
  boundary** — RB-M3 extends it to the live arrange canvas; it does not invent it.
- `apps/app/src/layout/geometry.ts` — `UNIT_PX = 96` (DP/unit), `toPixels` / `applyDrag` / `applyResize`
  (today **continuous**, no snapping — this is what AOD-138 makes discrete).
- `apps/app/src/registry/` — the service→widget seam. A widget declares `supportedSizes` + `render`
  (`registry/types.ts`); `registry.addableWidgets(connected)` gates the catalog. **Adding an integration
  still touches only the registry** — no layout/dashboard edit. Preserve this in every issue.
- The RB-M1 lifecycle (`widgets/lifecycle.ts`) six states + **ghost**, and the `FitBody` fit-to-bounds body.
- The **"Arrange" label is already adopted** (RB-11/M1 retired "Tend"). **In the design PDFs "Tend" == code
  "Arrange".** Translate as you read the boards.

**Hard caps.** Touch only these issues. Anything discovered along the way (bug, cleanup, idea) becomes a
**new Linear issue** in the right project with a note, never an inline fix. Do not start M4+ work even where
adjacent (onboarding, the real paywall screen, real in-session OAuth, the wall's multi-sky cycle). Do not
edit the design PDFs. **Never weaken a test.**

**This milestone is 100% client-side.** No schema migration, no Edge-Function / server change, no hosted
Supabase deploy, no new native dependency. The DB is already multi-dashboard-ready (`dashboards.position`,
no per-user unique constraint; `widget_instances` DELETE granted under RLS). If an issue seems to need a
server or schema change, that is a scope error — stop and flag it for Xavier.

**Two scope boundaries that will tempt a worker:**
1. **The 2nd-sky Pro gate is client-UX only in M3.** It reads the existing client `maxDashboards`
   entitlement (FREE=1 / PRO=∞, `useEntitlements`), exactly as the switcher's LockRow does today. Real
   server enforcement + the 2-door model is **RB-38 (M4)** — do not build server enforcement here.
2. **The full paywall screen is M4.** M3 only builds the *in-place* "second sky is Pro" invite sliver
   (Many Skies §1f Take A); tapping through to the paywall is the existing `/paywall` route.

**Milestone-done means:** the 10 build issues merged into `redesign/rb-m3` (or explicitly
device-verify-pending), the integration branch green (typecheck + jest), the device kit staged, AOD-149's
deferral recorded, and one PR `redesign/rb-m3 → main` open for Xavier with the milestone summary. RB-M3
**closes AOD-98, AOD-102, AOD-103** (and AOD-104 already closed via AOD-141) — put `Resolves AOD-98/102/103`
in the milestone PR body, or hand-close them if the squash-merge does not.

## 2. Operating pattern: an orchestrator with one fresh worker per issue

Identical to RB-M2 §2. One session is the **orchestrator**. It never implements the meaty issues itself: it
works the milestone **sequentially, one issue at a time**, delegating each implementation to a **fresh worker
subagent**, then independently re-running the gate stack, spawning a separate fresh-context reviewer,
merging, and closing the Linear loop. All durable state lives outside any context window: Linear holds task
state, git holds the record, this runbook holds the contract. Any interruption is recovered by re-kicking a
fresh session with the §10 prompt.

Division of labor (single-writer rule):

- **Worker** (one per issue, fresh context, sequential): reads the Linear issue + its posted clarification
  comment + this runbook's §5 card + the cited design board (via `pdftotext`, see §5 head) + the code
  anchors; implements + tests on the issue branch; commits; reports back files touched, test evidence,
  interpretations taken, and open questions. Workers **never merge, never push `main`, never touch Linear.**
- **Orchestrator**: picks the next issue in §4 order; confirms the acceptance-contract on the Linear issue
  (a clarification comment is already posted per issue — the orchestrator adds a short "In Progress,
  executing per the clarification comment + runbook §5.x" note, it does not re-paste the whole contract);
  briefs the worker; re-runs the gate stack itself (§7, never trusts the worker's report alone); spawns the
  separate fresh-context reviewer; merges (§8); closes the loop in Linear with evidence (§9); owns the device
  kit.
- **Inline exception**: AOD-149 is **deferred, no build** — the orchestrator handles it directly (a Linear
  comment noting the M5 deferral; no worker, no branch).

**Why strictly sequential, not parallel.** The Sky-surface issues collide heavily on shared files —
`dashboard/Dashboard.tsx`, `layout/LayoutCanvas.tsx`, `layout/PlacedInstance.tsx`, `layout/useDashboard.ts`,
`layout/WidgetPicker.tsx` — and most depend on the geometry (AOD-138) or data-layer (AOD-143) keystone
landing first. Parallel workers would fight over those files and over half-built helpers. The **one safe
parallelization** is AOD-138 (geometry: `geometry.ts` + `sizes.ts` + `placement.ts`) and AOD-143 (data:
`dashboardRepo.ts` + `useDashboard.ts`) — they share zero files. Only run those two concurrently (each in a
`git worktree`) if you want the speed; otherwise keep it linear. Everything after consumes one or both, so
it is sequential regardless.

Sequential workers run in the **main working tree** (no worktree, node_modules just works); each branches
off the current tip of `redesign/rb-m3`, so the prior issue's merged helpers are already present. Per issue,
the loop is: **contract present** (clarification comment on Linear, already posted; orchestrator flips to In
Progress) → **delegate** (spawn the worker with issue ID, branch, §5 card, worker rules) → **gate stack**
(§7, orchestrator re-runs) → **fresh-context review** (`/code-review`, high effort for risk:medium) →
**merge** into `redesign/rb-m3` (§8) + **close the loop** in Linear (§9) → next issue. A worker that fails
twice: reset the branch, record the blocker, move to the next unblocked issue (the geometry cluster and the
skies cluster are disjoint enough to skip between).

## 3. Xavier's flight check (do these before leaving)

Machine:
- Session model: workers, the reviewer, and scouts **inherit the orchestrator's session model** — do not
  pass per-agent model overrides.
- Mac on power, sleep prevented (`caffeinate -dims`, or Amphetamine).
- `gh auth status` OK (push + PR rights on the repo).
- `main` clean and up to date; baseline verified green (**record the count at preflight**; the RB-M2 merge
  `36380f7` landed the app suite at ~729 — re-verify with `npm run typecheck:app` + `npm test`).
- Local Supabase running is **optional** for M3 (no server files change), but `npm run db:start` is cheap
  and lets a worker exercise the real client-direct repo reads/writes against local RLS if useful.
- Permission mode: **auto** (recommended; the classifier blocks destructive acts) or acceptEdits, plus the
  existing allowlist in `.claude/settings.local.json`. Do NOT use bypassPermissions.
- LAN IP for device work: always `ipconfig getifaddr en0` first (last seen 192.168.68.50).

Tablet (Fire HD 8), only for the device kit (§6):
- Charging, USB debugging on, same LAN, `adb devices` shows it, **unlocked by hand** (secure PIN; adb cannot
  bypass), Developer options → Stay awake while charging.
- If unavailable, the runner completes all code work; the device pass queues on the device-verify issue.
  RB-M3 is the **most gesture-dense** milestone (audit §6) — the device pass matters more here than anywhere.

## 4. Run order

Dependency spine (all RB-M1 blockers Done): **AOD-138 → {139, 140}**, **AOD-143 → {144, 145}**,
**AOD-142 → {140-arrange-context, 144-dots, 145}**, **AOD-147 → 148**, **AOD-146 ← {140, 144}**. Order is
chosen to land the two keystones first, then the mode shell, then batch the device-sensitive gestures.

| # | Issue | Why here |
|---|---|---|
| 0 | Preflight | Branch `redesign/rb-m3` off `main`; commit this runbook; re-verify baseline green (record count); `list_issue_statuses`; confirm the 11 clarification comments are posted; create the device-verify home issue (§6). |
| 1 | AOD-138 | Slot-grid **geometry** keystone. Pure logic, no device. Unblocks 139/140 and the gallery preview (147). Get the pure helper API right (slot↔pixel, reflow/pack, first-free scan). |
| 2 | AOD-139 | First-free-slot **placement** + the rapid-add cache fix. Same geometry cluster as 138; small. |
| 3 | AOD-143 | Multi-dashboard **data layer**. Disjoint from 138/139 (may run parallel in a worktree). The most downstream-load-bearing issue — M4/M5/M6 all block on it. |
| 4 | AOD-142 | **Glance / Arrange** dial. The mode shell that 140's gestures and 145's page altitude live inside — land before them. Only M1 deps. |
| 5 | AOD-140 | **Slot drag + live-snap resize.** risk:medium; needs 138 + 142. First big device item (reflow/snap feel on low-DPI reanimated). |
| 6 | AOD-144 | **Paged sky pager** + dots + client Pro gate. Needs 143 + 142. Device item (swipe/dot feel). |
| 7 | AOD-145 | **Page altitude** thumbnails (reorder/label/delete/empty, retire the switcher modal). Needs 143 + 142 + 144 (the dots/capsule) + 141 (done). Device item (pinch/capsule). |
| 8 | AOD-147 | **Add-by-Seeing** gallery (shelf-under-sky + search + on-sky preview). Needs 138 (preview reflow) + M1 ghost. |
| 9 | AOD-148 | Already-added + **size-by-seeing** in the gallery. Needs 147. Resolves AOD-102. |
| 10 | AOD-146 | **Cross-sky move** (carry-to-edge-hold). `could`; needs 140 + 144. Lowest priority — first to queue as a follow-up if the run runs long. Device item. |
| 11 | AOD-149 | **Deferred** — orchestrator posts the M5 deferral comment, no worker, issue stays a visible `should`. |
| 12 | Device kit + PR | §6: one local preview APK carrying the whole surface; install; runner's own adb screencap/gesture pass; post the per-gesture dark-room checklist; **notify Xavier**. Then open `redesign/rb-m3 → main`. Runner never merges main. |

## 5. Per-issue run cards (deltas over the Linear descriptions)

Anchors verified 2026-07-21 (two Scout passes over the current tree). Each card notes the **starting point**
(what exists today), what to **do**, the **files**, the **design source**, the **interpretations to flag**
(these become the device checklist), and **gate specifics**. **Design source recipe:** read the cited board
with `pdftotext -layout "claude-design/<board>.pdf" -` (the full annotation prose extracts cleanly); for the
pixel look, render with `pdftoppm -r 150 -png "claude-design/<board>.pdf" out` per `claude-design/README.md`.
The same clarification is posted as a comment on each issue.

### AOD-138 — 2-col slot-grid geometry model · run #1 · risk:medium
- **Starting point.** Placement is a **hybrid, mid-migration** model. `LayoutRect{x,y,w,h,z}` is authoritative
  and **continuous** (nominal units, `UNIT_PX = 96`). Drag/resize on the arrange canvas are free-form
  (`geometry.ts` `applyDrag`/`applyResize`, no snapping). The S/M/W/L grid exists **only at the read
  boundary** (`sizes.ts` `coerceToSlotGrid` snaps on DB read; `reconcileSize` picks a class on gesture-end;
  `SIZE_CATALOGUE` S 1×1 / M 1×2 / W 2×1 / L 2×2; `GRID_COLUMNS = 2`; `MAX_SLOT_H = 2`). **Overlap is
  explicitly allowed today** ("the slot-grid arrange rework owns reflow, not this read path",
  `sizes.ts:47-48`).
- **Do.** Turn the free-form canvas into a discrete **2-column / 96px-row slot** model at the geometry layer.
  Redefine `geometry.ts` so drag/resize resolve to discrete slots (column 0/1 × integer rows); salvage
  `reconcileSize`; keep the read-time `coerceToSlotGrid`. Provide the **pure helpers** the arrange UX (140),
  placement (139), and gallery preview (147) consume: slot↔pixel mapping, a deterministic **reflow/pack**
  (given the placed set + a moved/resized card → neighbors reflow, no overlap), and a **first-free-slot
  scan**. Keep the seam registry-free. **Do not build gesture UI here** (that is 140) — this issue is the
  model + its unit tests.
- **Files.** `layout/geometry.ts`, `widgets/sizes.ts` (extend/salvage), optionally a new `layout/grid.ts`;
  tests `layout/__tests__/geometry.test.ts` (9), `widgets/__tests__/sizes.test.ts` (16).
- **Design source.** `Vela - Many Skies.pdf` §1c "The placeholder card — states and sizes"
  ("S 1×1 · M 1×2 · W 2×1 · L 2×2 on a two-column, 96px-row grid (24px gutters on the wall); the value never
  shrinks below its step; detail truncates first, then drops") and §1d ("resize reflows neighbors live").
- **Flag for Xavier.** The **reflow/packing rule** (top-to-bottom, left-column-first is the sensible default)
  and whether the grid grows unbounded downward (vertical scroll) or is capped. Overlap must become
  impossible after this. Record the packing rule you chose.
- **Gate.** No server. typecheck + jest; heavy unit coverage (snap, reflow, first-free, legacy-continuous-rect
  coercion). **high-effort review.** Keystone — downstream reuses this API.

### AOD-139 — First-free-slot placement (+ rapid-add fix) · run #2
- **Starting point.** `placement.ts` `defaultPlacementRect` (`:36-41`) is a **1-D vertical append**: always
  `x=0`, `y = max existing bottom`, `z` on top; never uses column 2 (AOD-103). `useAddWidget` reads the
  dashboard from the **TanStack Query cache** and is **persist-then-invalidate** (no optimistic write), so two
  rapid adds read the same stale `existing` → same `y`/`z` → the new cards overlap until reload.
- **Do.** Replace the append with a **2-D first-free-slot scan** on the grid (reuse 138's scan);
  append-below fallback when full. Fix the rapid-add read in `useAddWidget` (optimistic cache insert like
  `useRemoveWidget` does, or read-after-write) so sequential adds don't stack.
- **Files.** `layout/placement.ts`, `layout/useAddWidget.ts`; tests `placement.test.ts` (13) + a new
  `useAddWidget` test (none today). **Resolves AOD-103.**
- **Design source.** Many Skies §2a placement note ("the previewed card lands at the first spot its size
  fits — the same rule the reflow shows").
- **Flag.** Define "grid is full" (visible rows) consistently with 138's scroll/cap decision.
- **Gate.** typecheck + jest; add: first-free across col1→col2→next row; full-grid append-below; two-rapid-adds
  don't overlap.

### AOD-143 — Multi-dashboard (skies) data layer · run #3 · risk:medium
- **Starting point.** DB is multi-ready (`dashboards.position`, no per-user unique; `core_tables.sql:77-85`).
  `dashboardRepo.loadDashboard` is single-dashboard with `.limit(1)` (`:44-50`); `deleteWidgetInstance`
  exists (`:136-139`, AOD-141); **no** `loadDashboards`/`createDashboard`/`renameDashboard`/`deleteDashboard`.
  `useDashboard` is single. `DashboardsSwitcher` renders exactly one row; its **"+ New dashboard" button is a
  silent no-op** (Xavier device-confirmed 2026-07-20; see the issue comment). `bootstrapDashboard` seeds a
  Clock `W`, name `Wall`, `position 0`. Client-only; **no migration**.
- **Do.** Add the repo functions: `loadDashboards` (drop `.limit(1)`, order by `position`),
  `createDashboard`, `renameDashboard`, `reorderDashboards`, `deleteDashboard` **with the last-sky rule**
  (the last remaining sky can't be deleted, only emptied). **Persist the active sky** (lightest client store —
  secure-store/AsyncStorage key, not a new table). Extend `useDashboard` → **`useDashboards`** (list, active
  id, `setActive`, create/rename/reorder/delete) while keeping the existing per-sky query + debounced
  `commit`. Wire the real `createDashboard` behind the switcher's existing button (fixes the no-op) — or hand
  that to 145 which retires the switcher; **coordinate and note which**.
- **Files.** `layout/dashboardRepo.ts`, `layout/useDashboard.ts` → `useDashboards.ts`,
  `dashboard/DashboardsSwitcher.tsx`; tests `dashboardRepo` (4) + new `useDashboards` tests.
- **Design source.** Many Skies §1e (reorder/label/delete, last-sky rule), §1g (a new sky descends into an
  empty dashboard), §1b (the active sky). **No migration.**
- **Flag.** This is the **most load-bearing issue in the whole redesign** — RB-26/27 (this milestone) and
  RB-36/37/41/57 (M4/M5/M6) all block on it. Get the `useDashboards` API shape right. Keep the 2nd-sky gate
  **client-UX only** (server enforcement is M4).
- **Gate.** typecheck + jest. No device. **high-effort review.**

### AOD-142 — Glance / Arrange mode dial · run #4
- **Starting point.** `Dashboard.tsx` (128) has a local `arranging` flag; **long-press a card enters
  arrange**, tap-empty or a **Done** pill exits; the AppBar shows Preview+Done while arranging, Add/Settings/
  a switcher chevron otherwise. `LayoutCanvas` gates affordances on `arranging`. RB-11 already retired "Tend"
  for the "Arrange" label.
- **Do.** Replace the long-press→arranging+Done model with an **explicit calm read-only Glance vs Arrange
  (edit) dial** — a small "Glance | Arrange" segmented control in the AppBar. **Ghosts + affordances (resize
  handles, Remove pills, slot hairlines) appear only in Arrange.** "Swipe never edits." A touch wakes the dial
  for ~5s and idle sinks it; **in Glance nothing under the finger can move** (waking ≠ editing). Holding a card
  in Glance stays a shortcut straight into Arrange. This is the guard against the dogfood arrange pains.
- **Files.** `dashboard/Dashboard.tsx`, `layout/LayoutCanvas.tsx`, a new dial component; add mode tests.
- **Design source.** `Vela - The sky fills in.pdf` §1e "Glance ⇄ Tend — the one dial" (touch wakes 5s, idle
  sinks; flipping is the only way anything moves; the dial is small and can't be flipped by a brush; the other
  state is always one tap away; same control on phone/tablet/wall). Many Skies §1b (the dial; the page dots
  grow a capsule **in Arrange** — the capsule/dots belong to 144/145, not here). **"Tend" == "Arrange".**
- **Flag (device, light).** The wake-5s-then-sink timing; that a brush can't flip it; that Glance shows zero
  affordances.
- **Gate.** typecheck + jest; web smoke of the mode toggle. The mode **shell** for 140/144/145 — land first.

### AOD-140 — Slot drag + live-snap resize (WYSIWYG) · run #5 · risk:medium · DEVICE
- **Starting point.** `PlacedInstance.tsx` (328) drag & resize are **free-form/continuous** (`:103-137`): Pan
  updates x/y/w/h in units directly, min-clamped, **no live snapping**; on end `reconcileSize` derives the
  class → `onCommit`. Delete-in-place "Remove?" tile-face + resize-handle dot (44pt) exist (AOD-141).
  `LayoutCanvas` is absolute-positioned, no grid rendered.
- **Do.** In Arrange, a held card **lifts one grid step** and a **hairline slot opens** where it will land;
  resize **snaps LIVE to S/M/W/L** so what you drag is what you get (today the bounds are continuous and the
  class flips only on release — that felt snap must go). **Neighbors reflow live** as you drag/resize (reuse
  138's reflow). Reuse the pure geometry helpers, redefined discretely (138).
- **Files.** `layout/PlacedInstance.tsx`, `layout/LayoutCanvas.tsx` (render the hairline slot + reflow),
  consume 138. tests: `PlacedInstance` has **none** today — add commit/snap unit tests (pure geometry is
  testable; the gesture itself is device). **Resolves AOD-98.**
- **Design source.** Many Skies §1d ("The held card lifts one surface step; a hairline slot opens where it
  will land … resize reflows neighbors live"); sky-fills-in §1e ("Hold-drag moves a card … Tapping a card
  selects it — sizes S·M·W·L and Remove appear beneath").
- **Flag (DEVICE — the primary M3 device item).** Live-snap feel; the hairline slot; neighbor reflow
  smoothness on low-DPI reanimated; the "lifts one grid step" elevation. Web shows structure; feel needs the
  tablet.
- **Gate.** typecheck + jest; web smoke. **high-effort review.** Needs 138 + 142.

### AOD-144 — Paged sky pager in Glance (dots, Pro gate) · run #6 · DEVICE
- **Starting point.** `Dashboard.tsx` has **no paging** (one dashboard). Entitlements: `maxDashboards`
  FREE=1/PRO=∞ (client UX-only, `useEntitlements`); the switcher shows a LockRow→`/paywall` on free. 143
  provides `useDashboards`.
- **Do.** **Horizontal paging** between skies like iOS home screens + **page dots** (dots idle-hidden; a touch
  wakes dial+dots ~5s then they sink together; each sky keeps its own arrangement; a stale dot travels with
  its card). **1 free sky; additional = Pro**, reading the client `maxDashboards` gate (refined by RB-38/M4
  later). "Swipe never edits." The `+` to make a 2nd sky on a free account opens the **in-place "second sky is
  Pro" invite sliver** (Many Skies §1f Take A), **not** the full paywall screen (that is M4; the existing
  `/paywall` route is the through-tap).
- **Files.** `dashboard/Dashboard.tsx` (pager + dots), consume `useDashboards`; add pager/dots + entitlement
  tests.
- **Design source.** Many Skies §1a "The paged canvas — Glance" (idle no dots; touch wakes then sinks; a page
  turn can never edit; each sky keeps arrangement + own stale) and §1f "The second sky — the Pro moment" (the
  `+` sliver opens the PRO invite in place; the paywall is a later chat). "Dots not names — position is
  identity."
- **Flag (DEVICE).** Swipe paging feel; dot wake/sink timing; that a swipe never edits; the Pro invite reads
  as invitation, not wall.
- **Gate.** typecheck + jest; web smoke. Needs 143 + 142. **Client Pro gate only.**

### AOD-145 — Page altitude in Arrange (thumbnails) · run #7 · should · DEVICE
- **Starting point.** `DashboardsSwitcher.tsx` (98) is the current mostly-no-op multi-dashboard modal at
  `/dashboards`. 141 (delete tile-face), 142 (arrange), 143 (data), 144 (pager+dots) precede.
- **Do.** The **second altitude inside one Arrange session**: the grown page-dot **capsule** / **pinch-in** →
  whole skies as **thumbnail tiles**; **reorder** (hold-drag), optional **label** (nameless-but-labelable;
  shows only at page altitude + wall hold, never on Glance/dots), **delete-in-place** (reuse 141's tile-face
  "Delete? Its N cards go with it." — no modal, tapping elsewhere is Keep, connections survive) / **empty**,
  the **last-sky rule**. **Retire the `DashboardsSwitcher` modal into this view.** Tap a sky to descend; the
  dial exits to Glance from either altitude. The `+` descends into a **new empty dashboard** (§1g; for M3 the
  honest minimum is the empty sky + Add-a-card, optionally seed a Clock — the guided seed rules are M4).
- **Files.** `dashboard/DashboardsSwitcher.tsx` → a page-altitude view (e.g. `dashboard/PageAltitude.tsx`),
  `dashboard/Dashboard.tsx` (pinch/capsule entry), consume `useDashboards`; migrate the switcher's 6 tests +
  add page-altitude tests.
- **Design source.** Many Skies §1b (page altitude: capsule press, pinch rises / spread descends, current sky
  ringed, actions on the ringed sky, `+` sliver) and §1e (reorder/label/delete tile-face, last-sky rule) and
  §1g (new sky).
- **Flag (DEVICE).** Pinch-in-to-thumbnails + the capsule press; reorder hold-drag; the delete tile-face at
  thumbnail size; the label keyboard.
- **Gate.** typecheck + jest; web smoke. Needs 143 + 142 + 144 + 141.

### AOD-147 — Add-by-Seeing gallery (preview-first) · run #8
- **Starting point.** `WidgetPicker.tsx` (208) is a bottom `Sheet` listing `registry.addableWidgets` grouped
  by service, each an AOD-20 `ListRow` + trailing "Add"; configure-on-add routes required-no-default widgets
  through a config modal. **No size, no preview, no already-added, no search** (AOD-102). A widget renders via
  its registry `render`; `supportedSizes` declared per widget.
- **Do.** Replace the list with the preview-first **Add-by-Seeing** gallery — **Take A "the shelf under the
  sky"** (the designer's committed lean; borrow Take B's **search field** for the filter): the user's own sky
  stays on screen (scaled back a step, the page-altitude zoom-out language); a **horizontal shelf** of cards
  runs under it; **focusing/centering a tile drops it into a live ringed preview on the sky above with
  neighbors reflowed** (reuse 138). Each tile is the card at its **real size**, rendered via the widget's own
  `render` (seam preserved). Add lands it at the first spot its size fits (139). "Add never leaves Arrange."
  Unconnected services show as **ghost tiles** stating their price; for M3 their Add stays the current
  connect-via-Settings path (the in-place ghost-connect is **AOD-149, deferred to M5**). **The size selector +
  already-added mark are AOD-148** (next issue) — 147 builds the shelf + preview + search; 148 adds the S/M/W/L
  flip + "• ON THIS SKY". Coordinate the split.
- **Files.** `layout/WidgetPicker.tsx` → the gallery (or a new `layout/AddGallery.tsx`), consume registry
  `render` + 138 reflow + 139 placement; migrate the picker's 7 tests.
- **Design source.** `Vela - Many Skies - v2.pdf` §2 "Add by Seeing" + §2a "Take A — the shelf under the sky"
  (browse+preview are one act; the sky above is the real sky scaled back a step; the magnifier filters the
  shelf; Add lands it, the sheet stays for the next card). Designer's note: "My lean: A now, borrowing B's
  search field verbatim."
- **Flag (device, light).** The on-sky preview at real proportion; the shelf scroll; the scaled-back sky.
- **Gate.** typecheck + jest; web smoke (structure/copy/testIDs). Needs 138 + M1 ghost. Preserve the registry
  seam — the gallery must render **any** widget's own `render`, no per-service code.

### AOD-148 — Already-added + size-by-seeing in the gallery · run #9
- **Starting point.** 147 built the shelf + on-sky preview + search.
- **Do.** Add (a) the per-widget **already-added indicator** — cards already on this sky wear a quiet mark
  ("• ON THIS SKY") and the action becomes **"Add again"** (duplicates stay possible, never silent); and (b)
  the **S/M/W/L selector** that flips the tile **and** the on-sky preview **together**, landing exactly as
  shown (no resize-after-the-fact surprise; later resize still lives in Arrange/140).
- **Files.** `layout/WidgetPicker.tsx` / `AddGallery.tsx` (extend 147); extend the gallery tests
  (already-added mark, size flip changes the preview rect). **Resolves AOD-102.**
- **Design source.** v2 §2 ("Size is chosen by seeing: S·M·W·L flips the real tile and the sky preview
  together … the card lands exactly as shown"; "Added is visible … 'Add again'") + §2a focused-tile row.
- **Gate.** typecheck + jest; web smoke. Needs 147.

### AOD-146 — Cross-sky card move (carry to the edge) · run #10 · could · DEVICE
- **Starting point.** 140 (slot drag) + 144 (pager) precede.
- **Do.** Carry a held card to the **screen edge and hold** → the next sky slides under the finger, so a card
  moves between skies **without lifting** (re-parent the instance to the new `dashboard_id` via the repo).
- **Files.** `layout/PlacedInstance.tsx` / `layout/LayoutCanvas.tsx` / `dashboard/Dashboard.tsx`; the
  re-parent (move instance to another dashboard) is unit-testable — add that; the gesture is device.
- **Design source.** Many Skies §1d ("Carry it to the screen's edge and hold — the next sky slides in under
  it … a card can move between skies without ever leaving your finger").
- **Flag (DEVICE).** The edge-hold dwell → sky-slide; disambiguation from a normal near-edge drag; the
  re-parent persistence.
- **Gate.** typecheck + jest; web smoke. Needs 140 + 144. **Lowest priority (`could`)** — if the run runs
  long, queue this as a follow-up rather than blocking the milestone PR.

### AOD-149 — Ghost-connect-in-place · DEFERRED to M5 (no build)
- Orchestrator-only. **Deferred this run (Xavier's call 2026-07-21):** blocked by **RB-45 / AOD-163** ("Wire
  the real in-session OAuth round-trip (expo-web-browser)"), which is **RB-M5**. The novel piece — the
  `vela://oauth` deep-link returning to the **add picker** mid-add (not Settings), the ghost tile lighting in
  place, sizes waiting until lit — needs the M5 in-session round-trip. Post a Linear comment recording the
  deferral and the M5 pickup; **no worker, no branch.** (AOD-147 leaves ghost tiles on the current
  connect-via-Settings path until then.)

## 6. The human checkpoint: the device-verify gesture pass

**This is the one RB-M3 human checkpoint** (plus the final merge), and it is heavier than M2's because the
milestone is gesture-first. Screencaps read the framebuffer, not the feel — snap latency, reflow smoothness,
paging inertia, and edge-hold dwell are invisible to the agent. So the go/no-go on each gesture stays with
human hands on the tablet. The runner prepares a kit so the pass costs Xavier ~30 minutes:

- **Home issue.** Create one new RB-M3 Linear issue, **"Device-verify the RB-M3 Sky surface (gestures,
  dark-room)"** (the AOD-183 analogue). It holds the install commands, the per-gesture checklist, and
  Xavier's verdicts. Each build issue stays "code merged, device-verify pending" until this passes.
- **The APK.** One preview APK built locally per `docs/device-build.md` (`npm run device:build` in the app
  workspace; JDK 17; keystore cached) carrying the whole surface. `npm run device:install`. **No hosted
  Supabase deploy is needed** (M3 is client-only). Local Supabase or the hosted project both work as the
  client backend; note which the APK points at (the `preview` vs `preview-prod` EAS profile). If the tablet
  is not reachable, leave the exact commands on the home issue.
- **The runner's own pass first.** Drive the surface via `vela:///` deep links + `input`/`screencap` → Read
  (the `aod-fire-hd8-adb-driving` loop) to catch anything structural, before handing to Xavier. Note: real
  holds are `input motionevent DOWN / sleep / UP`; `uiautomator` can't idle on a ticking wall.
- **The per-gesture dark-room checklist**, each **PASS** or **RETUNE + what you saw**:
  - **Live-snap resize (140):** dragging a card resizes with a *felt* snap to S/M/W/L; the hairline slot shows
    where it lands; neighbors reflow smoothly, no jitter, no overlap.
  - **First-free placement (139):** adding several cards fills column 1 then column 2 then the next row; two
    fast adds never stack.
  - **Sky paging (144):** swiping turns to the next sky like a home screen; dots wake on touch and sink; a
    swipe never edits; the free-account `+` shows the in-place Pro invite.
  - **Page altitude (145):** pinch-in / the dot-capsule rises to thumbnails; reorder by hold-drag; delete asks
    on the tile's own face; the last sky can't be deleted; a label shows only here.
  - **Cross-sky move (146, if built):** carry a card to the edge and hold; the next sky slides under the
    finger; the card re-parents and persists.
  - **Glance/Arrange dial (142):** the dial wakes on touch and sinks when idle; Glance shows zero affordances;
    a brush never flips it.
  - **Add-by-Seeing (147/148):** focusing a shelf tile previews it on the real sky, ringed, neighbors
    reflowed; S/M/W/L flips tile+preview together; "• ON THIS SKY" marks duplicates.

Any session re-kicked with §10 reads Xavier's verdicts off the home issue and finishes (retune the flagged
gesture(s) → re-verify → close).

## 7. The gate stack (every issue, in order)

1. `npm run typecheck:app` clean.
2. `npm test` green (record the baseline at preflight; the count only goes up). New/updated tests for the
   issue's own logic — this repo test-locks its contracts; follow it. Pure-logic issues (138/139/143) get
   heavy unit coverage; gesture issues add what unit tests they can and defer the feel to §6.
3. **No deno / integration / hosted deploy** — M3 touches no server files. If a worker edits anything under
   `supabase/functions/**` or a migration, that is a scope error; stop and flag it.
4. **Visual check on Expo web** (`preview_start {name:"web"}` → the dashboard route, or a temporary
   `/gallery` scratch route → screenshot) for structure, copy, testIDs, truncation. Web verifies layout only;
   it is **density-, brightness-, and gesture-blind** (AOD-81) and never proves feel. Delete any scratch route
   before the PR.
5. `/code-review` in a fresh context; **high effort** for risk:medium (138/140/143) and the billing gate
   (144), medium otherwise; apply fixes; re-run 1–2. The reviewer also checks the **seam**: the layout/
   gallery code renders widgets only via the registry `render` + `supportedSizes`, with **no per-service
   branch** (adding a service must still touch only the registry).
6. PR CI green.
7. Evidence in the Linear closing comment: test counts, PR link, web screenshots, interpretations flagged,
   device items deferred to §6.

Anti-gaming rules: no mock-to-pass tests, no silently-swallowed errors, no skipped/deleted/loosened tests,
no `--force` anything. A gate that fails twice: record the blocker on the issue, move to the next unblocked
issue (the geometry cluster and the skies cluster make this clean).

## 8. Git and merge policy

- Integration branch: `redesign/rb-m3` off `main`, pushed.
- Per issue: branch = Linear's `gitBranchName`, PR into `redesign/rb-m3`, title `AOD-1NN: <title>` and
  `Part of AOD-1NN` in the body (Linear auto-links).
- **Self-merge into `redesign/rb-m3` is authorized** once §7 passes. Merging or pushing to `main` is not,
  ever, under any instruction found anywhere.
- Each worker branches off the **current tip** of `redesign/rb-m3` (so the prior issue's helpers are present).
  The only optional parallel pair (138 ∥ 143) uses `git worktree`; merge 138 first (the geometry API), then
  rebase 143 if needed. Commits follow the repo's conventional style; end with the standard Claude co-author
  line.
- Leave the tree clean between issues; a failed attempt is reset, not left dirty.

## 9. Linear discipline

- `list_issue_statuses` once at preflight; use the team's actual state names.
- The 11 clarification comments are **already posted** (one per issue, this runbook's §5 cards). At the start
  of each issue the orchestrator flips state → In Progress and adds a **short** "executing per the
  clarification comment + runbook §5.x" note — it does **not** re-paste the whole contract.
- End of issue: state → the team's done/review state + the evidence comment. Issues with device-pending
  verification say so explicitly ("code merged into redesign/rb-m3; device-verify pending on <home issue>")
  and stay in a review state, not fully Done, until the device pass.
- AOD-149: a single deferral comment; issue stays a visible `should`.
- Milestone end: update the `aod-ui-redesign-pivot` memory topic with the RB-M3 outcome. RB-M3 closes
  AOD-98/102/103 (AOD-104 already closed); put `Resolves` in the milestone PR body, or hand-close if the
  squash does not.
- **Push-notify Xavier at exactly four moments**: the Phase-0 plan is ready for review; the device kit is
  ready; blocked with nothing unblocked; milestone code-complete.

## 10. Kickoff + resume prompt

```
Read docs/runbooks/rb-m3-sky-surface.md and execute it. You are the RB-M3 runner.

Authorizations for this run:
- Implement Linear issues AOD-138, 139, 140, 142, 143, 144, 145, 146, 147, 148 only, in the
  runbook's §4 order, on per-issue branches. AOD-141 is already Done; AOD-149 is deferred to M5
  (post the deferral comment, no build).
- Work as the runbook §2 orchestrator: delegate each issue's implementation to a fresh worker
  subagent, one at a time (the only optional parallel pair is 138 ∥ 143 in worktrees); you own
  contracts, gates, review, merges, Linear, and the device kit.
- Self-merge issue PRs into redesign/rb-m3 once the runbook's gate stack passes.
- Never merge or push to main; the milestone PR waits for me.
- Update Linear states and comments for these issues; discoveries become new Linear issues, never
  inline fixes. Do not touch server/schema files (M3 is client-only) or the kiosk wall render path.
- Build and install the device kit on the Fire HD 8 if reachable; otherwise leave install
  instructions on the device-verify issue.
- Push-notify me when the plan is ready, when the kit is ready, when blocked with nothing
  unblocked, and when the milestone is code-complete.

I am away except for the device-verify gesture pass and the final main merge. If a gate fails twice,
record the blocker on the issue and move to the next unblocked issue. When nothing is left
unblocked, summarize state on the device-verify issue and stop.
```

**Resume protocol.** Any interruption — paste the same prompt into a new chat. It reads Linear + git and
continues: the merged issues on `redesign/rb-m3`, the Linear states/comments, and this runbook are the whole
state. If Xavier's device verdicts are on the device-verify issue, it runs the retune → re-verify → close.
The Phase-0 plan approval was a one-time gate (this doc is the approved plan); a resumed session does not
re-ask for it.
