# Batch 4 — gate issues + dependency graph (for review)

> Status: PROPOSAL for review, 2026-06-22. This is the playbook section 9 step-2 audit doc: the gate-issue list and dependency graph that the Batch 4 manifest will encode. Approve the shape here, then I build and surface the manifest.

## Principle

Batch 4 seeds **only the upstream gate issues** of the no-vibe-coding chain: `type:decision`, `type:spec`, `type:design`. It does **not** seed `type:tech-task` / `type:user-story` code issues. Code issues are created per feature only once that feature's decision -> spec -> design have closed, and they will carry the full section-5 enrichment (build references, UI-to-port, build discipline). Gate issues get a lighter body (goal + what to produce + dependencies).

Dependencies are wired with `blockedBy` so code is structurally blocked until its gates close. The done architecture corpus (decisions AOD-2..7, specs AOD-8..12) and the open Phase-0 amendments (AOD-13 Weather cred, AOD-14 Claude limits, AOD-15 on-demand refresh) stay in **Product definition** and are referenced as blockers; they do not move.

## Reconcile (2 update ops, run first in Batch 4)

| Op | Issue | Change |
|---|---|---|
| R1 | AOD-16 (UI-foundation decision) | Move to **Design System** project; labels -> `type:decision`, `area:app`, `area:design-system`. No milestone (it is a gate). |
| R2 | AOD-1 (brand name) | Priority -> **High**. Last open Phase-0 decision; gates DS-2 and LAU-3. Stays in Product definition. |

## Gate issues by project

Legend: type via title prefix (`[Decision]`/`[Spec]`/`[Design]`). Priority H = High, M = Medium. Milestone blank = milestone-less gate. blockedBy uses `AOD-N` for existing issues and local keys for new ones.

### Design System

| Key | Title | Labels | Milestone | Prio | blockedBy |
|---|---|---|---|---|---|
| DS-1 | `[Spec]` App navigation / information architecture | type:spec, area:app, area:design-system | DS-M1 | M | AOD-8 |
| DS-2 | `[Design]` Brand visual identity (wordmark, palette, voice) | type:design, area:brand, area:design-system | DS-M1 | H | AOD-1 |
| DS-3 | `[Design]` Design tokens (color, type, spacing, dark theme) | type:design, area:design-system | DS-M1 | H | DS-2, AOD-16 |
| DS-4 | `[Design]` Component library (cards, inputs, overlays, skeletons) | type:design, area:design-system | DS-M2 | H | DS-3, AOD-16 |
| DS-5 | `[Design]` Core navigation / IA screens | type:design, area:design-system, area:app | DS-M2 | M | DS-1, DS-4 |

(AOD-16, the UI-foundation decision, is the project's decision gate, placed here by R1.)

### Platform & App Shell

| Key | Title | Labels | Milestone | Prio | blockedBy |
|---|---|---|---|---|---|
| PS-1 | `[Spec]` Data model + Postgres schema (connections, tokens, entitlements, layouts, settings) | type:spec, area:backend | PS-M1 | H | AOD-9, AOD-12 |
| PS-2 | `[Spec]` Testing strategy + fixtures | type:spec, area:backend, area:app | PS-M1 | M | AOD-8, AOD-9 |
| STK-1 | `[Decision]` Library & dependency stack (frontend + backend; UI component base is AOD-16) | type:decision, area:app, area:backend | — | H | AOD-16 |
| PS-3 | `[Decision]` Onboarding model: guided vs free-form | type:decision, area:onboarding | — | H | — |
| PS-4 | `[Spec]` Onboarding + connect-service flow | type:spec, area:onboarding, area:app | PS-M3 | M | PS-3, AOD-9 |
| PS-5 | `[Design]` Dashboard + free-form layout editor | type:design, area:layout, area:app | PS-M2 | M | AOD-7, AOD-8, DS-4 |
| PS-6 | `[Design]` Settings + connections surface | type:design, area:app, area:onboarding | PS-M2 | M | AOD-9, DS-4 |
| PS-7 | `[Design]` Onboarding screens | type:design, area:onboarding | PS-M3 | M | PS-4, DS-4 |
| PS-8 | `[Design]` Linear widgets + shared lifecycle chrome (first slice) | type:design, area:integrations:linear, area:design-system | PS-M3 | H | AOD-10, DS-4, INT-1 |

### Integrations

| Key | Title | Labels | Milestone | Prio | blockedBy |
|---|---|---|---|---|---|
| INT-1 | `[Spec]` Linear integration (My Issues, Current Cycle) | type:spec, area:integrations:linear, area:backend | — | H | AOD-8, AOD-9, AOD-10 |
| INT-2 | `[Spec]` Google Calendar integration (Next Event, Today's Agenda) | type:spec, area:integrations:calendar, area:backend | I-M1 | M | AOD-8, AOD-9, AOD-10 |
| INT-3 | `[Spec]` Claude usage integration (Spend MTD, Daily Sparkline) | type:spec, area:integrations:claude, area:backend | I-M2 | M | AOD-8, AOD-9, AOD-10 |
| INT-4 | `[Spec]` Clock / Date widget | type:spec, area:integrations:clock, area:app | I-M3 | M | AOD-8, AOD-10 |
| INT-5 | `[Design]` Calendar + Weather widget visuals | type:design, area:integrations:calendar, area:design-system | I-M1 | M | PS-8, INT-2, AOD-13 |
| INT-6 | `[Design]` Claude usage widget visuals | type:design, area:integrations:claude, area:design-system | I-M2 | M | PS-8, INT-3 |
| INT-7 | `[Design]` Clock + on-demand refresh affordance | type:design, area:integrations:clock, area:design-system | I-M3 | M | PS-8, INT-4, AOD-15 |

INT-1 (Linear spec) is milestone-less because the Linear vertical slice lives in **Platform PS-M3** (cross-project gate). Weather has no separate spec issue: its credential handling is AOD-13 (Product definition), referenced by INT-5. AOD-14 (Claude limits personal-engine) stays in Product definition; its v1 implementation issue lands in Integrations I-M2 later as a non-blocking code issue.

### Billing & Entitlements

| Key | Title | Labels | Milestone | Prio | blockedBy |
|---|---|---|---|---|---|
| BIL-1 | `[Design]` Paywall, upsell, lock overlays, downgrade dialog | type:design, area:billing, area:design-system | B-M2 | M | AOD-12, DS-4 |

(Decision AOD-3 and spec AOD-12 are done; only the design gate is new. B-M1 entitlement-core code is gated by AOD-12 + PS-1 directly.)

### Kiosk Mode

| Key | Title | Labels | Milestone | Prio | blockedBy |
|---|---|---|---|---|---|
| KIO-1 | `[Design]` Kiosk wall presentation, day/night, exit affordance | type:design, area:kiosk, area:design-system | K-M1 | M | AOD-11, DS-3 |

(Decisions AOD-7/AOD-11 and spec AOD-11 are done; only the design gate is new.)

### Launch & Store Submission

| Key | Title | Labels | Milestone | Prio | blockedBy |
|---|---|---|---|---|---|
| LAU-1 | `[Decision]` Analytics tool (first-party aggregate, per AOD-5) | type:decision, area:product, area:backend | — | M | — |
| LAU-2 | `[Spec]` Observability / logging / audit (PII-safe) | type:spec, area:backend | — | M | AOD-9, LAU-1 |
| LAU-3 | `[Design]` Store listing assets (icon, screenshots, marketing) | type:design, area:brand | — | M | AOD-1, DS-2 |

**Totals:** 26 new gate issues (5 DS + 9 PS + 7 INT + 1 BIL + 1 KIO + 3 LAU) + 2 reconcile updates = **28 create/update ops**, plus 24 dependency-wiring ops = **52 ops total**.

## Dependency graph

Roots are the done corpus (AOD-8/9/10/11/12) and the two open decisions (AOD-1, AOD-16). Arrows mean "feeds / unblocks".

```
AOD-1 (brand) ─► DS-2 ─► DS-3 ─► DS-4 ─┬─► DS-5
AOD-16 (UI fdn) ─────────►─┘  │         ├─► PS-5, PS-6, PS-7
AOD-8 ─► DS-1 ─────────────────────────►─┘ (DS-5)         │
                                              │            │
DS-4 ─────────────────────────────────────────┴─► PS-8 ◄── INT-1
                                                   │
AOD-9, AOD-12 ─► PS-1                               │
AOD-8, AOD-9 ─► PS-2                                │
PS-3 (onboarding) ─► PS-4 ─► PS-7
AOD-16 (UI fdn) ─► STK-1 (rest of the library stack) ─► gates Foundation code                   │
AOD-7, AOD-8 ─► PS-5                                │
                                                   ▼
AOD-8/9/10 ─► INT-1 ─► PS-8 ─► INT-5, INT-6, INT-7
AOD-8/9/10 ─► INT-2 ─► INT-5 ◄─ AOD-13 (Weather)
AOD-8/9/10 ─► INT-3 ─► INT-6
AOD-8/10  ─► INT-4 ─► INT-7 ◄─ AOD-15 (on-demand refresh)

AOD-12, DS-4 ─► BIL-1
AOD-11, DS-3 ─► KIO-1
LAU-1 ─► LAU-2 ◄─ AOD-9
AOD-1, DS-2 ─► LAU-3
```

Critical path (longest chain): `AOD-1 -> DS-2 -> DS-3 -> DS-4 -> PS-8 -> INT-5/6/7`. The design system tokens/components are the spine; almost every design depends on DS-4. That argues for resolving AOD-1 and AOD-16 first (both are decisions you can take in dedicated sessions now).

## Notes / conventions

- **`from:*` and MoSCoW are deferred.** Provenance and MoSCoW carry signal on build stories, not on these gates. They get applied when we seed `type:user-story` / `type:tech-task` code issues per feature.
- **Decisions are milestone-less gates** (AOD-16, PS-3, LAU-1). Specs/designs are assigned to the milestone they are the deliverable for.
- **Cross-project deps are intentional** (playbook section 6): PS-8 blockedBy INT-1; LAU-3 blockedBy DS-2; etc.
- **`risk:*` is not set on gates** (specs/designs are low-implementation-risk). It gets applied to the code issues (per-provider OAuth, RevenueCat webhook, kiosk pinning, encryption).
- **Issue bodies** are authored in the manifest: decisions get the ADR template (Context/Options/Decision/Rationale/Consequences); specs get goal + must-cover + output path; designs get goal + screens/states to produce + handoff note.

## What I need from you

Approve the shape (project placement, the 25-op set, the dependency graph), or flag anything to consolidate, move, or add. On approval I build `tools/linear/manifests/batch-4-gate-issues.json` and surface it before running.
