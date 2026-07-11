# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**alwaysOnDashboard** is a personalized, always-on ambient dashboard app for iOS and Android, intended to be published to the App Store and Google Play and monetized as a freemium subscription product.

Users connect the services they already use (Linear, Google Calendar, Codex/Anthropic, weather, music, flights, etc.), choose the widgets they care about, and arrange them into a glanceable dashboard that auto-refreshes. It is meant to be *looked at*, not deeply interacted with.

Full vision, service/widget catalog, monetization, and open questions live in **[docs/product-vision.md](docs/product-vision.md)**. Read it before making product or architecture decisions.

## Origin and dogfooding

The project started as Xavier's personal always-on dashboard mounted on a Fire HD 8 tablet (Linear issues + Codex usage). That personal use case became the flagship **Kiosk Mode** feature. Xavier is user zero and dogfoods the product in kiosk mode daily, which drives the roadmap. The product is built for everyone, not just Xavier.

This is a strong candidate for the **Phase 2 "AI SaaS MVP"** build in Xavier's reinvention plan (see the root `/Users/xavierperez/AGENTS.md`).

## Core architecture concept: services → widgets → layout

The entire product is built on a three-layer extensibility model. Preserve this seam in all code:

1. **Service** — a connectable integration with its own auth (OAuth or API key), managed in Settings. Declares which widgets it publishes.
2. **Widget (card)** — a glanceable unit published by a service. Declares title, refresh interval, supported sizes, and per-instance config (e.g. which Linear project).
3. **Dashboard (layout)** — a user-arranged grid of widget instances. Only widgets whose parent service is connected can be added.

**Design rule:** adding a new integration must NOT require changes to the dashboard or layout code. New service = register it + its widgets in the service registry. If a change to add an integration forces edits to layout/dashboard internals, the abstraction is leaking, fix the seam instead.

## Tech direction (proposed, not yet locked)

Confirm these with Xavier before scaffolding; see open questions in the vision doc.

- **App:** Expo (React Native) + TypeScript + expo-router; builds/submission via EAS.
- **Backend (required for multi-user):** handles OAuth token exchange + refresh, encrypted credential storage, API proxying, billing webhooks. Candidate: Cloudflare Workers.
- **Auth:** user accounts. Candidate: Clerk.
- **Database:** per-user config (connected services, layouts, encrypted tokens). Candidate: Neon (Postgres) or Cloudflare D1.
- **Billing:** RevenueCat (cross-platform App Store + Play subscriptions).
- **On-device secrets:** expo-secure-store for cache/session only; OAuth tokens are stored and refreshed server-side.

**Why a backend exists at all:** OAuth client secrets cannot ship inside a distributed app, and refresh tokens must be stored/rotated in a trusted place. This is the biggest scope jump from "personal app" to "product" — do not try to do OAuth purely client-side.

## Integration notes

- **Anthropic / Codex usage** uses the **Admin API** (`GET /v1/organizations/usage_report/messages`, `/cost_report`), which requires an Admin key (`sk-ant-admin...`), distinct from a normal API key.
- **Linear** is GraphQL-only; prefer the official `@linear/sdk`. A Linear MCP server is also available in this environment for ad-hoc reads during development.
- **Flights:** consumer FlightRadar24 subscriptions typically do not include API access. Free ADS-B alternatives: OpenSky Network, adsb.lol, airplanes.live.

## Project management

Tasks are tracked in **Linear**, following the methodology in `/Users/xavierperez/ClaudeProjects/armonia/Armonia/product/linear-management-playbook.md` (version-based initiatives, deliverable-based projects, colon-prefixed label taxonomy). The Linear team for this project is to be created (proposed key `AOD`). Markdown holds vision/specs/decisions; Linear holds tasks. Do not duplicate task state into markdown.

## Status

Pre-scaffold. No app code yet. Current work is product definition: see `docs/product-vision.md` and its open-questions list.
