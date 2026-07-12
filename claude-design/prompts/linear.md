# Linear — Claude Design prompt (card-faces phase)

Third per-service card-face chat. One service, two cards (My Issues + Current Cycle), designed from zero
against [`docs/specs/vela-DESIGN.md`](../../docs/specs/vela-DESIGN.md) §9. The first card whose hero is a
**count + a list** (My Issues) and the first with a **progress** hero (Current Cycle); the first service with
**required per-instance config** (a project / a team), so the first with a `needs_config` state.

## Data palette audit — what the Linear cards actually know

`authClass: 'oauth2'` (real Linear OAuth; the "viewer" actor model means My Issues is always *your* issues).
Ground truth: `registry/services/linear/{index,MyIssuesCard,CurrentCycleCard,glyphs}.tsx` + the GraphQL
queries + normalize in `supabase/functions/_shared/operations.ts` (`MY_ISSUES_QUERY` / `CURRENT_CYCLE_QUERY`
are the real boundary).

**My Issues** (`viewer.assignedIssues`, one project, refresh ~5 min):

| Value | What it is | Example |
|---|---|---|
| **totalCount** | The assigned count; the hero. Qualifier echoes the filter | `6 open` / `6 in progress` / `6 assigned` |
| **issues[]** | Each: identifier, title, priority (0–4), state, due date | see below |
| — identifier | The issue key | `AOD-104` |
| — title | The issue title | `No per-widget delete` |
| — priority | 0 none · 1 urgent · 2 high · 3 medium · 4 low → a **shaped glyph** | `urgent` |
| — state | Workflow state name + type (backlog/unstarted/started/completed/canceled) | `In Progress` |
| — dueDate | Nullable; "Today"/overdue emphasized, future recedes | `Today` |
| **filter** (config) | open / in_progress / all | `open` |
| **projectId** (config, required) | Which project the card is scoped to (remote-options) | — |

**Current Cycle** (`team.activeCycle`, one team, refresh ~10 min):

| Value | What it is | Example |
|---|---|---|
| **progress** | 0..1 → the hero (ring/bar) | `0.62` |
| **completedCount / totalCount** | Issues done / total in the cycle | `13 / 21` |
| **number + name** | Cycle number, optional name | `Cycle 12` |
| **startsAt / endsAt** | Dates; endsAt → "ends in N days" | `ends in 4 days` |
| **active: false** | The team has no live cycle (a normal state) | `No active cycle` |
| **teamId** (config, required) | Which team (remote-options) | — |

Also known: the current day (due/cycle-end math) and the day/night ambient phase (both cards dim after dark,
normal palette, no ember).

**The priority glyph = My Issues' distinctive mark.** Five marks by **shape, not color**: a faint three-dash
"none", one/two/three ascending bars for low/medium/high, a filled block with a cut-out exclamation for
urgent. Monochrome always (a colored-priority-dot rainbow would break one-accent + the status-hue reservation).

## What to reject (data we do NOT collect)

- **My Issues:** no assignee (always you), labels, estimates/points, comments, descriptions, sub-issues,
  created/updated times, cross-project aggregation (scoped to ONE project). Each issue is *only* identifier /
  title / priority / state / due date.
- **Current Cycle:** no per-state breakdown, no velocity, no list of the cycle's issues. Only progress /
  completed / total / number / name / dates.
- **No** git/PR data, notifications, or activity feed.
- **Two "queried but not in the contract" fields** (available only with a small server change, like Weather's
  sunrise/sunset was): the cycle **burndown history** (`issueCountHistory` / `completedIssueCountHistory` are
  fetched but the normalize keeps only the latest totals), and each issue's **workflow state** (fetched, but
  the shipped card never renders it). Offer them to Fable as *optional* enrichments, flagged, not required.

## Sizes & states

- **My Issues** (count leads, list follows): recommend **S** (the count alone), **M** (count + 3–4 rows),
  **L** (count + up to 7 rows with due dates + "+N more"). A **W** 2×1 banner is one row tall and awkward for
  a vertical list — skip it or make it count + a one-line breakdown (Fable's call).
- **Current Cycle** (progress hero, a ring per the plan): recommend **all four** — ring+% at S, ring+label+counts
  at M, a horizontal bar at W, big ring + counts + "ends in N days" at L.
- (Both differ from the code's pre-pivot `supportedSizes`; these are recommendations to reconcile at build.)
- **States:** the two **good empties** are first-class here — My Issues "You're all caught up" (checkbox
  glyph) and Current Cycle "No active cycle" (cycle-ring glyph); design them. Plus loading skeleton, stale/error
  dot, disconnected "Connect Linear", and — unique to Linear — **needs a project / needs a team**.

## The movement calibration (Linear is the quietest case)

Weather had the sun, a signal that always moves. **Linear is work data: it changes in discrete steps, slowly,
and sits still between changes.** So its honest motion is the quietest yet — the in-flight refresh breath, a
count that settles to a new value when an issue is assigned/closed, a progress ring that eases to its new fill
on refresh. **Nothing animates continuously; a work list that isn't changing should be still.** Do not invent
motion the data doesn't have. This extends the calibration: not every card is as alive as Weather.

**One accent, spent differently:** My Issues reads calmest as **monochrome** (the count is the bright figure;
priority is shape, not color). Current Cycle is where the **one accent lives** (the progress fill is accent,
the track the same accent dimmed).

---

## The prompt (paste into Claude Design)

> Design the **Vela Linear cards** as one system: the work-status face of an always-on dashboard, lit 24 hours
> a day. Two cards share the Linear identity: **My Issues** (your assigned issues — a count and a list) and
> **Current Cycle** (a team's active sprint — a progress ring). **Design from zero.** Linear is **work data**:
> it changes in discrete steps and slowly, not continuously like the sun or the clock, so hold it to the
> calmest end of ambient-alive — still when nothing moves, a quiet settle when work changes. Never busy.
>
> **What these cards live in.** Vela is dark-first and emissive; each lit card is a point of light on a
> near-black field, one accent, no gradients, no glow, no shadows. The value dominates; the chrome recedes.
>
> **The real data — everything the Linear cards actually know. Use only this; invent nothing else.**
>
> *My Issues* (your assigned issues in one project; refreshes ~5 min):
> - **A count** — how many issues are assigned to you, with a qualifier from the filter: "6 open" / "6 in
>   progress" / "6 assigned". The count is the hero.
> - **A list of those issues**, each with: an **identifier** ("AOD-104"), a **title**, a **priority** (one of
>   five — none, low, medium, high, urgent), a **workflow state** ("In Progress", "Backlog", "Done"), and an
>   optional **due date** ("Today" and overdue stand out; future dates recede).
> - The card is scoped to **one project** (chosen when it's added) and one filter.
> - Nothing assigned is a **good** state: "No assigned issues / You're all caught up."
>
> *Current Cycle* (one team's active sprint; refreshes ~10 min):
> - **Progress** — how far through the cycle's work, 0–100%. The hero.
> - **Completed and total** issue counts (13 of 21).
> - The **cycle number and name** ("Cycle 12", optionally named) and its **start and end dates** → "ends in 4
>   days".
> - No live cycle is a normal state: "No active cycle / No cycle running."
>
> **The priority glyph is My Issues' distinctive mark** — Linear's own priority language, five marks told by
> **shape, not color**: a faint three-dash "none", one/two/three ascending bars for low/medium/high, and a
> filled block with a cut-out exclamation for urgent. Monochrome always; priority is never a colored-dot
> rainbow (that breaks the one-accent rule and the status-hue reservation).
>
> You also know the **current day** (for due-date and cycle-end math) and the **day/night ambient phase**
> (both cards dim after dark with the wall, normal palette, no ember).
>
> **Do not use** an assignee (My Issues is always *your* issues), labels, estimates or points, comments,
> descriptions, sub-issues, created/updated times, cross-project aggregation, per-state cycle breakdowns, a
> burndown history, or any git / PR / notification data. None of it is collected. Each issue is only its
> identifier, title, priority, state, and due date; each cycle is only its progress, counts, number/name, and
> dates.
>
> **Aliveness — the quietest calibration yet.** Weather had the sun, a signal that always moves; Linear's data
> sits still until real work changes it. So the honest motion is minimal: the in-flight refresh breath, a
> count that settles to its new value when an issue is assigned or closed, a progress ring that eases to its
> new fill on refresh. Nothing animates continuously. A work list that isn't changing should be still. Do not
> invent motion the data doesn't have.
>
> **One accent, spent differently on each card.** My Issues reads calmest as **monochrome** — a dense work
> list with a colored accent per row becomes noise; let the count be the brightest thing and the priority
> glyphs carry level by shape. Current Cycle is where the **one accent lives**: the progress fill is the
> accent, the remaining track the same accent dimmed, so the ring is the card's one bright figure.
>
> **The two cards and their footprints — fit both width and height; never clip, never leave dead space.** The
> grid is two columns of 96px rows.
>
> *My Issues* — the count leads, the list follows:
> - **Small (1×1)** — the count alone: "6 open". A glance.
> - **Medium (1×2)** — the count, then three or four issue rows (glyph · identifier · title).
> - **Large (2×2)** — the count, then up to seven rows with due dates, and "+N more" for the overflow.
> - (A wide 2×1 banner is one row tall and awkward for a list — either skip it or make it the count plus a
>   one-line breakdown; your call.)
>
> *Current Cycle* — the progress is the hero, across all four:
> - **Small (1×1)** — a ring with the percent inside.
> - **Medium (1×2)** — the ring, the "Cycle 12" label, the completed/total counts.
> - **Wide (2×1)** — a horizontal progress bar, the percent, the label alongside.
> - **Large (2×2)** — a large ring, the label, the counts, and "ends in 4 days".
>
> The count and the percent are always the brightest things; tabular figures so they never jitter as they
> settle. When space runs tight, detail gives way first — the due date, then the state, then the title
> truncates — never the count, the priority glyph, or the progress.
>
> **States.** Live is the main face. Design the two **good empties** — My Issues "You're all caught up" (a
> checkbox glyph) and Current Cycle "No active cycle" (a cycle-ring glyph) — since they're real, calm,
> everyday states, not errors. Also: loading (a skeleton shaped to the list or the ring, no spinner); stale
> and error (a dot by the caption, never a recolor); disconnected ("Connect Linear", tappable); and, unique to
> Linear, "needs a project" / "needs a team" when a card hasn't been pointed at one yet.
>
> **Caption.** Consider carrying the **project** (My Issues) or **team** (Current Cycle) in the caption rather
> than the widget name, the way Weather carries its place — it's the useful disambiguator when someone has more
> than one. Your call within that spirit.
>
> **Deliver 3–5 distinct directions for My Issues** (the flagship), and **1–2 takes for Current Cycle** that
> share the Linear DNA (monochrome, the shape-carried glyph language, the confident count and percent).
> Dark-first. Show each on a **phone (portrait)** and a **landscape wall tablet** seen from across a room.
> Include the **caught-up empty** and a **night** frame, and use **real values** — project "Platform & App
> Shell", 6 open: AOD-104 "No per-widget delete" (urgent, due Today), AOD-100 "Input hidden behind keyboard"
> (high), AOD-97 "Content doesn't fit cell" (high), AOD-95 "Widgets clip at default size" (medium), AOD-93 "No
> first-run value prop" (medium), AOD-99 "Connections need icons" (low), +3 more; Current Cycle "Cycle 12",
> 62%, 13 of 21, ends in 4 days — never placeholder text.
>
> Finally, feel free to be creative. Explore and invent within the data above; don't take my layout notes
> literally. The data palette is the only hard boundary; inside it, surprise me.
