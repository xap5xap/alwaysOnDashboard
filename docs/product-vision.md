# alwaysOnDashboard — Product Vision

> Status: brainstorm / vision draft. Last updated 2026-06-18. This is a living document. The work to resolve everything below now lives in **Linear** (team `AOD`, project "Product definition") and follows [`engineering-process.md`](engineering-process.md). Decisions and open questions are cross-linked to their `AOD-N` issues; nothing is locked until its issue closes.

## One-line pitch

A personalized, always-on ambient dashboard. Connect the services you already use (Linear, Google Calendar, Claude, flights, music, weather...), choose the cards you care about, arrange them however you like, and glance at your whole world at once.

## What it is

A mobile app (iOS + Android, published to the App Store and Google Play) that turns any phone or tablet into a personal command center. Users connect "services" with their own credentials, then compose a dashboard from the widgets those services publish. The dashboard auto-refreshes and is meant to be *glanced at*, not deeply interacted with.

The original spark was Xavier wanting an always-on wall-mounted dashboard on a Fire HD 8 tablet showing his Linear issues and Claude usage. That personal use case becomes a flagship product feature: **Kiosk Mode**.

## Who it is for

- **Primary:** individuals who live across many tools and want one calm surface that aggregates them. Developers, founders, makers, productivity enthusiasts.
- **Kiosk users:** people who mount an old/cheap tablet on a wall or desk as an ambient display (the MagicMirror / Smart Display crowd, but no DIY hardware build required).
- **Xavier (user zero):** dogfoods the product on a Fire HD 8 in kiosk mode, driving the roadmap from real daily use.

## Positioning

Think MagicMirror or a Smart Display, but: no Raspberry Pi build, no YAML config, no soldering. Install an app, connect your services, done. The differentiator is **deep personalization across many real services** plus a true **always-on kiosk mode**, packaged as a polished consumer app.

## Core architecture concept: services → widgets → layout

This three-layer model is the entire product. Get it right and adding a new integration later is just registering a service and its widgets, no rework.

1. **Service** — something a user connects once with credentials, managed in Settings. Examples: Google Calendar, Linear, Claude (Anthropic), Weather, Spotify, Flights. Each service declares: how it authenticates (OAuth vs API key), and which widgets it publishes.
2. **Widget (card)** — a single glanceable unit published by a service. Linear publishes "My issues", "Current cycle", "Blocked". A widget declares: its title, refresh interval, supported sizes, and any per-instance config (e.g. *which* Linear project).
3. **Dashboard (layout)** — a grid of widget instances the user arranges. Only widgets whose parent service is connected can be added. Disconnect a service and its widgets disappear from the dashboard.

Design rule: a user should be able to add a brand-new integration to the product without the dashboard or layout code changing. The service registry is the seam.

## Service catalog

### Launch candidates (v1)

- **Linear** — issues filtered by team/project, current cycle, blocked, due today.
- **Google Calendar** — next event, today's agenda.
- **Claude / Anthropic usage** — spend month-to-date, tokens by model, daily trend. (Note: needs an Anthropic **Admin** key for the org usage/cost reports.)
- **Weather** — current conditions + today's forecast for the user's location.
- **Clock / Date** — big ambient time + date (always available, no connection needed).

### Strong follow-ups

- **Spotify** — now playing.
- **Flights (ADS-B)** — aircraft overhead, interesting flight of the day, local airport board. (Note: consumer FlightRadar24 subscriptions usually do NOT include API access; free alternatives exist: OpenSky Network, adsb.lol, airplanes.live.)
- **GitHub** — open PRs, contribution streak.
- **Gmail** — unread / important count.
- **Finance** — stock or crypto tickers.
- **News** — Hacker News top, or an AI-news feed.

### "Personal engine" widgets (Xavier's own, possible premium/niche pack)

These came out of brainstorming Xavier's own use and show how far personalization can go:

- **"Right now" routine card** — surfaces the current block from a user's daily schedule ("4:15pm — dog break; next: focus block 8pm").
- **Goal countdown** — days until a target date / exam / launch, progress toward a personal mission.
- **Flashcard / quiz** — pulls a study question from the user's own notes for ambient spaced repetition.

## Widget catalog (per service)

- **Linear:** My issues (by project), Current cycle ring, Blocked, Due today, Recently completed.
- **Claude usage:** Spend MTD vs last month, Tokens by model, Daily spend sparkline, Projected month burn rate.
- **Google Calendar:** Next event, Today's agenda.
- **Weather:** Current + forecast.
- **Spotify:** Now playing.
- **Flights:** Overhead now, Airport arrivals/departures, Interesting flight of the day.
- **Ambient:** Clock + date, day/night auto-dimming.

## Kiosk Mode (flagship feature)

For always-on wall/desk displays:

- Keep the screen awake; prevent sleep.
- Auto-refresh all widgets on intervals with no user interaction.
- Wall-mount layout (larger type, higher contrast, dark theme).
- Day/night auto-dimming so it isn't blasting light at night.
- Optional screen-pinning so the device stays in the app.

On the Fire HD 8 specifically: the app runs as a normal Android app; Kiosk Mode handles screen-on and auto-refresh. (Alternative for power users: third-party kiosk launchers like Fully Kiosk Browser, but the goal is for our app to not need them.)

## Monetization

> **Locked** in [AOD-3](https://linear.app/thexap/issue/AOD-3) (2026-06-18). Freemium subscription; the tier boundaries and price below are the decided v1 values. Enforcement (entitlement to feature mapping, server-authoritative vs client-side checks) is specified in [AOD-12](https://linear.app/thexap/issue/AOD-12).

- **Model:** freemium subscription (not one-time): every connected service implies ongoing backend + API cost, and the biggest cost driver, continuous live and kiosk refresh, sits in Pro.
- **Free tier:** 2 connected services (Clock is always free and does not count toward the limit), the standard widgets of those services, 1 dashboard, and a 15-minute foreground refresh floor.
- **Pro:** $5.99/mo or $39.99/yr (about 44% off, ~$3.33/mo), with a 7-day free trial. Unlimited connected services, all widgets, Kiosk Mode, multiple dashboards/layouts, themes, live refresh (down to per-widget floors, e.g. 60s), and premium widget packs (flights, finance).
- **Kiosk Mode is Pro-only**, sold with the free trial so users can experience it before paying. It is the flagship feature and the single biggest per-user cost driver, so it anchors Pro.
- **Billing:** RevenueCat (free up to $2,500 monthly tracked revenue, then 1%); one SDK over App Store + Play subscriptions, entitlements, and webhooks. Store commission is about 15% for a solo dev under $1M/yr (Apple Small Business Program; Google Play subscription rate), so plan on keeping ~85% of gross.

## Tech direction (proposed, not locked)

- **App:** Expo (React Native), TypeScript, expo-router. iOS + Android from one codebase. Builds + submission via EAS.
- **UI components:** **Locked: Option C** (see [AOD-16](https://linear.app/thexap/issue/AOD-16)): a token/theme styling engine (lead Tamagui core, alternative react-native-unistyles v3) with our own components (hand-rolled plus selective copy-in), not a full styled component kit and not pure hand-roll. The final engine package and an on-device Fire HD 8 spike are deferred to [AOD-25](https://linear.app/thexap/issue/AOD-25).
- **Backend + auth + database:** **Locked: Supabase** (see [AOD-2](https://linear.app/thexap/issue/AOD-2)). One platform: Supabase Auth for user accounts; Edge Functions for OAuth token exchange + refresh, API proxying, and billing webhooks; Postgres + Row-Level Security for per-user config (connected services, layouts, encrypted tokens); Vault for encryption at rest. Chosen over Clerk + Cloudflare Workers + Neon to minimize vendors and cost for a solo MVP.
- **Secrets:** OAuth tokens encrypted at rest server-side and refreshed server-side; on-device secure storage (expo-secure-store) only for cache/session.
- **Billing:** RevenueCat.

Why a backend at all: OAuth client secrets cannot ship inside a distributed app, and refresh tokens must be stored and rotated somewhere trusted. This is the single biggest scope jump from "personal app" to "product."

## Connection to the reinvention plan

This is a strong candidate for the **Phase 2 "AI SaaS MVP"** build. It exercises exactly the AI-Solutions-Architect skill set: multi-tenant backend, OAuth integrations, secure secret handling, billing, and a polished cross-platform client. It also dogfoods on a real device daily, which keeps the roadmap honest.

## Decisions made

- **v1 service set:** Linear, Google Calendar, Claude usage, Weather, Clock. (2026-06-17) — [AOD-6](https://linear.app/thexap/issue/AOD-6)
- **Layout engine:** free-form drag-and-resize, not a fixed grid. Customization is a core product value. (2026-06-17) — [AOD-7](https://linear.app/thexap/issue/AOD-7)
- **Auth is required** (per-user token storage, billing entitlements, multi-device sync). Clerk is NOT a requirement, it was an assumption. **Vendor locked: Supabase**, resolved in [AOD-2](https://linear.app/thexap/issue/AOD-2). (2026-06-17, vendor locked 2026-06-18)
- **Backend + auth + database stack:** Supabase, one platform (Postgres + Row-Level Security, Auth, Edge Functions, Vault) chosen over Clerk + Cloudflare Workers + Neon. $0 on the free tier through the build, about $25/mo Pro at launch; fewest vendors and lowest cost for a solo MVP. Pricing verified on supabase.com. Unblocks the OAuth broker spec ([AOD-9](https://linear.app/thexap/issue/AOD-9)). (2026-06-18) — [AOD-2](https://linear.app/thexap/issue/AOD-2)
- **Billing + Free/Pro tiers:** RevenueCat (free up to $2,500 monthly tracked revenue, then 1%). Free = 2 connected services (Clock always free) + 1 dashboard + 15-minute refresh floor; Pro = $5.99/mo or $39.99/yr (7-day trial) for unlimited services, all widgets, Kiosk Mode, multiple dashboards, themes, live refresh, and premium packs. Kiosk Mode is Pro-only. Store commission ~15% (solo dev under $1M/yr; Apple Small Business Program + Google Play subscription rate); unit economics clear with about 5 monthly subs against Supabase's ~$25/mo. Resolves Open Q3; unblocks the entitlement model spec ([AOD-12](https://linear.app/thexap/issue/AOD-12)). Pricing verified 2026-06-18 (revenuecat.com, developer.apple.com). (2026-06-18) — [AOD-3](https://linear.app/thexap/issue/AOD-3)
- **Privacy + token-security posture:** third-party tokens are encrypted at rest server-side in Supabase Vault (libsodium AEAD, root key outside the DB) and refreshed server-side, never on the device; the proxy cache holds normalized data only, encrypted, per-user, TTL ≤ 900s, purged on disconnect and account deletion; explicit disconnect hard-deletes (revoke + purge Vault + cache + widgets) while a billing lapse does not (AOD-12 freeze); in-app + web account deletion purges everything (connections, Vault secrets, layouts, cache, entitlement row, RevenueCat customer, auth user). Public commitments, each mapped to a backing control: never sell data, never train models on it, tokens never leave the encrypted store, disconnect wipes immediately, only connected services are called, and no third-party trackers (first-party aggregate analytics only). Closes [AOD-9](https://linear.app/thexap/issue/AOD-9) §10.1 (hard delete) and resolves Open Q5. App-store/legal facts verified 2026-06-19 (Apple 5.1.1(v) + App Privacy, Google Data safety, GDPR/CCPA). (2026-06-19) — [AOD-5](https://linear.app/thexap/issue/AOD-5)
- **v1 widget set:** eight standard widgets, Linear (My Issues, Current Cycle), Claude usage (Spend MTD, Daily Spend Sparkline), Google Calendar (Next Event, Today's Agenda), Weather (Current + Forecast), and Clock + Date, plus a generic on-demand refresh affordance. Weather uses a single platform-owned provider key with user-supplied location, not a per-user API key (closes [AOD-9](https://linear.app/thexap/issue/AOD-9) §11; leading candidate Open-Meteo). All v1 widgets are standard; no premium pack in v1, since flights/finance arrive with later services (closes [AOD-12](https://linear.app/thexap/issue/AOD-12) §11). First vertical slice: Linear "My Issues" (OAuth + remote-options + full lifecycle, the AOD-8/AOD-10 worked example). The Claude.ai session/weekly "usage limits" view has no third-party API, so it is recorded as a personal-engine widget fed by a Claude Code bridge, out of the standard v1 set with a graduate-to-standard trigger if Anthropic ships a subscription-usage API. Resolves Open Q4. Weather provider tiers and Claude usage surfaces verified 2026-06-19 (open-meteo.com, apiscout.dev, code.claude.com, platform.claude.com). (2026-06-19) — [AOD-4](https://linear.app/thexap/issue/AOD-4)
- **UI foundation:** Option C, a token/theme styling engine plus our own components (hand-rolled and selective copy-in of unstyled primitives), not a full styled component kit and not pure hand-roll. Lead engine Tamagui (core), alternative react-native-unistyles v3. Chosen because the [AOD-8](https://linear.app/thexap/issue/AOD-8) render contract makes the ambient surface (dashboard, widgets, kiosk) bespoke while a component kit only helps the minority CRUD surface (settings, forms, onboarding, paywall), and the always-on dark, day/night dim, kiosk high-contrast, and Pro theming on a low-end Fire HD 8 is a styling-engine concern rather than a component-kit one. The final engine package and a throwaway Fire HD 8 spike are deferred to [AOD-25](https://linear.app/thexap/issue/AOD-25). Unblocks design tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19)) and the component library ([AOD-20](https://linear.app/thexap/issue/AOD-20)). (2026-06-22) — [AOD-16](https://linear.app/thexap/issue/AOD-16)
- **Brand name:** Vela. The product goes to market as Vela; "alwaysOnDashboard" stays the internal codename only. Chosen over Tessera (runner-up: best literal "mosaic tile" concept, but a messier trademark picture, a Nasdaq semiconductor holder, a Japanese software firm, and an existing Tessera News dashboard app) and a coined option (Tessari). Vela best fits the "calm ambient surface" pitch (sail, star, candle; Spanish *velar* = to keep vigil / stay awake, on-concept for an always-on display), is short and globally easy to say and spell, is not boxed into "dashboard," and has the cleanest trademark of the real words (its software namesakes are B2B, not consumer apps). Every real-word candidate was already taken on the bare and qualified .com/.app, so the domain will be a qualified one (velaglance.com is registerable now); domain registration and App Store/Play name reservation are Xavier's follow-up actions, and a formal trademark clearance in the software class is warranted before launch. Closes the last open Phase 0 decision; unblocks brand visual identity ([AOD-18](https://linear.app/thexap/issue/AOD-18)) and feeds store listing assets ([AOD-42](https://linear.app/thexap/issue/AOD-42)). Availability signals checked 2026-06-22 (domain tool, App Store, trademark web search). (2026-06-22) — [AOD-1](https://linear.app/thexap/issue/AOD-1)
- **Linear integration spec (first per-integration spec):** [specs/integration-linear.md](specs/integration-linear.md) locks how Linear plugs into the shipped seam as a registration-only add. Linear OAuth uses `actor=user` (so `viewer` is the human), the `read` scope, and PKCE, with a verified 24h access token plus a refresh token, which resolves [AOD-9](https://linear.app/thexap/issue/AOD-9) §11 and updates §4 (Linear is a refreshing `oauth2` service, not a long-lived-token one). It fixes the My Issues and Current Cycle GraphQL operations and normalized payloads, the `projectId`/`filter`/`teamId` config with the `linear_projects`/`linear_teams` option sources on the [AOD-53](https://linear.app/thexap/issue/AOD-53) engine, and introduces one generic server-side per-widget operation-plus-normalization seam in the proxy (the single engine edit; integrations stay registration-only after). Establishes the template the Calendar/Claude/Clock specs mirror. Linear API verified 2026-06-26. (2026-06-26) — [AOD-31](https://linear.app/thexap/issue/AOD-31)

## Open questions

Each maps to a `type:decision` issue in Linear. Resolve it there, then mirror the one-line outcome back into "Decisions made" above.

1. ~~**Name.** "alwaysOnDashboard" is the codename. Marketing/brand name TBD, brainstorm in progress (candidates: Tessera, Pane, Mosaic, Facet, Vela, Vantage, Orbit, Lume). Needs domain + App Store + trademark availability check before committing.~~ **Resolved 2026-06-22: Vela.** See *Decisions made* above and [AOD-1](https://linear.app/thexap/issue/AOD-1).
2. ~~**Backend/auth stack final pick.** Supabase (consolidated) vs Clerk + Cloudflare Workers + Neon.~~ **Resolved 2026-06-18: Supabase.** See *Decisions made* above and [AOD-2](https://linear.app/thexap/issue/AOD-2).
3. ~~**Billing.** RevenueCat confirmed? Free/Pro tier boundaries (how many free services on free tier?).~~ **Resolved 2026-06-18: RevenueCat; Free = 2 services / 1 dashboard / 15-min refresh, Kiosk + premium packs Pro; Pro $5.99/mo or $39.99/yr.** See *Decisions made* above and [AOD-3](https://linear.app/thexap/issue/AOD-3).
4. ~~**v1 widget set.** Which specific widgets are worth mounting on a wall day one?~~ **Resolved 2026-06-19: eight standard widgets (Linear My Issues + Current Cycle; Claude Spend MTD + Daily Spend Sparkline; Calendar Next Event + Today's Agenda; Weather Current + Forecast; Clock + Date); Weather on a platform-owned key + user location; all widgets standard (no v1 premium pack); first slice Linear "My Issues". The Claude session/weekly view is a personal-engine widget (no third-party API).** See *Decisions made* above and [AOD-4](https://linear.app/thexap/issue/AOD-4).
5. ~~**Privacy story.** Users hand over tokens to many services; the privacy/security posture is a feature and a marketing point. Define it early.~~ **Resolved 2026-06-19: tokens encrypted server-side in Vault and never on-device; minimized encrypted proxy cache (≤900s); hard-delete on disconnect; in-app + web account deletion; never sell or train on user data; no third-party trackers.** See *Decisions made* above and [AOD-5](https://linear.app/thexap/issue/AOD-5).
