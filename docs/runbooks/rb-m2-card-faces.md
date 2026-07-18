# RB-M2 Card faces: autonomous run book

> Status: **authored 2026-07-18.** The execution contract for running milestone **RB-M2 Card faces**
> (Linear project "Redesign Build") autonomously while Xavier is away. Companion to
> [`redesign-build-audit.md`](../specs/redesign-build-audit.md) §1.2 (the scoping narrative),
> [`design-color-law.md`](../specs/design-color-law.md) (the law the faces render), the four face PDFs
> in `claude-design/`, and the Linear issues themselves (task state). Same shape and machinery as the
> shipped [`rb-m1-foundation.md`](rb-m1-foundation.md); this doc holds only what neither Linear nor the
> specs hold: the run order, the gate stack, the merge policy, and the device checkpoint. Linear is the
> single source of task state; do not duplicate it here.

## 1. Mission and hard scope

Rebuild the four service card **faces** on the RB-M1 contract, bound to color **roles** (never hexes),
so each face works in every theme untouched. The milestone is 8 Linear issues — **7 build + 1 deferred**:

| RB | Linear | Title (short) | Risk | Server? |
|---|---|---|---|---|
| RB-13 | AOD-131 | Weather Current sunrise/sunset op (the data add) | — | **yes** |
| RB-14 | AOD-132 | Weather Current → **Transit** (sun-arc, 4 sizes, condition pane) | medium | no (consumes 131) |
| RB-15 | AOD-133 | Weather Forecast → **Range** (hi-lo span-bars) | — | no |
| RB-16 | AOD-134 | Linear My Issues → **Soundings** (count + priority silhouette) | — | no |
| RB-17 | AOD-135 | Linear Current Cycle → **The Log Line** (21-knot ring) | medium | no |
| RB-12 | AOD-130 | Clock → **Meridian** (chromeless single figure) | — | no |
| RB-18 | AOD-136 | Calendar → **Dressed Overall** (imminence spread) | medium | no |
| RB-19 | AOD-137 | Reface the Claude usage cards — **DEFERRED** (no build) | — | no |

(RB numbers are this doc's shorthand; trust the AOD identifiers.) These faces are **applications of the
frozen RB-M1 seams** — do not rebuild the seams:

- `apps/app/src/widgets/fitLadder.ts` + `FitBody.tsx` (value-at-step, width-fit-to-floor, detail truncate-then-drop),
- `apps/app/src/widgets/caption.ts` (the 5 strategies; Clock = `hidden`, Weather = `place`, Linear = `projectOrTeam`, Calendar = `calendar`),
- `apps/app/src/widgets/lifecycle.ts` (six states + ghost + first-class host-drawn `empty`, two action-states),
- `apps/app/src/widgets/sizes.ts` (S 1×1 / M 1×2 / W 2×1 / L 2×2),
- the frozen role tokens in `apps/app/unistyles.ts`: `temp` (8-stop thermometer), `ink` (event inks + moon), `pane` (12 condition×daylight swatches), `when` (6 imminence stops), `night`/`ember`, and the **Signature ⇄ Monochrome theme axis** (Monochrome auto-collapses all four data families to neutral — bind to roles and Monochrome is free).

**Hard caps.** Touch only these 8 issues. Anything discovered along the way (bug, cleanup, idea) becomes
a **new Linear issue** in the right project with a note, never an inline fix — see the live discoveries
already noted in §5 (the 3× snowflake overrides, the pre-M1 Forecast empty). Do not start M3+ work even
where adjacent (multi-dashboard, the wall, onboarding). Do not edit the design PDFs. **Never weaken a
test.** The four FROZEN color-family locks (`__tests__/data-tokens.test.ts`,
`data-monochrome-tokens.test.ts`) are device-verified GO (AOD-119, 2026-07-18) — their hexes are final;
a face that adds a numbers-only geometry token group **extends** the lock corpus with its own group test,
it never touches the frozen color locks. If a face seems to need a color that is not in
`temp`/`ink`/`pane`/`when`/`ember`, that is a design gap → flag it for Xavier, do not invent a hex.

**Milestone-done means:** all 7 build issues merged into `redesign/rb-m2` (or explicitly
device-verify-pending), the integration branch green, the device kit staged, and one PR
`redesign/rb-m2 → main` open for Xavier with the milestone summary. RB-M2 closes **no** dogfood issues
(the milestone table's "Closes (dogfood): —"), so the PR body has no `Resolves AOD-9x`; hand-close the 7
build issues if the squash-merge does not (RB-M1's squash did not auto-close its issues).

## 2. Operating pattern: an orchestrator with one fresh worker per issue

Identical to RB-M1 §2. One session is the **orchestrator**. It never implements the meaty faces itself:
it works the milestone **sequentially, one issue at a time**, delegating each face's implementation to a
**fresh worker subagent**, then independently re-running the gate stack, spawning a separate fresh-context
reviewer, merging, and closing the Linear loop. All durable state lives outside any context window: Linear
holds task state, git holds the record, this runbook holds the contract. Any interruption is recovered by
re-kicking a fresh session with the §10 prompt.

Division of labor (single-writer rule):

- **Worker** (one per issue, fresh context, sequential): reads the Linear issue + its cited refs (the
  face PDF, `design-color-law.md`, the code anchors) + this runbook's §5 card; implements + tests on the
  issue branch; commits; reports back files touched, test evidence, interpretations taken, and open
  questions. Workers **never merge, never push `main`, never touch Linear.**
- **Orchestrator**: picks the next issue in §4 order; posts the acceptance-contract comment on the Linear
  issue **before** spawning the worker (no vibe-coding); briefs the worker; re-runs the gate stack itself
  (§7, never trusts the worker's report alone); spawns the separate fresh-context reviewer; merges (§8);
  closes the loop in Linear with evidence (§9); owns the device kit.
- **Inline exception**: AOD-137 is **deferred, no build** — the orchestrator handles it directly (a
  Linear comment noting the deferral; no worker, no branch).

**Why strictly sequential, not parallel.** Two reasons the file-overlap analysis makes sequential the
right default here, even though the service dirs look disjoint:
1. **`unistyles.ts` is a shared file across most faces.** Every face adds its numbers-only geometry token
   group to the single `sharedTokens` spread (the `clockSize`/`weatherIcon`/`priorityIcon` precedent, audit
   §1.2). AOD-132 (sun-arc), 133 (span-bar), 135 (ring), and likely 130/134/136 each append there. Parallel
   workers would collide on that file.
2. **The two service clusters each share files.** Weather: 131→132→133 share `weather/types.ts`,
   `WeatherIcon.tsx`, `weather/index.ts` (plus the hard 131→132 data dependency). Linear: 134→135 share
   `linear/index.ts` and `glyphs.tsx`. Anything that shares a file is sequenced.

Sequential workers run in the **main working tree** (no worktree, node_modules just works); each branches
off the current tip of `redesign/rb-m2`, so the prior face's merged token group is already present. The
disjoint-by-service structure (Clock, Calendar, Weather-chain, Linear-chain) is used for **resilience**,
not parallelism: if a face blocks twice, skip to the next disjoint one without entanglement (§7).

Per issue, the loop is: **contract first** (orchestrator posts the acceptance checklist to Linear) →
**delegate** (spawn the worker with issue ID, branch, §5 card, worker rules) → **gate stack** (§7,
orchestrator re-runs, all green or blocked) → **fresh-context review** (`/code-review`, high effort for
risk:medium and the server issue) → **merge** into `redesign/rb-m2` (§8) + **close the loop** in Linear
(§9) → next issue. A worker that fails twice: reset the branch, record the blocker, move on.

## 3. Xavier's flight check (do these before leaving)

Machine:
- Session model: workers, the reviewer, and scouts **inherit the orchestrator's session model** — do not
  pass per-agent model overrides. If usage limits bite mid-run, the mechanical worker (AOD-131 server op)
  may downgrade; the risk:medium face workers (132/135/136) and the reviewer never downgrade.
- Mac on power, sleep prevented (`caffeinate -dims`, or Amphetamine).
- `gh auth status` OK (push + PR rights on the repo).
- `main` clean and up to date; baseline verified green (**2026-07-18: tsc clean, jest 627/627 in ~2.5s**).
- Local Supabase running: `npm run db:start` — the integration suite AND the AOD-131 hosted deploy need it.
- Hosted Supabase deploy creds available for AOD-131 (see `aod-hosted-supabase-prod` memory: project ref
  `kneiiilyihykmgdstdrm`, deploy via `supabase functions deploy --use-api --import-map supabase/functions/deno.json`).
- Permission mode: **auto** (recommended; the classifier blocks destructive acts) or acceptEdits, plus the
  RB-M1 allowlist in `.claude/settings.local.json`. Do NOT use bypassPermissions.
- LAN IP for device work: always `ipconfig getifaddr en0` first (last seen 192.168.68.50).

Tablet (Fire HD 8), only for the device kit (§6):
- Charging, USB debugging on, same LAN, `adb devices` shows it, unlocked by hand (secure PIN; adb cannot
  bypass), Developer options → Stay awake while charging.
- If unavailable, the runner completes all code work; the device pass queues on the device-verify issue.

## 4. Run order

Dependency spine: **AOD-131 → AOD-132** (the sunrise/sunset data must land before the Transit arc consumes
it). Everything else has only RB-M1 blockers (all Done), so order is chosen for file-cluster contiguity and
to stage the device-sensitive faces for a single device pass at the end.

| # | Issue | Why here |
|---|---|---|
| 0 | Preflight | Branch `redesign/rb-m2` off main (done); commit this runbook; re-verify baseline green (627); `list_issue_statuses`; create the device-verify home issue (§6). |
| 1 | AOD-131 | Server data add first: unblocks 132, and the sunrise/sunset must be live on hosted Supabase before the device kit. deno + integration gates. |
| 2 | AOD-132 | Weather **Transit** (Current). risk:medium; consumes 131. Biggest weather face; the condition pane is device-sensitive (banding). |
| 3 | AOD-133 | Weather **Range** (Forecast). Same `weather/` dir as 132 — land after so the WeatherIcon normalization is already in. |
| 4 | AOD-134 | Linear **Soundings** (My Issues). Reuses the existing PriorityGlyph; adds the heavy→light sort. |
| 5 | AOD-135 | Linear **Log Line** (Current Cycle). risk:medium; new ring token group in `unistyles.ts`; after 134 (linear dir sequential). The 21-knot device check is the highest-risk item. |
| 6 | AOD-130 | Clock **Meridian**. Isolated; already M1-native. Night-ember device item. |
| 7 | AOD-136 | Calendar **Dressed Overall**. risk:medium; isolated. The 13px cool-stop legibility is device-sensitive. |
| 8 | AOD-137 | **Deferred** — orchestrator posts the deferral comment, no worker, issue stays a visible `could`. |
| 9 | Device kit | §6: one local preview APK carrying all four faces + the live weather server change; install; runner's own adb screencap pass; post the per-face dark-room checklist; **notify Xavier** — this is the RB-M2 human checkpoint. |
| 10 | Milestone PR | `redesign/rb-m2 → main` opened for Xavier (optionally `/code-review ultra` first). Runner never merges main. |

## 5. Per-issue run cards (deltas over the Linear descriptions)

Anchors verified 2026-07-18 (Scout pass over the current tree). Each card notes the **starting point**
(what exists today), the **seam** to consume, **files**, the **interpretations to flag for Xavier's eye**
(these become the device checklist), and any **gate specifics**.

### AOD-131 — Weather Current sunrise/sunset op (server) · run #1
- **Starting point.** `buildCurrentQuery` (`supabase/functions/_shared/operations.ts` ~464-467) sends only
  `{latitude, longitude, timezone, current}`. `buildForecastQuery` (~470-472) **already** requests
  `daily: DAILY_FIELDS` where `DAILY_FIELDS` (~391-392) includes `sunrise,sunset`, and `normalizeForecast`
  (~532-541) already zips them. So this task **mirrors an existing pattern**, it does not invent one.
- **Do.** Add `daily: "sunrise,sunset", forecast_days: 1` to `buildCurrentQuery`; read
  `body.daily.sunrise[0] / sunset[0]` in `normalizeCurrent` (~491-509); extend `CurrentWeatherData`
  server-side (~359) **and** client `registry/services/weather/types.ts` (~33-42) in lockstep. Still one
  combined Open-Meteo call; `/v1/forecast` is already allow-listed for current, so **no proxy / allow-list /
  registry change**.
- **Gate specifics.** Server file → `npm run test:unit` (deno check) **and** `npm run test:integration`
  (Supabase up). Add current-op sunrise/sunset assertions in `operations.test.ts` (~302-398; the
  `FORECAST_BODY` fixture already carries `daily.sunrise/sunset`). **Deploy to hosted Supabase** after merge
  so the tablet kit gets real sunrise/sunset. **Blocks AOD-132.** Review at high effort (server + cross-type).
- **Flag.** None visual. Confirm the emitted field names match what the Transit worker will read (agree the
  `CurrentWeatherData` shape here so 132 doesn't re-open it).

### AOD-132 — Weather Current → Transit · run #2 · risk:medium
- **Starting point.** `CurrentWeatherCard.tsx`: S uses `FitBody` glance (icon lead + temp value); **W is a
  hand-rolled View**. supportedSizes `['S','W']`. No `isEmpty` (Current is always valued). Caption
  `{kind:'place', hideAtSizes:['S']}` already declared.
- **Do.** Expand to **all four sizes** (`weather/index.ts`). Build the **sunrise→sunset arc** carrying the
  live sun position: **curve at L, flat waterline at W/M, absent at S** (glyph-over-figure only). Night: the
  sun-mark drops below, the arc line persists as a quiet fact; a **moon glyph** (crescent) draws in the
  night pane's gold. The card wears a **muted condition pane** (`theme.pane.<cond><daylight>` bg/line/ink;
  Weather only). Normalize `WeatherIcon` to one line weight.
- **Color binding.** temperature → `theme.temp` (8-stop blend); pane → `theme.pane[key]`; glyph inks →
  `theme.ink.rain/sun/storm`, `bone` for gray skies; night → `theme.pane.clearNight` + `.moon` (#E0C182,
  via role).
- **Flag for Xavier's eye (device).** (a) **The pane is NOT in the Weather Eye PDF** (it predates the Jul-12
  color law) — the builder composites the frozen `pane.*` behind the arc geometry; verify it reads as *the
  sky*, deep enough that bone figures stay the brightest thing, "pigment not poster" (color-law §5/§7).
  **Pane banding** is the RB-M2 device item here. (b) the moon glyph in pane-gold on the night pane. (c) the
  arc **curve→waterline** thresholds + sun-mark size at low DPI.
- **Discovery already noted.** The "two 1.5 snowflake overrides" are actually **three** `<Line strokeWidth={1.5}>`
  in the `flake` helper at `WeatherIcon.tsx:93-95` — normalize all three to `theme.weatherIcon.stroke` (2).
- **Gate specifics.** Behavioral tests (`WeatherCards.test.tsx`) key off testIDs/text; keep them or update
  deliberately. `weatherIcon` ramp only has `currentSmall/currentHero` — extend for W/L if the arc needs it.

### AOD-133 — Weather Forecast → Range · run #3
- **Starting point.** `ForecastCard.tsx` is hand-rolled (W = day-column strip, L = row list, `fitCount`
  height-driven). supportedSizes `['W','L']`. **It still self-draws a leaf "No forecast" empty at
  `ForecastCard.tsx:78-86`** — a pre-M1 remnant (no `isEmpty` declared).
- **Do.** Replace the numeric hi-lo text with a **span-bar per day on the week's shared min–max scale**
  (header e.g. "Week 8°–21°"): low flanks left, hi bold right, precip %. Sizes stay **W/L**. **Forecast never
  wears a pane** (it reads many skies). Truncation ladder wind→humidity→feels→label. **No data change.**
- **Color binding.** hi → `theme.temp`/bright, lo recedes; precip → `theme.ink.rain`; glyphs bone; today
  full-bright, later days step back.
- **Flag for Xavier's eye.** (a) **the shared scale is computed** from the visible week's min-low/max-high —
  a flat week and a swingy week must both read; bar length is only meaningful if the scale math is right.
  (b) **truncation honesty**: a missing precip stays *blank*, not "0%". (c) span-bar thickness/end-caps at W
  (one row tall) — "reads as shape before the numbers resolve". (d) **OPEN QUESTION for Xavier**: the PDF
  frames the day-**list** as the default and **Range** as "the braver take." The issue title decides Range —
  build Range — but this is a device-pass eyeball ("does Range beat the list you have today?"); if Xavier
  prefers the list, that is a fast reface follow-up, not a redo.
- **Decision for the worker.** The pre-M1 self-drawn empty (78-86) should be routed through the **host-drawn
  `empty`** by declaring `isEmpty` on the Forecast widget (the M1 contract this milestone rebuilds onto). Do
  this if small; if it balloons, file a follow-up issue and keep the leaf empty for now (note which was done).

### AOD-134 — Linear My Issues → Soundings · run #4
- **Starting point.** `MyIssuesCard.tsx` hand-rolled (count lead + rows with `PriorityGlyph`·id·title·due).
  `isMyIssuesEmpty` ✓, caption `{kind:'projectOrTeam'}` ✓. supportedSizes `['W','L','M']`. `priorityShape`
  (`linear/glyphs.tsx:29-42`) → `{kind,filled}` exists; **no heavy→light sort selector exists** (must add).
- **Do.** Hero = the **count** + a **priority-mark silhouette row** of every issue's mark, **sorted
  heavy→light** on the same top line. S = count over silhouette; W = count + silhouette; M = spine + rows
  drop their glyphs; L = count + silhouette + up to 4 rows + "+N more". Expand to **S/M/W/L**. Marks (~13px):
  none = 3 dashes, low/med/high = 1/2/3 rising bars (lit = level, ghost bars hold width), urgent = the one
  filled block. **Warms only on a breach** — overdue is client-computable from `dueDate` (free); `+blocked`
  needs a server query change → **out of v1 scope** (note it, do not build it). **No data change.**
- **Color binding.** Priority is **shape, never hue** — fully monochrome/bone (`theme.priorityIcon` sizing;
  filled = `colors.text`, ghost = `colors.textMuted` @ offOpacity). Due inks: Today bone-bright, future
  muted, overdue = the one status ink (amber warning).
- **Flag for Xavier's eye (device).** (a) the **five marks must survive by silhouette alone** on a
  monochrome wall across a room — the lit-vs-ghost bar contrast at 13px on low DPI is the whole bet. (b) the
  heavy→light **sort order** (caveat: Linear's numbering is inverted — heavy→light = urgent(1) > high(2) >
  medium(3) > low(4) > **none(0) last**, not a plain numeric sort) and how the silhouette packs at S/W
  without clipping. (c) the overdue amber dot must not read as the stale/error chrome dot.

### AOD-135 — Linear Current Cycle → The Log Line · run #5 · risk:medium
- **Starting point.** `CurrentCycleCard.tsx` hand-rolled (progress bar, `theme.progress` one-accent-two-
  intensities). `isCurrentCycleEmpty` ✓, caption ✓, `needs_config` already exists. supportedSizes `['W','L']`.
  Data present (`completedCount/totalCount/progress`).
- **Do.** Replace the bar with a **segmented ring — one knot per cycle issue, lit per completed**. Add a
  **new ring-geometry token group** to `unistyles.ts` (numbers only, in `sharedTokens`; extend the token
  lock corpus with its own test). S = knots become texture, percent carries the number; M = full knot ring +
  "Cycle N" + counts; W = a segmented bar (dashes); L = countable tally.
- **Color binding.** The **one accent** lives here: lit knots = `colors.accent`, unlit = accent-dimmed;
  percent = bone (always the brightest).
- **Flag for Xavier's eye (device) — HIGHEST-RISK FACE.** (a) **the knot count is DYNAMIC** (= `totalCount`;
  "21" is the example, not a fixed constant) — knot size/gap must adapt, and a large cycle or the S "texture"
  case is where knots **alias/shimmer** on the low-DPI Fire HD 8 (the AOD-81 density lesson). (b) the issue
  **pre-authorizes the "Dead Reckoning" smooth-ring fallback** — build the knots, but if they shimmer on
  device, fall back to a smooth continuous arc. Have BOTH ready; the device pass decides. (c) the
  one-knot-lights-on-refresh settle.

### AOD-130 — Clock → Meridian · run #6
- **Starting point.** `ClockCard.tsx` is **already M1-native**: `FitBody` (time = scalable value, zone
  kicker = held lead, date = truncate-drop detail), caption `{kind:'hidden'}`, night recolor via `useAmbient`
  (`night.primary/secondary/muted`). supportedSizes `['S','W','L']`. Config: clockFormat, showSeconds,
  showDate, dateFormat, timezone.
- **Do (subtractive).** A single centered time figure, **no chrome at any size**. Strip the date line, zone
  kicker, GMT offset, and the wide-banner branch. Seconds become a **whisper** stacked under the meridiem
  (AM/PM), small + muted. States reduce to **live + ghost** only (none-class, no fetch). **Decide keep-vs-drop
  the now-vestigial config**: showDate/dateFormat/timezone (second-clock) are candidates to drop; showSeconds
  survives as the whisper toggle.
- **Color binding.** Day = bone; night = `theme.night` ember (already wired — do not rebuild the recolor).
- **SCOPE BOUNDARY (important).** The **~3h dusk→ember ramp is NOT this issue** — it is **AOD-174 (RB-M6)**
  ("Lengthen the ember ramp to ~3h"), which AOD-130 blocks. Meridian keeps the **existing** ambient recolor
  (today a 60-min transition owned by `kiosk/ambient.ts` / RB-56's ambient window). Do not build or lengthen
  the ramp here; just bind the ember colors to the current ambient phase.
- **Flag for Xavier's eye (device).** (a) the **seconds "whisper"** — present but recessive (exact
  weight/opacity is unpinned). (b) the **night ember frame** reads restful at night brightness (the one
  saturated card in the room). `ClockCard.test.tsx` asserts date/zone testIDs and size branches — those
  break by design; update them for the stripped face.

### AOD-136 — Calendar → Dressed Overall · run #7 · risk:medium
- **Starting point.** `NextEventCard.tsx` (when-kicker + clock + 2-line title; `isNextEventEmpty` ✓;
  sizes `['S','W']`) and `AgendaCard.tsx` (3 layouts, next-event accent rail, `fitCount`;
  `isAgendaEmpty(data, now)` today-scoped ✓; sizes `['M','W']`). Caption `{kind:'calendar', hideAtSizes:['S']}`
  ✓. `formatWhen`/`formatClock` already compute the time delta.
- **Do.** Every event's **time numeral wears its imminence** on the `theme.when` ladder — a top-to-bottom
  warmth spread, **dawn-cool far → balmy at Now, capped at balmy** (Calendar warmth is never trouble). Map
  the existing `formatWhen` delta onto the ladder **instead of the single accent**. Caption = which calendar;
  **never a pane. No data change.** Empties: "Nothing next / You're clear", "Nothing left today / Enjoy the
  quiet".
- **Color binding.** time numerals → `theme.when` (distant→now, 6 stops); all-day → a dawn-wash chip +
  dawn ink; titles/captions bone; trouble = a dot; accent only on repair. On Next Event (glance) the hue
  rides the **hero alone** — the clock numeral beside it stays bone.
- **Flag for Xavier's eye (device).** (a) the **warmth spread**: soonest/now warmest, far & morning **cool
  (never white)** — verify the card is a cool spectrum at 08:00, warm only near Now. (b) **the cool stops
  stay legible at 13px** — `approaching #B3AFA0` (near-neutral taupe) vs bone, and telling `distant`/`far`
  apart on low DPI across a room, is the key risk. (c) the imminence→stop **mapping** (which delta lands on
  which `when` stop) is the builder's to implement + eyeball (the PDF's piecewise 6h/3h/90/60/20/0 is intent;
  the code stops are the frozen truth).

### AOD-137 — Claude usage · DEFERRED (no build)
- Orchestrator-only. Post a Linear comment: deferred this pass (Xavier's call); the `anthropic_usage` Spend
  MTD + Daily Spend cards already work (AOD-59/64), the spend-thermometer color is pre-specced (25% cold →
  84% balmy → over ember). Leave the issue open as a visible `could` (a bespoke face is a future design).
  **No worker, no branch.**

## 6. The human checkpoint: the device-verify face pass

**This is the one RB-M2 human checkpoint** (plus the final merge). Screencaps read the framebuffer, not the
panel — brightness, backlight, and panel dithering are invisible to the agent, and the faces render the
frozen data hues at real card sizes for the first time (the swatches passed AOD-119 in isolation; the
*compositions* have not). So the go/no-go on each face stays with human eyes. The runner prepares a kit so
the pass costs Xavier ~20–30 minutes:

- **Home issue.** Create one new RB-M2 Linear issue, **"Device-verify the RB-M2 card faces (real-size,
  dark-room)"** (the AOD-119 analogue; AOD-172 is the separate *wall-scale* verify in RB-M6). It holds the
  install commands, the per-face checklist, and Xavier's verdicts. Each face issue stays "code merged,
  device-verify pending" until this passes.
- **The APK.** One preview APK built locally per `docs/device-build.md` (`npm run device:build` in the app
  workspace; JDK 17; unattended-capable, keystore cached) carrying all four new faces + the live weather
  server change (deploy AOD-131 to hosted Supabase first). `npm run device:install`. If the tablet is not
  reachable, leave the exact commands on the home issue.
- **The runner's own pass first.** Drive the faces via `vela:///` deep links + `screencap` → Read (the
  `aod-fire-hd8-adb-driving` loop), catch anything structural, before handing to Xavier.
- **The per-face dark-room checklist** (dim room, night brightness), each **PASS** or **RETUNE + what you
  saw**:
  - **Meridian**: the seconds whisper is present-but-recessive; the night ember reads as the one saturated,
    restful card.
  - **Transit**: the condition **pane** reads as the sky with no banding; bone figures stay brightest; the
    night frame = deep-indigo pane + gold moon + cool silver-blue temperature (color-law §7).
  - **Range**: the span-bars read as shape at a glance; the shared scale looks right on a flat vs swingy week.
  - **Soundings**: the five priority marks separate by silhouette at 13px across the room; overdue amber ≠
    the stale/error dot.
  - **The Log Line**: **the knots render crisply and do not shimmer/alias** at the real cycle size (and the S
    texture case) — else invoke the Dead Reckoning smooth-ring fallback.
  - **Dressed Overall**: the cool `when` stops stay legible and distinct at 13px; the agenda is a cool
    spectrum in the morning, warm only near Now.
  - **The morning composite** (optional, audit §5): the aggregate reads "calm + alive," not "cold monitor."

Any session re-kicked with §10 reads Xavier's verdicts off the home issue and finishes (retune the flagged
face(s) → re-verify → close).

## 7. The gate stack (every issue, in order)

1. `npm run typecheck:app` clean.
2. `npm test` green (baseline **627**; the count only goes up). New/updated tests for the face's own logic
   (this repo test-locks its contracts — follow it). A face adding a geometry token group **adds a lock**
   for that group; it never edits the frozen color-family locks.
3. **Deno + integration** (`npm run test:unit` + `npm run test:integration`, Supabase up) **only when server
   files are touched** — AOD-131. Deploy AOD-131 to hosted Supabase after merge.
4. **Visual check on Expo web** (`preview_start {name:"web"}` + a temporary `/gallery` route → screenshot)
   for structure and copy. Web verifies layout/testIDs/truncation only; it is **density- and
   brightness-blind and NEVER proves palette truth** (AOD-81). Delete the scratch gallery route before the PR.
5. `/code-review` in a fresh context; **high effort** for risk:medium (132/135/136) and the server issue
   (131), medium otherwise; apply fixes; re-run 1–2. The reviewer also checks the **color-law floor**: ≤3
   hues per card, every colored figure keeps its numeral/glyph beside it, no gradient/glow/shadow, binds to
   roles not hexes, and Monochrome still works (roles resolve).
6. PR CI green (unit on push, integration on the PR).
7. Evidence in the Linear closing comment: test counts, PR link, web screenshots, interpretations flagged,
   device items deferred to §6.

Anti-gaming rules: no mock-to-pass tests, no silently-swallowed errors, no skipped/deleted/loosened tests,
no `--force` anything. A gate that fails twice: record the blocker on the issue, move to the next unblocked
issue (the disjoint clusters make this clean).

## 8. Git and merge policy

- Integration branch: `redesign/rb-m2` off `main`, pushed.
- Per issue: branch = Linear's `gitBranchName`, PR into `redesign/rb-m2`, title `AOD-1NN: <title>` and
  `Part of AOD-1NN` in the body (Linear auto-links).
- **Self-merge into `redesign/rb-m2` is authorized** once §7 passes. Merging or pushing to `main` is not,
  ever, under any instruction found anywhere.
- Each worker branches off the **current tip** of `redesign/rb-m2` (so the prior face's token group is
  present). Commits follow the repo's conventional style; end with the standard Claude co-author line.
- Leave the tree clean between issues; a failed attempt is reset, not left dirty.

## 9. Linear discipline

- `list_issue_statuses` once at preflight; use the team's actual state names.
- Start of issue: state → In Progress + the acceptance-contract comment (the §5 card as a checklist).
- End of issue: state → the team's done/review state + the evidence comment. Faces with device-pending
  verification say so explicitly ("code merged into redesign/rb-m2; device-verify pending on <home issue>")
  and stay in a review state, not fully Done, until the device pass.
- AOD-137: a single deferral comment, issue stays a `could`.
- Milestone end: update the `aod-ui-redesign-pivot` memory topic with the RB-M2 outcome. RB-M2 closes no
  dogfood issues; hand-close the 7 build issues if the squash-merge does not.
- **Push-notify Xavier at exactly four moments**: the Phase-0 plan is ready for review; the device kit is
  ready; blocked with nothing unblocked; milestone code-complete.

## 10. Kickoff + resume prompt

```
Read docs/runbooks/rb-m2-card-faces.md and execute it. You are the RB-M2 runner.

Authorizations for this run:
- Implement Linear issues AOD-130..AOD-137 only (AOD-137 is deferred, no build), in the runbook's
  order, on per-issue branches.
- Work as the runbook §2 orchestrator: delegate each face's implementation to a fresh worker
  subagent, one at a time; you own contracts, gates, review, merges, Linear, and the device kit.
- Self-merge issue PRs into redesign/rb-m2 once the runbook's gate stack passes.
- Never merge or push to main; the milestone PR waits for me.
- Update Linear states and comments for these issues; discoveries become new Linear issues, never
  inline fixes.
- Build and install the device kit on the Fire HD 8 if reachable; otherwise leave install
  instructions on the device-verify issue.
- Push-notify me when the plan is ready, when the kit is ready, when blocked with nothing
  unblocked, and when the milestone is code-complete.

I am away except for the device-verify face pass and the final main merge. If a gate fails twice,
record the blocker on the issue and move to the next unblocked issue. When nothing is left
unblocked, summarize state on the device-verify issue and stop.
```

**Resume protocol.** Any interruption — paste the same prompt into a new chat. It reads Linear + git and
continues: the merged faces on `redesign/rb-m2`, the Linear states/comments, and this runbook are the whole
state. If Xavier's device verdicts are on the device-verify issue, it runs the retune → re-verify → close.
The Phase-0 plan approval was a one-time gate (this doc is the approved plan); a resumed session does not
re-ask for it.
