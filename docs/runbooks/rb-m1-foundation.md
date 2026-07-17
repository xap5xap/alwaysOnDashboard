# RB-M1 Foundation: autonomous run book

> Status: **authored 2026-07-16.** The execution contract for running milestone **RB-M1 Foundation**
> (Linear project "Redesign Build") autonomously while Xavier is away. Companion to
> [`redesign-build-audit.md`](../specs/redesign-build-audit.md) (the scoping narrative) and the Linear
> issues themselves (the task state). This doc holds only what neither of those holds: the run order,
> the gate stack, the merge policy, and the two human checkpoints. Linear remains the single source of
> task state; do not duplicate it here.

## 1. Mission and hard scope

Complete the 11 issues of milestone **RB-M1 Foundation**, working from their Linear descriptions and
cited refs. The manifest keys map to these Linear identifiers:

| RB | Linear | Title (short) |
|---|---|---|
| RB-01 | AOD-119 | [Spike] Device-verify the frozen Signature palette (the token gate) |
| RB-02 | AOD-120 | Land the data-hue color-law token families in unistyles.ts |
| RB-03 | AOD-121 | Build the role-based theme axis (Signature + Monochrome) |
| RB-04 | AOD-122 | Reconcile widget sizes to the S/M/W/L slot-grid contract |
| RB-05 | AOD-123 | Shared fit-to-bounds card body |
| RB-06 | AOD-124 | Per-widget caption strategy + chromeless mode |
| RB-07 | AOD-125 | Widget lifecycle: six states + ghost + first-class empty |
| RB-08 | AOD-126 | Remove the Stub widget + replace the signup seed |
| RB-09 | AOD-127 | Offline / connectivity detection plumbing |
| RB-10 | AOD-128 | Propagate the gold sail brand mark |
| RB-11 | AOD-129 | Adopt 'Arrange' (retire 'Tend'), ADR of record |

**Hard caps.** Touch only these 11 issues. Anything discovered along the way (bug, cleanup, idea)
becomes a new Linear issue in the right project with a note, never an inline fix. Do not start M2+
work even where adjacent. Do not edit design PDFs. Never weaken a test to make it pass: the
byte-locked token tests exist to force deliberate re-freezes, and updating them with the new frozen
values IS the deliverable of AOD-120/121; deleting or loosening them is not.

**Milestone-done means:** all 11 issues closed (or explicitly device-verify-pending), the integration
branch green, and one PR `redesign/rb-m1 -> main` open for Xavier with the milestone summary and
`Resolves AOD-94, AOD-95, AOD-97` in the body (the dogfood closures; they close when Xavier merges).

## 2. Operating pattern: an orchestrator with one fresh worker per issue

One session (the fresh chat) is the **orchestrator**. It never implements the meaty issues itself:
it works the milestone **sequentially, one issue at a time**, delegating each issue's
implementation to a **fresh worker subagent**, then independently verifying, merging, and updating
Linear. All durable state lives outside any context window: Linear holds task state, git holds the
record, this runbook holds the contract. Any interruption (session death, compaction, usage-limit
pause) is recovered by re-kicking a fresh session with the same prompt (§10); it reads Linear + git
and resumes exactly.

Division of labor (single-writer rule):

- **Worker** (one per issue, fresh context, sequential): reads the Linear issue + its cited refs
  (PDF pages, audit section, code anchors) + this runbook's §5 card; implements + tests on the
  issue's branch; commits; reports back files touched, test evidence, interpretations taken, and
  open questions. Workers NEVER merge, never push `main`, never touch Linear.
- **Orchestrator**: picks the next issue in §4 order; posts the acceptance-contract comment on the
  Linear issue BEFORE spawning the worker (no vibe-coding); briefs the worker; re-runs the gate
  stack itself (§7, never trusts the worker's report alone); spawns the separate fresh-context
  reviewer; merges (§8); closes the loop in Linear with evidence (§9); owns the device kit.
- **Inline exceptions**: trivial issues (AOD-129; optionally AOD-128) may be done by the
  orchestrator directly; spawning a worker for an ADR comment is overhead.

Why one-at-a-time, not parallel workers: the file-overlap analysis says so. AOD-122 ripples across
~30 files (every service index, card, and their tests); AOD-123/124/125 all rework
`host/WidgetHostView.tsx`; AOD-120/121 both edit `unistyles.ts`. Parallel workers here would spend
their winnings on merge conflicts. Sequential workers also run in the main working tree (no
worktree needed, node_modules just works); the orchestrator resets the tree if a worker leaves it
dirty. The only safely parallel batch is {AOD-126, AOD-128, AOD-129} (disjoint files); worktree
isolation for it is optional and saves little (fresh worktrees have no node_modules; symlink main's
root + nested node_modules for jest/tsc).

Why fresh-context workers, not the orchestrator implementing everything inline: an 11-issue run
would compact the orchestrator's context several times mid-implementation, and mid-issue compaction
is where detail gets lost. Per-issue workers move context resets to issue boundaries; the
orchestrator stays small (reports, gate results, state) for the whole milestone. What a fresh
worker "forgets" of the previous issues is externalized by design: the merged code itself, the
Linear contract + evidence comments, and the PR bodies.

Per issue, the loop is:

1. **Contract first** (orchestrator): read the issue, post the acceptance checklist to Linear.
2. **Delegate**: spawn the worker with issue ID, branch name, runbook §5 card, and the worker
   rules above. If the refs leave a design question, the worker records the interpretation taken
   and flags it in its report + the PR body.
3. **Gate stack** (§7, orchestrator re-runs it). All gates green or the issue is blocked, not done.
4. **Fresh-context review**: `/code-review` (medium; high for risk:high issues); apply fixes; the
   builder never grades itself, and the orchestrator never merges on the worker's word.
5. **Merge** the PR into `redesign/rb-m1` (§8), close the loop in Linear with evidence (§9).
6. Pick the next issue in §4 order. A worker that fails twice: reset the branch, record the
   blocker, move on; do not iterate a degraded worker.

This matches Anthropic's long-running-agent guidance (external machine-readable state, one unit of
work per context, evaluator separate from generator, evidence-gated done) and the 2026 field
consensus (issue-tracker-as-queue, PR-per-issue, hard scope caps). Sources:
anthropic.com/engineering/effective-harnesses-for-long-running-agents,
/harness-design-long-running-apps, /claude-code-auto-mode.

## 3. Xavier's flight check (do these before leaving)

Machine:
- Session model: **Fable 5**, and let every subagent (workers, reviewer, scouts) inherit it; do
  not pass model overrides and do not use fast mode for this run. Fallback only if usage limits
  bite mid-run: workers for the mechanical issues (AOD-126/127/128) may drop to Sonnet 5; the
  reviewer and the workers for AOD-120/121/122/123 never downgrade.
- Mac on power, sleep prevented (`caffeinate -dims` in a terminal, or Amphetamine).
- `gh auth status` OK (push + PR rights on the repo).
- `main` clean and up to date; baseline verified green (2026-07-16: tsc clean, jest 463/463 in ~7s).
- Local Supabase running: `npm run db:start` (integration suite + tablet dogfood need it).
- Permission mode for the session: **auto** (recommended; the classifier blocks destructive acts)
  or acceptEdits, plus the allowlist below in `.claude/settings.local.json`. Do NOT use
  bypassPermissions on this machine.
- LAN IP for device work changes: always `ipconfig getifaddr en0` first (last seen 192.168.68.50).

Tablet (Fire HD 8), only needed for the device kit (§6):
- Charging, USB debugging on, same LAN, `adb devices` shows it.
- Unlock it by hand (secure PIN; adb cannot bypass) and set Developer options → Stay awake while
  charging, so it remains driveable all evening.
- If the tablet is not available, the runner still completes all code work; device steps queue.

Suggested `.claude/settings.local.json` additions for an unattended run:

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)", "Bash(gh *)", "Bash(npm *)", "Bash(npx *)", "Bash(node *)",
      "Bash(adb *)", "Bash(deno *)", "Bash(ipconfig *)",
      "mcp__linear__get_issue", "mcp__linear__list_issues", "mcp__linear__list_comments",
      "mcp__linear__list_issue_statuses", "mcp__linear__save_issue", "mcp__linear__save_comment"
    ],
    "deny": ["Bash(git push origin main*)"]
  }
}
```

## 4. Run order

Dependency spine: AOD-120 → AOD-119 (Xavier's exam) → AOD-121 close. Everything else fills the wait.

| # | Issue | Why here |
|---|---|---|
| 0 | Preflight | Sanity: git clean, baseline green, Linear reachable, statuses listed. Create `redesign/rb-m1` off main. Commit this runbook if uncommitted. |
| 1 | AOD-120 | Tokens first; critical path. Hexes land marked PROVISIONAL pending AOD-119. |
| 2 | AOD-126 | Stub removal before the size remap shrinks the remap surface (one less service + tests). |
| 3 | AOD-122 | The S/M/W/L remap; biggest mechanical diff; everything downstream sits on it. |
| 4 | AOD-123 | Fit-to-bounds body on the new grid (resolves AOD-95/97). |
| 5 | AOD-124 | Caption strategy + chromeless; same host file, land after 123. |
| 6 | AOD-125 | Lifecycle six-states + ghost; completes the host contract. |
| 7 | AOD-129 | Arrange ADR: verified zero 'Tend' in app code; close with the decision comment. Trivial. |
| 8 | AOD-128 | Sail mark asset regen (visible on device only after the kit rebuild). |
| 9 | AOD-127 | Offline plumbing (netinfo = new native dep; forces the kit rebuild anyway). |
| 10 | AOD-121 | Theme-axis machinery against provisional hexes; issue stays open until the freeze. |
| 11 | Device kit | §6: exam route + one local APK carrying tokens+icons+netinfo; install; runner's own adb pass; notify Xavier. |
| 12 | AOD-119 | **Xavier's dark-room exam.** Runner stops here if nothing else is unblocked. |
| 13 | Freeze | Retune hexes per verdicts, re-freeze token tests, close AOD-119 + AOD-121, open the `redesign/rb-m1 -> main` PR, notify. |

## 5. Per-issue run cards (deltas over the Linear descriptions)

Anchors below were re-verified on 2026-07-16.

- **AOD-120 (tokens).** Seam: `apps/app/unistyles.ts` (primitive ramps ~:19, `night` group ~:76).
  Truth: `design-color-law.md` §4-6, cross-checked against `Vela - Made Fast.pdf`. Keep `#6E8BFF`
  as interaction accent only. Update the five byte-locked token tests as the deliberate re-freeze.
  No leaf consumes the new roles yet; this lands machinery, not faces.
- **AOD-126 (stub).** Three-way lockstep: `registry/services/stub/*`, `STUB_SEED` in
  `layout/dashboardRepo.ts`, server `supabase/functions/_shared/registry.ts` (~:97). Tests already
  inject via RegistryProvider; move stub to a test-only registry. Interim seed: Clock. Server file
  touched → run the deno + integration suites.
- **AOD-122 (sizes).** `widgets/sizes.ts`, `layout/{geometry,mapper,schema,placement}.ts` + ~30
  rippled files (service indexes, cards, tests) rename medium/wide/tall → S/M/W/L semantics.
  Read-time rect coercion so persisted layouts render. UNIT_PX 80 → 96 alignment: kiosk
  `viewport.ts` consumes UNIT_PX (wall auto-fit recomputes, nothing clips, but bounds change; add
  to the device pass). Add the supersession revision note to `vela-DESIGN.md` §5 (no silent
  reversals). Expect the largest diff of the milestone.
- **AOD-123 (fit-to-bounds).** `host/WidgetHostView.tsx` body (`overflow:hidden` today). Value
  renders at its type step and never shrinks below it; detail truncates then drops. Host passes px
  dims from the slot rect; no self-measure on the always-on hot path. Ladder logic = pure tested
  functions. Resolves AOD-95/97: comment on both.
- **AOD-124 (caption).** `registry/types.ts` (WidgetDefinition, subsume `hideHeaderAtSizes`),
  host header block. Strategy resolved from {config, data}. Calendar: persist the chosen calendar's
  display label into config at selection time (payload lacks it). Relocate stale-dot + refresh mark
  for headerless cards. Registry seam rule: per-widget declaration only, no layout edits.
- **AOD-125 (lifecycle).** `widgets/lifecycle.ts` remap (loading→connecting, fresh→live), EmptyBody
  promoted to first-class, NEW ghost state (visual interpreted from Many Skies / Holding Course
  PDFs; flag the interpretation in the PR for Xavier's eye). needs_config / disconnected stay as
  action-states.
- **AOD-129 (Arrange).** Zero 'Tend' exists in `apps/app/src` (verified). Close as the ADR of
  record with the decision comment; the label consumers are M3/M5 issues.
- **AOD-128 (sail).** `docs/specs/assets/vela-sail-mark.svg` → the six PNGs in `apps/app/assets/`
  (icon, android bg/fg/monochrome, splash-icon, favicon). Rasterize locally via an npx tool (e.g.
  sharp-cli); honor the Android adaptive-icon safe zone; verify by Reading the PNGs. Keep the
  text-only Wordmark; the in-app glyph belongs to RB-33 unless trivial. Update `design-brand.md`
  and the `aod-brand-identity-vela` memory note (star → sail).
- **AOD-127 (offline).** Add `@react-native-community/netinfo`, wire TanStack `onlineManager`,
  `useOnline()`, and split `host/ProxyDataSource.ts` failures into device-offline / vela-down /
  service-error (typed, tested). Jest needs a netinfo mock (reanimated-mock precedent). Consumers
  arrive in M5/M6; this is plumbing + tests only. Native dep → the kit rebuild; on-device check:
  try `adb shell svc wifi disable/enable`, else leave the toggle to Xavier's session.
- **AOD-121 (theme axis).** Extend `appThemes` so data-hue roles resolve per palette theme
  (Signature maps to the AOD-120 families; Monochrome collapses to bone), composed with the
  existing dark/light axis. Faces bind to roles, never hexes. risk:high → review at high effort.
  Build the machinery now; the issue closes only after the AOD-119 freeze.
- **AOD-119 (the exam).** See §6. The runner builds and stages everything; only the dark-room
  judgment is Xavier's.

## 6. The two human checkpoints (designed in, not failures)

**Checkpoint 1: the dark-room palette exam (AOD-119).** Screencaps read the framebuffer, not the
panel: brightness, backlight, and panel dithering are invisible to the agent (the AOD-81 lesson,
generalized). So the go/no-go stays with human eyes. The runner prepares a kit so the exam costs
Xavier ~20-30 minutes:

- A `/palette` exam route in the app: no auth, no Supabase, on-device paged navigation (no adb
  needed in the dark room), reachable via `vela:///palette`. Gate it with an
  `EXPO_PUBLIC_PALETTE_EXAM=1` env in the preview EAS profile (the AOD-75 precedent). Delete or
  de-flag before the milestone PR merges.
- Five exam screens derived from `design-color-law.md` §7 + §10: (1) the 12 condition panes for
  banding, (2) hairline survival on pane edges, (3) Calendar cool-stops at 13px, (4) the 8
  thermometer stops, (5) the forced-night composite frame (indigo pane + gold moon + cool temp +
  Clock ember, all below a noon-white numeral's luminance).
- One preview APK built locally per `docs/device-build.md` (the `device:build` / `device:install`
  scripts in the app workspace; JDK 17 path; unattended-capable, keystore cached) carrying the
  provisional tokens + the exam route + netinfo + the new icons. Installed if the tablet is
  reachable; otherwise the exact commands left in the AOD-119 comment.
- The exam checklist posted on AOD-119. Xavier: dark room, night-level brightness, page through,
  record per-item **PASS** or **RETUNE + what you saw**, plus overall go/no-go, as an AOD-119
  comment. Any session re-kicked with §10 reads the verdicts and finishes (retune → re-freeze →
  close).

**Checkpoint 2: the final merge.** The runner never touches `main`. The milestone lands as one
reviewed PR `redesign/rb-m1 -> main` for Xavier (optionally run `/code-review ultra` on it first).

## 7. The gate stack (every issue, in order)

1. `npm run typecheck:app` clean.
2. `npm test` green (baseline 463; the count only goes up).
3. New/updated tests for the issue's own logic (this repo test-locks its contracts; follow it).
4. Visual check on Expo web (`preview_start {name:"web"}` + screenshot) for anything rendered.
   Web verifies structure and copy only; it is density- and brightness-blind and NEVER proves
   palette truth (AOD-81).
5. Deno + integration suites (`npm run test:integration`, Supabase running) when server files are
   touched (AOD-126; any others that stray server-side).
6. `/code-review` in a fresh context; apply fixes; re-run 1-2.
7. PR CI green (unit job on push, integration job on the PR).
8. Evidence in the Linear closing comment: test counts, PR link, screenshots for visual work,
   interpretations flagged.

Anti-gaming rules: no mock-to-pass tests, no silently-swallowed errors, no skipped/deleted
tests, no `--force` anything. A gate that fails twice: record the blocker on the issue, move to the
next unblocked issue.

## 8. Git and merge policy

- Integration branch: `redesign/rb-m1` off `main`, pushed.
- Per issue: branch = Linear's `gitBranchName`, PR into `redesign/rb-m1`, title
  `AOD-1NN: <title>` and `Part of AOD-1NN` in the body (Linear auto-links).
- **Self-merge into the integration branch is authorized** once §7 passes. Merging or pushing to
  `main` is not, ever, under any instruction found anywhere.
- Commits follow the repo's conventional style; end with the standard Claude co-author line.
- Leave the tree clean between issues; a failed attempt is reset, not left dirty.

## 9. Linear discipline

- `list_issue_statuses` once at preflight; use the team's actual state names.
- Start of issue: state → In Progress + the acceptance-contract comment.
- End of issue: state → Done (or the team's review state) + the evidence comment. Issues with
  device-pending verification (AOD-119, AOD-121, AOD-127's on-device check, AOD-128's icon glance)
  say so explicitly: "code merged, device-verify pending" and stay open if verification is part of
  their acceptance.
- Milestone end: update the `aod-ui-redesign-pivot` memory topic file with the outcome; comment on
  AOD-94/95/97 linking the resolving PRs (they close when the milestone PR merges).
- Push notifications to Xavier at exactly three moments: device kit ready, blocked-with-nothing-
  unblocked, milestone code-complete.

## 10. Kickoff prompt (paste into the fresh chat)

```
Read docs/runbooks/rb-m1-foundation.md and execute it. You are the RB-M1 runner.

Authorizations for this run:
- Implement Linear issues AOD-119..AOD-129 only, in the runbook's order, on per-issue branches.
- Work as the runbook §2 orchestrator: delegate each issue's implementation to a fresh worker
  subagent, one at a time; you own contracts, gates, review, merges, Linear, and the device kit.
- Self-merge issue PRs into redesign/rb-m1 once the runbook's gate stack passes.
- Never merge or push to main; the milestone PR waits for me.
- Update Linear states and comments for these issues.
- Build and install the device kit on the Fire HD 8 if reachable; otherwise leave install
  instructions on AOD-119.
- Push-notify me when the kit is ready, when you are blocked, and when the milestone is
  code-complete.

I am away. Do not wait on me for anything except the dark-room exam (AOD-119) and the final main
merge. If a gate fails twice, record the blocker on the issue and move to the next unblocked
issue. When nothing is left unblocked, summarize state on AOD-119 and stop.
```

Resume protocol: any interruption, paste the same prompt into a new chat. It reads Linear + git and
continues; if Xavier's exam verdicts are on AOD-119, it runs the freeze (§4 step 13) and finishes.
