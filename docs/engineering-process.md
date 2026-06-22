# alwaysOnDashboard — Engineering Process

> How we go from product vision to shipped software, with every decision traceable. Modeled on the Armonia engineering process and the [Linear management playbook](../../../ClaudeProjects/armonia/Armonia/product/linear-management-playbook.md), adapted for a pre-scaffold SaaS product where Xavier is user zero (there is no external discovery phase to run).

> Status: draft, 2026-06-17. Proposed structure pending Xavier's approval before the Linear seed batch is created.

---

## Why this document exists

[`docs/product-vision.md`](product-vision.md) is the **narrative** — what we are building and why. This document is the **how**: how a line in the vision doc becomes a resolved decision, a written spec, and eventually shipped code, without losing the reasoning along the way.

The one rule everything else follows:

> **The vision doc holds narrative. Linear holds the work.**

An open question in the vision doc becomes a Linear issue. We pick it up, decide, record the decision *in the issue*, close it, and mirror the one-line outcome back into the vision doc's "Decisions made" list with a link to the issue. Linear is the working + audit layer; markdown is the readable summary. We never duplicate live task state (status, assignee, priority) into markdown.

This reconciles with the repo [`CLAUDE.md`](../CLAUDE.md) rule ("Markdown holds vision/specs/decisions; Linear holds tasks"):

| Artifact | Lives in | Linear's role |
|---|---|---|
| Product narrative / vision | `docs/product-vision.md` | — |
| A decision to make (ADR) | The Linear issue body | The issue **is** the record |
| Settled-decision one-liner | `product-vision.md` "Decisions made" | Linked back to `AOD-N` |
| A spec (the content) | `docs/specs/*.md` | A `type:spec` issue tracks the work + links to the doc |
| A task / bug / build unit | Linear | Source of truth |

---

## The decision-driven workflow (the core loop)

Right now the project is pre-scaffold. The work is not coding — it is resolving the open questions that gate scaffolding. Each one is a Linear issue with this lifecycle:

1. **Backlog** — the question is captured as a `type:decision` issue, body in ADR shape (Context + Options).
2. **In Progress** — we sit down on that *one* issue, weigh the options, and decide. Keep one or two In Progress at a time, no more.
3. **Done** — the chosen option + rationale + consequences are written into the issue body (the closed issue is the ADR of record), and the one-line outcome is mirrored into `product-vision.md` "Decisions made" with a link to `AOD-N`.

That is the loop Xavier described: pick an issue, set it in progress, decide, document it in the issue, set it done. Same loop later applies to `type:spec` (output is a markdown spec) and `type:tech-task` (output is code/config).

---

## The phases

The project moves through four phases. Each closes on an explicit done criterion. Phases are internal vocabulary — they live as milestone/label semantics in Linear, never as projects (per playbook pitfall: don't model phases as projects).

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Phase 0    │ │   Phase 1    │ │   Phase 2    │ │   Phase 3    │
│  DEFINITION  │▶│  FOUNDATION  │▶│    BUILD     │▶│    LAUNCH    │
│              │ │              │ │              │ │              │
│ Resolve the  │ │ Backend +    │ │ v1 services  │ │ App Store +  │
│ decisions +  │ │ auth + app   │ │ + Kiosk Mode │ │ Play + subs  │
│ write specs  │ │ shell + one  │ │ + billing    │ │ live, public │
│              │ │ live slice   │ │ gate         │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
   🔄 CURRENT       ⏭️ next          ⏭️ TBD           ⏭️ TBD
```

### Phase 0 — Definition (🔄 current)

**Goal:** resolve every decision that gates scaffolding, and write the specs the build will follow.

**Done when:** all blocking `type:decision` issues are closed (stack locked, billing model + tier boundaries set, v1 widget set chosen, privacy/token-security posture written; brand name picked or explicitly deferred), and the core specs are authored (architecture contract, OAuth/token model, entitlement model).

### Phase 1 — Foundation

**Goal:** stand up the skeleton. Supabase backend (auth + Postgres + token broker), Expo app shell with expo-router, the service → widget → layout registry, and one live end-to-end vertical slice.

**Done when:** a user can sign in, connect one real service, add its widget to a dashboard, and watch it auto-refresh on the Fire HD 8.

### Phase 2 — Build

**Goal:** implement the v1 service set (Linear, Google Calendar, Claude usage, Weather, Clock), Kiosk Mode, free-form layout, and the freemium / RevenueCat entitlement gate.

**Done when:** v1 is feature-complete on an internal track (TestFlight + Play internal), and Xavier dogfoods full kiosk mode daily.

### Phase 3 — Launch

**Goal:** App Store + Play submission, subscription live, public.

**Done when:** published on both stores with working Free and Pro tiers.

This is the **Phase 2 "AI SaaS MVP"** build of Xavier's reinvention plan (see root `/Users/xavierperez/CLAUDE.md`).

---

## Linear structure

Workspace `thexap`, team **alwaysOnDashboard** (key `AOD`). Lightweight on purpose — this scaffold grows into the full playbook structure (milestones, Custom Views, SDK migration tooling) only when Phase 2 Build starts and issue count justifies it.

```
Initiative: alwaysOnDashboard v1
  └─ Project: Product definition        ← Phase 0 home (decisions + specs)
        └─ Issues (AOD-N)
```

- **Initiative — `alwaysOnDashboard v1`.** The version that ships to users. Gives `v1.1` / `v2` a stable place to grow into later.
- **Project — `Product definition`.** Holds all Phase 0 decision + spec issues. When Phase 0 closes, we add Build-phase projects keyed to deliverables (e.g. `Foundation`, `Integrations`, `Kiosk + Billing`, `Launch`).
- **Milestones / Custom Views / migration scripts:** deferred to Build. Not worth the overhead at ~10 issues.

### Issue types (labels, colon-prefix)

Exactly one `type:` per issue. Colon prefix is mandatory (playbook's single highest-cost mistake to fix later).

| Label | Meaning | Output when Done |
|---|---|---|
| `type:decision` | An open question / choice. Body is ADR-shaped. | Decision recorded in the issue (the ADR) + mirrored to vision doc |
| `type:spec` | A specification to author. | A markdown doc under `docs/specs/` |
| `type:tech-task` | Infra / setup / scaffolding (Phase 1+). | Code or config |
| `type:bug` | Defect against existing behavior (Phase 1+). | Fix |

`area:*` labels mark the functional surface (`area:backend`, `area:app`, `area:integrations`, `area:billing`, `area:kiosk`, `area:brand`, `area:product`). One or more per issue. `risk:*` and milestones get introduced at Build.

### Title prefixes

- `[Decision] …` — decision issues (already in use on AOD-1/AOD-2)
- `[Spec] …` — spec issues
- `[Tech] …` — tech tasks

---

## Linear tooling (MCP vs SDK)

Two ways we write to Linear, chosen by scale:

- **A few creates or edits:** the Linear MCP directly. Cheaper for small changes.
- **Bulk writes (restructure, build-backlog seed, dependency wiring):** the shared SDK migration tool with a JSON manifest. About 85 percent less context than MCP at scale, and the manifest is the committed audit trail.

The tool is team-agnostic and shared across Xavier's projects (the team comes from each manifest):

- Writes: `/Users/xavierperez/tools/linear-migration/migrate.mjs`
- Reads: `/Users/xavierperez/tools/linear-helpers/*.mjs` (pass `LINEAR_TEAM_KEY=AOD`)

It uses one `thexap` Personal API key that covers every team in the workspace. AOD manifests live in [`tools/linear/manifests/`](../tools/linear/manifests/) (committed); `*-output.json` is gitignored. Always surface a manifest for approval before running it (playbook section 11). Full how-and-where: [`tools/linear/README.md`](../tools/linear/README.md).

---

## ADR convention

A closed `type:decision` issue **is** the architecture decision record. No separate `docs/adr/` files unless a decision is weighty enough to warrant standalone narrative. Issue body template:

```markdown
## Context
Why this decision exists, what constraints bound it.

## Options
- (A) … — pros / cons
- (B) … — pros / cons

## Decision            ← filled when moving to Done
Chosen: (A). 

## Rationale
Why A over B/C.

## Consequences
What this commits us to; what it rules out; follow-up work it spawns.
```

When the issue closes, add the one-line outcome to `product-vision.md` "Decisions made" with the date and an `AOD-N` link.

---

## Traceability chain

```
Vision doc open question (product-vision.md "Open questions")
  → Decision issue (AOD-N, type:decision)
    → Decision recorded (ADR in the closed issue) + vision-doc one-liner
      → Spec issue (AOD-M, type:spec) → docs/specs/*.md
        → Tech task (AOD-K, type:tech-task) → code
```

When you are deep in Build wondering "why is auth structured this way?", you trace the code → the tech task → the spec → `AOD-2` → the option comparison that picked Supabase. The decision is grounded, not guessed.

---

## Conventions

- **Identifiers:** `AOD-N` (Linear). Stable; referenced from commits and specs.
- **Engineering docs** (this file, specs, commit messages): English.
- **Branch naming:** Linear's generated `xap5xap/aod-N-…` branches.
- **Doc locations:** vision + process at `docs/`; specs at `docs/specs/`; ADRs live in their Linear issues.
- **Linear writes:** batch them and surface the plan for approval before creating (playbook §11). No silent bulk creation.

---

## Seed backlog — vision doc → Linear (proposed)

The mapping from [`product-vision.md`](product-vision.md) into the AOD team. ✅ = exists, ➕ = to create on approval.

### Open questions → `type:decision`

| Issue | Title | Vision source | Status |
|---|---|---|---|
| AOD-1 ✅ | `[Decision]` Brand name | Open Q1 | Backlog |
| AOD-2 ✅ | `[Decision]` Backend + auth + database stack | Open Q2 | Backlog |
| AOD-3 ➕ | `[Decision]` Billing: RevenueCat + Free/Pro tier boundaries | Open Q3 | — |
| AOD-4 ➕ | `[Decision]` v1 widget set (what mounts on the wall day one) | Open Q4 | — |
| AOD-5 ➕ | `[Decision]` Privacy + token-security posture | Open Q5 | — |

### Decisions already made → closed `type:decision` records (audit trail)

| Issue | Title | Vision source |
|---|---|---|
| AOD-6 ➕ | `[Decision]` v1 service set: Linear, Calendar, Claude usage, Weather, Clock | Decisions made (2026-06-17) |
| AOD-7 ➕ | `[Decision]` Layout engine: free-form drag-and-resize | Decisions made (2026-06-17) |

(The "auth is required" decision is settled context folded into AOD-2; the open part is the vendor pick.)

### Specs to write → `type:spec`

| Issue | Title | Gated by |
|---|---|---|
| AOD-8 ➕ | `[Spec]` service → widget → layout registry contract | — |
| AOD-9 ➕ | `[Spec]` OAuth broker + per-user token storage & refresh | AOD-2 |
| AOD-10 ➕ | `[Spec]` Widget model: config, refresh interval, sizes, lifecycle | AOD-8 |
| AOD-11 ➕ | `[Spec]` Kiosk Mode behavior (screen-on, auto-refresh, day/night dim) | AOD-8 |
| AOD-12 ➕ | `[Spec]` Freemium entitlement model | AOD-3 |

---

## Current status

| Phase | Status | Next action |
|---|---|---|
| 0. Definition | 🔄 Current | Seed the AOD backlog, then work decisions one at a time |
| 1. Foundation | ⏭️ Next | Opens when the stack decision (AOD-2) + core specs land |
| 2. Build | ⏭️ TBD | — |
| 3. Launch | ⏭️ TBD | — |

First decision up: **AOD-2 (backend stack)** — Supabase is the leading recommendation and unblocks the most downstream work.

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-17 | Initial draft. Defined the 4-phase model, the decision-driven loop, the Linear structure (Initiative + Product definition project), the ADR-in-issue convention, and the seed backlog mapping from the vision doc. |
