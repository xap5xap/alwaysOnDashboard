# alwaysOnDashboard — Product Vision

> Status: brainstorm / vision draft. Last updated 2026-06-17. This is a living document; nothing here is locked until moved into the Linear structure and the build decisions log.

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

- **Model:** freemium subscription. Subscription (not one-time) because every connected service implies ongoing backend + API cost.
- **Free tier:** a small number of connected services (e.g. 2-3), basic widgets, one dashboard.
- **Pro (monthly / annual):** unlimited services, all widgets, Kiosk Mode, multiple dashboards/layouts, themes, faster refresh intervals, premium widget packs (flights, finance).
- **Billing:** RevenueCat is the standard for cross-platform mobile IAP (handles both App Store and Play Store subscriptions + entitlements).

## Tech direction (proposed, not locked)

- **App:** Expo (React Native), TypeScript, expo-router. iOS + Android from one codebase. Builds + submission via EAS.
- **Backend:** required for multi-user. Handles OAuth token exchange + refresh, encrypted credential storage, API proxying, and billing webhooks. Candidate: Cloudflare Workers (skills already set up in this environment).
- **Auth:** user accounts. Candidate: Clerk (skill available) or similar.
- **Database:** per-user config — connected services, dashboard layouts, encrypted tokens. Candidate: Neon (Postgres) or Cloudflare D1.
- **Secrets:** OAuth tokens encrypted at rest server-side and refreshed server-side; on-device secure storage (expo-secure-store) only for cache/session.
- **Billing:** RevenueCat.

Why a backend at all: OAuth client secrets cannot ship inside a distributed app, and refresh tokens must be stored and rotated somewhere trusted. This is the single biggest scope jump from "personal app" to "product."

## Connection to the reinvention plan

This is a strong candidate for the **Phase 2 "AI SaaS MVP"** build. It exercises exactly the AI-Solutions-Architect skill set: multi-tenant backend, OAuth integrations, secure secret handling, billing, and a polished cross-platform client. It also dogfoods on a real device daily, which keeps the roadmap honest.

## Decisions made

- **v1 service set:** Linear, Google Calendar, Claude usage, Weather, Clock. (2026-06-17)
- **Layout engine:** free-form drag-and-resize, not a fixed grid. Customization is a core product value. (2026-06-17)
- **Auth is required** (per-user token storage, billing entitlements, multi-device sync). Clerk is NOT a requirement — it was an assumption. Leading candidate is **Supabase** (auth + Postgres + functions in one) to minimize vendors/cost for a solo MVP; alternative is Clerk + Cloudflare Workers + Neon. (2026-06-17)

## Open questions

1. **Name.** "alwaysOnDashboard" is the codename. Marketing/brand name TBD — brainstorm in progress (candidates: Tessera, Pane, Mosaic, Facet, Vela, Vantage, Orbit, Lume). Needs domain + App Store + trademark availability check before committing.
2. **Backend/auth stack final pick.** Supabase (consolidated) vs Clerk + Cloudflare Workers + Neon. Confirm before scaffolding.
3. **Billing.** RevenueCat confirmed? Free/Pro tier boundaries (how many free services on free tier?).
4. **v1 widget set.** Which specific widgets are worth mounting on a wall day one?
5. **Privacy story.** Users hand over tokens to many services; the privacy/security posture is a feature and a marketing point. Define it early.
