# AOD Linear Restructuring Proposal

> Status: PROPOSAL, pending Xavier's approval. No Linear writes until approved. Authored 2026-06-21.
> Method: [Armonia Linear management playbook](../../../ClaudeProjects/armonia/Armonia/product/linear-management-playbook.md). Carries AOD from "Phase 0 tail" through Foundation, Build, and Launch.
> Governing principle: we do not vibe-code. Every feature flows decide -> spec -> design -> tech-task -> code, wired with dependencies. This restructure makes that chain legible in Linear (see memory `no-vibe-coding-spec-first`).

---

## 0. Current state (verified live, 2026-06-21)

| Thing | Reality |
|---|---|
| Workspace / team | `thexap` / **alwaysOnDashboard**, key `AOD` |
| Workflow states | Linear defaults (Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate). No custom states. Keep as-is. |
| Cycles | None configured, none active |
| Initiative | **alwaysOnDashboard v1** (Active), 1 project linked |
| Projects | **Product definition** only. No milestones. |
| Issues (16) | AOD-2,3,5,6,7 decisions (Done); AOD-8,9,10,11,12 specs (Done); AOD-4 v1 widget set (Done); AOD-1 brand (open); AOD-13,14,15 specs (open, from AOD-4); AOD-16 UI-foundation decision (open, created 2026-06-21) |
| Labels | `area:{product,brand,kiosk,billing,integrations,app,backend}` (7), `type:{decision,spec,tech-task,bug}` (4). Plus workspace noise: `Bug`/`Improvement`/`Feature` (Linear defaults) and `superseded-by-stack-pivot` (an Armonia leak; ignore for AOD) |

**Correction to the kickoff brief:** Phase 0 is not "almost done with AOD-4 and AOD-1 open." AOD-4 already closed and spawned three open spec amendments (AOD-13 Weather platform key, AOD-14 Claude-limits personal-engine widget, AOD-15 on-demand refresh affordance). So Phase 0 has **four open issues**: AOD-1, AOD-13, AOD-14, AOD-15. The restructure should let us finish those in place, then open the build.

---

## 1. Phase model and where design lives

**Keep the four-phase spine** (Definition -> Foundation -> Build -> Launch). It is sound and already documented in `engineering-process.md`. Phases stay internal vocabulary, never projects (playbook pitfall 12.1).

**Do not add a standalone global "Design" phase.** A "design everything, then build everything" phase is waterfall and contradicts dogfooding (Xavier is user zero, the kiosk drives the roadmap from daily use). Instead, design becomes first-class in **two** structural places:

1. **A cross-cutting `Design System` deliverable, front-loaded in Foundation.** The design tokens, component library, app information architecture, and core screen mockups are a hard prerequisite for all build UI, exactly like the backend is a prerequisite for all data. It earns its own project and runs in parallel with the backend/app-shell work (backend has little UI dependency, so the two tracks do not block each other until the first vertical slice).
2. **A per-feature `type:design` stage that gates every feature's code.** Each build deliverable gets a design issue (output: Figma screens + a handoff spec) that **blocks** its tech-task/user-story issues. This is the decide -> spec -> design -> code chain made literal at the issue level.

Net: design is a first-class work type and an early deliverable, but not a phase. The four-phase model stands; Foundation simply has three tracks (Backend platform, App shell, Design System).

**Brand (AOD-1) splits:**
- The **name** stays a Phase 0 decision (AOD-1). It is the last open decision and it gates the Design System wordmark and the store listing. Recommendation: raise its priority and resolve it next.
- The **visual identity** (logo, palette seed, voice) becomes the lead issue of the Design System project, a `type:design` issue blocked by AOD-1. You cannot define a color/type system without a brand direction, so identity must precede tokens.

---

## 2. Projects: deliverable-named, not phase-named

The playbook's central pitfall (12.1) is modeling phases as projects. A project named "Build" lies the moment the phase is renamed and forces milestones to carry all deliverable meaning. **Recommendation: deliverable-named projects, with milestones sequencing work inside each.**

### Proposed project set (7 active + 1 backlog)

| Project | Deliverable it names | Phase it serves |
|---|---|---|
| **Product definition** (existing) | The locked decision + spec corpus the build follows | Definition |
| **Design System** | Brand identity, tokens, component library, app IA, core screen mockups | Foundation |
| **Platform & App Shell** | Supabase backend (auth, OAuth broker, token model, proxy, entitlement webhook) + Expo app shell (router, registry runtime, widget host, layout engine) + first vertical slice | Foundation |
| **Integrations** | The v1 services on the registry seam (Linear, Calendar, Claude usage, Weather, Clock) and their widgets | Build |
| **Billing & Entitlements** | RevenueCat wiring, entitlement enforcement at the six seams, paywall and upsell UX | Build |
| **Kiosk Mode** | Kiosk runtime, wall-mount profile, day/night ambient driver, exit guard | Build |
| **Launch & Store Submission** | Store listings, privacy labels, screenshots, submission, subscription go-live | Launch |
| **v1.1 Backlog** | Deferred widgets/services (flights, finance, Spotify, GitHub), personal-engine pack, post-v1 ideas | (under v1.1 initiative) |

Note: "Foundation" and "Launch" are phase words, so the projects are named for their **deliverables** ("Platform & App Shell", "Launch & Store Submission") to stay clear of the pitfall. "Product definition" is kept because it names a real artifact corpus, not just a phase.

### Phase -> project mapping (the traceability)

```
Phase 0 Definition  ->  Product definition
Phase 1 Foundation  ->  Design System  +  Platform & App Shell
Phase 2 Build       ->  Integrations  +  Billing & Entitlements  +  Kiosk Mode
Phase 3 Launch      ->  Launch & Store Submission
(deferred)          ->  v1.1 Backlog
```

A phase is a group of projects. No `phase:*` label is needed; the project structure plus milestone names carry the sequencing. (If cross-project "everything in Build" filtering is ever wanted, a `phase:*` label can be added later; not now, to avoid label sprawl.)

### Tradeoff vs project-per-phase (rejected)

Project-per-phase (a "Foundation" project, a "Build" project, a "Launch" project) is simpler to set up and matches the mental model, but: it is the named pitfall; a single "Build" project with 50+ issues has no deliverable structure except overloaded milestones; and progress percentages stop being meaningful ("Build is 40% done" tells you nothing about which feature is ready). Deliverable projects cost more setup and cross-project dependency wiring (Integrations issues blocked by Platform issues), which the playbook explicitly treats as normal (sections 6 and 7). The cost is worth it.

---

## 3. Initiatives

- **Keep `alwaysOnDashboard v1`** as the active initiative (it exists, it is correct).
- **Add `alwaysOnDashboard v1.1`** as a placeholder initiative (playbook section 2: do not skip initiatives just because there is one version; it gives deferred work a stable home and keeps URLs stable). The `v1.1 Backlog` project links here.
- **Skip v2** for now. Nothing concrete exists for it; add it when a real v2 idea lands.

Link all seven active projects to `v1`; link `v1.1 Backlog` to `v1.1`.

---

## 4. Milestones per project

Per playbook section 7: under 15 issues and single-phase, skip milestones; 15 to 40, use 2 to 4; 40+, use 4 to 6. Default sequencing is hard, parallel is declared explicitly. Each milestone gets a one-paragraph "done when" set on the milestone in Linear.

### Product definition — no milestones
It is the project, and it is closing. The four open issues finish in place.

### Design System — 2 milestones (hard-sequenced)
- **DS-M1 Brand & Tokens.** Done when: brand identity (wordmark, palette, voice) is approved and the token set (color, type ramp, spacing, radii, dark theme) is defined in Figma and exportable to code.
- **DS-M2 Components & Core Screens.** Done when: the component library (cards, buttons, inputs, toggles, drawers, skeletons, badges, lock overlays) exists, the app IA/navigation map is set, and every cross-cutting surface (settings, widget picker, dashboard editor, onboarding, kiosk, paywall) has an approved mockup. Blocked by DS-M1.

### Platform & App Shell — 3 milestones (hard-sequenced)
- **PS-M1 Backend platform.** Done when: Supabase project, schema (connections, oauth_transactions, entitlements, layouts, instances) under RLS, and the OAuth broker edge functions exist; a test user completes a server-side OAuth round-trip and a token is stored encrypted in Vault and refreshed.
- **PS-M2 App shell.** Done when: the Expo + expo-router scaffold renders an empty dashboard, the client-side registry runtime resolves a stub widget through the widget host state machine, the free-form layout engine persists position and size, and Settings opens. Blocked by PS-M1.
- **PS-M3 First vertical slice (Linear "My Issues").** Done when: the Phase 1 gate is met. A user signs in, connects Linear via OAuth, adds "My Issues", and watches it auto-refresh on the Fire HD 8. Blocked by PS-M2 and Design System DS-M1.

### Integrations — 3 milestones (parallel after Platform, numbered for priority)
Each service is independent on the registry seam, so these can run concurrently once Platform & App Shell lands. Linear is already delivered as the Foundation worked example, so it is not repeated here.
- **I-M1 Calendar & Weather.** Done when: Google Calendar (OAuth) and Weather (platform key, AOD-13) connect and their v1 widgets (Next Event, Today's Agenda, Current + Forecast) render and refresh.
- **I-M2 Claude usage.** Done when: Spend MTD and Daily Spend Sparkline render from the Anthropic Admin API through the proxy.
- **I-M3 Clock & widget polish.** Done when: Clock + Date (no-auth) ships and the on-demand refresh affordance (AOD-15) plus all lifecycle states (fresh, stale, error, needs-config, disconnected) are complete across the eight v1 widgets.

### Billing & Entitlements — 2 milestones (hard-sequenced)
- **B-M1 Entitlement core.** Done when: the entitlements table, server tier resolver, and the secured idempotent RevenueCat webhook exist; a Pro entitlement flips server-side via webhook and the six enforcement seams (connect, add-widget, create-dashboard, refresh-floor, kiosk, theme) enforce correctly; a reconciliation pull covers missed webhooks.
- **B-M2 Paywall & upsell.** Done when: the paywall (monthly/annual, 7-day trial), lock overlays, per-trigger upsell prompts, and the non-destructive downgrade/freeze dialog are built; a free user hitting any gate sees the right prompt and can complete a sandbox trial-to-Pro purchase. Blocked by B-M1.

### Kiosk Mode — 1 milestone
- **K-M1 Kiosk runtime.** Done when: kiosk runs unattended on the Fire HD 8 for 24h, with keep-awake, kiosk cadence profile, wall-mount profile (dark, larger type, high contrast), day/night dimming via the ambient driver, and exit gesture plus PIN, all gated to Pro via `canUseKiosk` (AOD-12). Blocked by Platform & App Shell, Billing B-M1, and Design System.

### Launch & Store Submission — no milestones
Per playbook 12.8, late-phase launch issues are a thin sequenced layer with no natural milestone; wire them as a dependency chain instead. Done when: published on both stores with working Free and Pro tiers.

### v1.1 Backlog — no milestones
Deferred grab-bag.

---

## 5. What "Product definition" becomes

**Keep it, permanently, as the Phase 0 deliverable: the decision + spec corpus.** It is a real deliverable ("the locked decisions and specs the build follows"), not just a phase label, so it survives the no-phase-as-project rule. It also becomes the traceability root: every build issue's "Spec source" and `blockedBy` points back into it. Do not rename or fold it (playbook 12.9: keep closed decision records in Linear, not frozen markdown).

**Finish Phase 0 in place first.** Resolve AOD-1 (brand name) and author AOD-13, AOD-14, AOD-15 inside Product definition before declaring Phase 0 closed. These are Definition-phase spec/decision work and belong with the corpus.

One nuance on AOD-14 (Claude-limits personal-engine widget), kept in v1 per Xavier's call: write the **spec** now in Product definition (it documents the AOD-4 decision and sizes the Claude Code usage bridge), and place its **implementation** in v1 under the Integrations project, labeled as a personal-engine widget (MoSCoW `could`/`should`, not part of the public store catalog, not blocking launch). It stays out of the *standard* multi-tenant set, with a graduate-to-standard trigger if Anthropic ships a subscription-usage API. If the bridge proves heavy once specced, we revisit deferring.

**Brand home:** name decision -> Product definition (AOD-1); visual identity -> Design System (new `type:design` issue blocked by AOD-1). See section 1.

**Spec placement going forward:** the locked cross-cutting architecture specs (AOD-8..12 and the amendments AOD-13/14/15) stay in Product definition as the permanent foundation. **New feature-specific** decisions/specs/designs live in their **feature project** so each project carries its own visible decide -> spec -> design -> code chain (great for the per-project progress view and for legibility). This gives a stable architectural root plus per-feature traceability.

---

## 6. Label taxonomy

Today's colon-prefixed `area:*` and `type:*` are correct and stay. Extend toward the fuller playbook set **at the start of Build** (created as part of the migration batch, not now). Colon convention is mandatory (playbook 12.1, the single highest-cost mistake).

### `type:*` (exactly one per issue) — AOD's spec-first adaptation
Keep: `type:decision`, `type:spec`, `type:tech-task`, `type:bug`.
Add: `type:design` (output: Figma + handoff), `type:user-story`, `type:spike`, `type:migration`, `type:validation-followup`.
`type:decision`, `type:spec`, and `type:design` are AOD additions beyond the playbook's standard set. They are the no-vibe-coding chain made legible; keep them.

### `area:*` (one or more) — expanded for build surfaces
Keep the 7. Add:
- `area:design-system` (tokens, components, IA, mockups)
- `area:onboarding` (first-run connect flow)
- `area:layout` (the free-form dashboard editor, distinct from general `area:app`)
- `area:auth` (user accounts / sign-in, distinct from the broker in `area:backend`)
- Per-integration (nested form, locked): `area:integrations:linear`, `area:integrations:calendar`, `area:integrations:claude`, `area:integrations:weather`, `area:integrations:clock`

### `risk:*` (exactly one when it matters; `risk:low` is the implicit default)
Add `risk:low`, `risk:medium`, `risk:high`. Tag the genuinely risky build work: per-provider OAuth quirks, RevenueCat webhook correctness, kiosk screen-pinning platform variance, token encryption, Admin-key handling.

### MoSCoW (no prefix, on `type:user-story` only)
Add `must`, `should`, `could`, `wont` for v1 scope conversations.

### `from:*` (provenance) — adapted to a solo dogfood product
There is no external discovery phase. Use `from:vision` (originated in product-vision.md), `from:dogfood` (surfaced from Xavier's daily kiosk use, AOD's equivalent of `from:validation`), `from:build` (surfaced during engineering), `from:store-review` (surfaced during App Store/Play review).

### `bucket:*` — skip
The playbook's optional architecture-decision-traceability group is unnecessary here: AOD already has its decisions and specs as first-class issues (AOD-2..15) with stable IDs. Reference them directly in `blockedBy` and "Spec source" instead of mirroring them into bucket labels.

### Cleanup
`superseded-by-stack-pivot` is an Armonia workspace label (it references Armonia's Bucket 0 re-lock); it is not AOD's and should never be applied here. `Bug`/`Improvement`/`Feature` are Linear's default workspace labels; AOD uses its own `type:*` set, so leave them unused (do not delete, they may be shared workspace-wide).

---

## 7. The no-vibe-coding chain per build deliverable

The chain is **decide (`type:decision`) -> spec (`type:spec`) -> design (`type:design`) -> tech-task/user-story -> code**, wired with `blockedBy` so code is structurally impossible to start before its decision, spec, and design close.

What is DONE (the architectural foundation): decisions AOD-2..7 and specs AOD-8..12. These cover the core seams. What is MISSING before any code is the per-feature and cross-cutting upstream of the chain. Below, per deliverable, with the gaps called out.

| Deliverable | Decision | Spec | Design | Code |
|---|---|---|---|---|
| Design System | NEW: UI-foundation (custom vs RN component lib); AOD-1 brand | NEW: app IA spec | NEW: tokens, components, IA screens | component library |
| Platform & App Shell | done (AOD-2) | done (AOD-8, AOD-9); NEW: data-model schema, testing strategy | app-shell IA design | backend + shell |
| Onboarding (cross-cutting) | NEW: onboarding model (guided vs free-form) | NEW: onboarding/connect-flow spec | NEW: onboarding screens | onboarding code |
| Integrations (per service) | done (AOD-6) | NEW: per-integration specs (Linear, Calendar, Claude, Clock; Weather = AOD-13) | NEW: per-widget designs + lifecycle states | service + widget code |
| Billing & Entitlements | done (AOD-3) | done (AOD-12) | NEW: paywall, lock overlays, upsell, downgrade | billing code |
| Kiosk Mode | done (AOD-7, AOD-11) | done (AOD-11); finish AOD-15 | NEW: wall presentation, day/night, exit affordance | kiosk runtime |
| Launch | NEW (optional): analytics tool | NEW (light): observability/logging | NEW: store listing assets | submission |

### The missing-artifact punch list (the issues to seed)

These are the upstream gate issues the restructure should create. Code issues are NOT created yet; they are added per feature only when that feature's decision/spec/design close. That is the discipline.

**New decisions (`type:decision`):**
- AOD-1 brand name (exists, open) — bump priority.
- UI foundation: custom components vs a React Native component-library base (Tamagui, gluestack, etc.) plus styling approach. Gates Design System.
- Onboarding model: guided (pick widget -> connect service -> place) vs free-form (connect first, compose later). Gates onboarding spec.
- Analytics tool (optional, pre-Launch): which first-party aggregate analytics, per the AOD-5 "no third-party trackers" commitment.

**New specs (`type:spec`):**
- App navigation / information architecture.
- Onboarding + connect-service flow (OAuth deep-link/callback UX, API-key entry, reconnect prompts).
- Consolidated data model / Postgres schema (connections, oauth_transactions, entitlements, layouts, instances, settings) + migrations + derived TS types.
- Settings / preferences schema (refresh overrides, themes, kiosk schedule) — may fold into the data-model spec.
- Per-integration specs: Linear, Google Calendar, Claude usage, Clock (Weather is AOD-13).
- Testing strategy + fixtures (Foundation-era).
- Observability / logging / audit, PII-safe (light, pre-Launch).
- Finish the open Phase-0 specs: AOD-13, AOD-14, AOD-15.

**New designs (`type:design`, output Figma + handoff):**
- Tokens + brand identity application; component library; app IA/nav screens; onboarding flow; dashboard editor (place/resize); per-widget visuals for all 8 widgets incl. lifecycle states; kiosk wall presentation + day/night + exit; paywall + lock overlays + upsell + downgrade; settings screens; store listing assets.

---

## 8. Tooling: adopt the SDK migration toolkit now

> Status (2026-06-21): DONE, with one change from the plan below. The toolkit was MOVED (not copied) from the Armonia repo to a shared, team-agnostic location: `/Users/xavierperez/tools/linear-migration` and `/Users/xavierperez/tools/linear-helpers`. It reuses the existing `thexap` Personal API key (it covers every team in the workspace, so no fresh key). `migrate.mjs` now loads its `.env` from its own dir, so it runs by absolute path from any CWD. AOD manifests live in `tools/linear/manifests/` (committed; `*-output.json` gitignored). Verified with a read-only AOD call. Armonia's references are being updated in a separate session, and its manifests stayed in the Armonia repo. See [`../tools/linear/README.md`](../../tools/linear/README.md). The "copy per project / fresh key" details below are superseded by this shared install.

**Recommendation: adopt `tools/linear-migration` + `tools/linear-helpers` (copied from Armonia) as part of this restructure, before the writes start.**

Reasons:
1. This restructure is itself a 50+ operation migration (1 initiative, ~6 projects, ~12 milestones, ~20 labels, reconcile 15 issues, seed the upstream gate issues, wire dependencies, enrich). That is exactly the "bulk write at scale" case the SDK is for (playbook section 1, section 10: MCP costs ~85% more context per call and is not batch-auditable).
2. The playbook's entire migration workflow (section 9) is built on the manifest + `migrate.mjs` pattern: the JSON manifest is the audit trail, committed to git, surfaced for approval before running. That honors your "batch Linear writes and surface before creating" convention far better than a sequence of MCP calls.
3. Build will exceed 50 issues regardless, so the setup amortizes immediately.

Setup (playbook section 13, ~30 to 60 min, one-time): copy both tool dirs, generate a fresh Linear Personal API key into a new `.env` (Settings -> Account -> Security & access -> Personal API keys), `npm install` in both, swap the hardcoded team key to `AOD`, smoke-test with one `TEST: ... delete me` issue, then delete it.

Keep MCP for ad-hoc reads during brainstorming and for the read-only verification audit. Copy the read helpers too (cheap) since they will power future PM skills.

The one thing this needs from you: a Personal API key. The SDK cannot reliably create initiatives/cycles/custom-states on all plan tiers, but the v1 initiative already exists and we are keeping default states, so that limitation does not bite.

If you would rather not set up the SDK yet, the fallback is: do the structural restructure (projects/milestones/labels + reconcile the 15 existing issues) via a single surfaced MCP batch now, and adopt the SDK when we seed the larger Build backlog. I recommend SDK-now; the manifest-as-audit-trail is the better fit for the spec-first discipline.

---

## 9. Custom Views and cycles

### Custom Views
Set up at the **start of Build** (once milestones and the build labels exist), not now. Of the 10 essential views, the ones that earn their keep at AOD's stage:
- **By Milestone** (roadmap across all projects) — the primary orchestration view.
- **Blocked** (`state IN (unstarted, started) AND hasBlockedByRelations`) — valuable once dependencies are wired.
- **Tech-task firehose** and **User-stories firehose**.
- **High risk** (`risk:high`).
- **Active project progress** (per active deliverable).
- **Foundation focus** (filter the Platform & App Shell + Design System work during Phase 1).

Plus two AOD-specific views that reinforce the discipline:
- **Decisions & Specs corpus** (`type:decision OR type:spec`) — the Phase 0 ADR/spec audit trail.
- **Design queue** (`type:design`, grouped by project) — makes the design stage visible so it cannot be skipped.

Skip "Current cycle" until cycles are on, and skip the UAT view until Launch. SDK view-creation quirks to respect (playbook section 8): no emoji in the `icon` field (put it in the name), `hasBlockedByRelations` is the blocked filter key, and `groupBy`/`orderBy` need a second `ViewPreferences` call.

### Cycles
**Do not start cycles for the Phase 0 tail.** Finish AOD-1/13/14/15 in the existing one-issue-at-a-time decision loop.

**Start weekly cycles when Foundation code work begins** (1-week, Monday start, matching the Mon-Fri routine). That is the first point where "what am I building this week" matters and parallel streams exist. This matches `engineering-process.md` ("milestones / views / scripts deferred to Build") and the playbook's operational rhythm.

---

## 10. Migration plan (executed only on approval, batched and surfaced)

Per playbook section 9, run as ordered batches. Each batch is a committed manifest (the audit trail); each is surfaced for explicit approval before running; `-output.json` is gitignored.

- **Batch 0 — manual UI setup.** Generate the Personal API key. Confirm default states (done, keep). Cycles stay off for now. (Initiative v1 already exists.)
- **Batch 1 — labels.** Create the new `type:*`, `area:*`, `risk:*`, `from:*`, and MoSCoW labels (section 6). Audit colon convention; confirm no hyphen duplicates.
- **Batch 2 — structure.** Create initiative `alwaysOnDashboard v1.1`. Create the 6 new projects + `v1.1 Backlog`. Link projects to initiatives. Create milestones (section 4) with their one-paragraph done-when descriptions.
- **Batch 3 — reconcile existing 15 issues.** They stay in Product definition (the Phase 0 corpus). Light touch only: optionally back-tag `from:vision`; ensure AOD-1/13/14/15 remain here to close Phase 0. No project moves. (Low risk; existing issues are barely touched.)
- **Batch 4 — seed the upstream gate issues.** Create the new decision/spec/design issues from section 7's punch list, each assigned to its feature project + milestone + labels, with the section 5 enrichment blocks and section 6 dependency wiring. Split per project (4a Design System, 4b Platform, 4c Integrations, 4d Billing, 4e Kiosk, 4f Launch) so each is independently reviewable. Code issues are NOT seeded; they come per feature as gates close.
- **Batch 5 — Custom Views** (at Build start) and **verify** (playbook section 9 step 5): independent read-only audit, reconcile counts, cleanup punch list, confirm no `TEST:` leftovers.

### Dependency wiring (high level)
- Phase 1+ work `blockedBy` the relevant Phase-0 specs: Platform by AOD-8/9; Billing by AOD-12; Kiosk by AOD-11; Integrations by AOD-8/10 + per-integration specs.
- Design System identity issue `blockedBy` AOD-1.
- Platform first slice (PS-M3) `blockedBy` Design System DS-M1 (tokens).
- Integrations `blockedBy` Platform & App Shell (registry runtime + proxy).
- Billing enforcement `blockedBy` Platform (proxy fetch-floor seam).
- Kiosk `blockedBy` Platform + Billing B-M1 (canUseKiosk) + Design System.
- Launch `blockedBy` feature-complete Build + AOD-1 (listing) + AOD-5 (privacy labels, already done).
- Within the chain, each feature's tech-task/user-story `blockedBy` its `type:design`, which is `blockedBy` its `type:spec`, which is `blockedBy` its `type:decision`.

---

## 11. Decisions locked (2026-06-21)

Resolved with Xavier; the sections above reflect these.

1. **Tooling: SDK adopted; the toolkit was MOVED to a shared location** (`/Users/xavierperez/tools`), key reused. See section 8.
2. **Kiosk and Billing: separate projects.** They stay distinct deliverables (Kiosk Mode, Billing & Entitlements).
3. **Integration labels: nested** `area:integrations:<service>`.
4. **Batch 4 seeds gate issues only** (decision/spec/design). Code issues are added per feature as gates close.
5. **UI-foundation decision created now** as [AOD-16](https://linear.app/thexap/issue/AOD-16) (High), to resolve in a separate session. The **onboarding-model** decision is seeded as a `type:decision` gate issue in Batch 4 (Platform & App Shell).
6. **AOD-14 (Claude limits) is in v1** as a personal-engine widget: spec now, implementation in the Integrations project, non-blocking, not in the public catalog. See section 5.
7. **New feature-specific specs live in their feature project**; the locked architecture corpus (AOD-8..12 plus amendments) stays in Product definition.

### Still genuinely open (not blocking Batch 1)
- The **onboarding-model** decision content (guided vs free-form) and the **analytics tool** choice. Both become gate issues; resolve in their own sessions.
- **Brand name (AOD-1)** remains the last open Phase-0 decision; bump its priority.
```