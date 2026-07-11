# Vela — Experience Brief (for a fresh design pass)

> This is a **problem brief, not a spec.** It tells you what Vela is, what it can do, the rules it must obey, and what is going wrong today. It deliberately does **not** describe screens, flows, or an information architecture. That is yours to invent. Build in the attached **Vela Design System** (the fixed visual language); everything about structure is open. If you can imagine a better shape for this than an app with the usual pages, design that.
>
> Framework note: Vela ships in React Native (phone + tablet). You render web. Treat your output as experience and interaction direction, the real build follows in React Native. So think in structure, flow, hierarchy, and feel, not web specifics.

## What Vela is
An always-on ambient dashboard. It gathers the tools someone already uses into calm, glanceable cards they *look at*, not tap through. Promise: "Always on. Never loud." The feeling, held by the design system: a calm night sky where each lit card is a point of light. Alive but still. Never busy.

## Who it is for, and where it lives
People who live across many tools and want one calm surface that pulls them together. It runs in two places:
- a **phone**, held, where you set it up and check in;
- a **wall or desk tablet**, landscape, always on, glanced at from across a room. This always-on wall mode is the flagship.

## The jobs to be done
Design for these outcomes. How you deliver them is up to you.
1. *"Show me what this is and get me to something worth looking at, fast."*
2. *"Let me pull in the tools I already live in, with as little setup as each one allows."*
3. *"Let me end up with just the few things I care about, arranged how I want."*
4. *"Keep it alive and current without me touching it."*
5. *"Let me hang it on a wall and just glance."*

## What it can actually do (the capability map)
This is the buildable reality. Respect it, design around it however you like.

**Services someone can bring in, and what connecting each one takes:**
- **Clock** — needs nothing. Always available.
- **Weather** — needs only a location.
- **Linear** (issue tracking) — a sign-in through Linear (a login handoff that finishes on our server).
- **Google Calendar** — a sign-in through Google (same kind of handoff).
- **Claude usage** (AI spend) — an admin API key the person pastes.

**What each service can show** (a service publishes one or more of these cards):
- **Clock** — the time, big, plus the date. Recolors to a deep red after dark.
- **Weather** — Current (temperature, condition, feels-like, today's high and low, humidity, wind); a multi-day Forecast.
- **Linear** — My Issues (a count, with how many are in progress or blocked, and the top few); Current Cycle (progress toward done).
- **Google Calendar** — Next Event (title, time, place); Today's Agenda (the day's events).
- **Claude usage** — Spend this month (against a budget); Daily Spend (a small trend line).

**How cards behave:**
- Each card comes in a few sizes (small, medium, wide, large) and must read at all of them.
- Each has real states over its life: loading, live, stale, error, not-yet-connected, and empty ("nothing right now").
- Cards refresh themselves on a schedule; the surface updates on its own.
- A card can only exist once its service is connected.

**The business model: freemium.** Most of it is free; some capability is **Pro**, most notably the always-on wall (Kiosk) mode.

## The rules that must hold
- Build in the attached **Vela Design System**: one accent on near-black, no imagery / gradients / glow / shadow, the value dominates, the chrome recedes. Creativity lives in *structure and flow*, not in new visual decoration.
- A card cannot appear before its service is connected.
- The sign-in services (Linear, Google) mean a handoff to that service; you cannot collect their password in-app. Design the moment *around* that reality, do not design it away.
- Two form factors: a hands-on phone (portrait) and a glance-only wall tablet (landscape).
- Show cards using the design system's standard card with the **real data above**. Do not invent bespoke per-widget artwork in this pass; that is a separate step.

## What is going wrong today (real first-use testing)
These are the problems to solve. They are pains, not instructions.
- A brand-new person opened it and could not tell what it was or what to do. It felt boring and empty.
- The very first thing they saw was clutter and dead space, nothing intentional or alive.
- Bringing in a tool was an unexplained list; they could not tell what any service would give them, or why they would want it.
- After they connected one, nothing told them it worked or what to do next. It dead-ended.
- While adding things, they had no sense of what was already there, so it was easy to make a mess.

## What "good" looks like
- A stranger understands what Vela is and takes one clear action within about **10 seconds**.
- It feels calm and alive, a night sky of lit points, never a busy control panel.
- Setup feels as close to effortless as each service allows; the person feels like they are *arranging*, not *configuring*.

Avoid: feeling empty, boring, or broken; feeling like a settings app; becoming busy, decorated, or multi-colored.

## What I want from you
1. First, before any screens, pitch **2 to 3 genuinely different structural concepts** for the whole experience, a few sentences each: how a person goes from "never seen this" to "glancing at a dashboard of their own stuff," and how they bring in and arrange what they care about. Make them real alternatives, not variations of one idea.
2. You are free to **merge, eliminate, or reinvent** any structure. Do not assume Vela currently has any particular screens.
3. Once we pick a concept together, design it in full, dark-first, for phone and landscape wall.

Surprise me. If there is a shape for this that beats a conventional app, that is what I want to see.

---

## Experience must-haves (non-negotiable) — added 2026-07-09

Xavier's bar for the whole product. The goal is something **worth showcasing**, not another boring AI-generated UI. These are not optional.

- **Beautiful UI.**
- **Eye-catching interactions.**
- **Vibrant, characterful visuals and illustration.**
- **Genuinely useful features.**
- **Clear before-and-after** (show the value, do not just tell it).
- **A mascot** with personality.
- **Interactive onboarding**: let people try the real app while they set it up. It converts, and it fits the spine (trying it as you build IS dashboard-as-onboarding). Length is not capped: many screens is fine as long as every screen is interactive and earns its place, never a passive wall of text.

### Where each energy lives (reconciles with "The rules that must hold")
The "restraint, no imagery, one accent" rule applies specifically to the **always-on glance surface** (the dashboard and the wall). That surface is looked at all day, often on an emissive screen in a dim room, so vibrant imagery and busy motion there fatigue the eye, glare in the room, and bury the data that is the whole point. Restraint there is functional, not taste.

Personality, vibrancy, delight, illustration, and the mascot live in the **moments**: onboarding, empty and success states, connect celebrations, the paywall, and marketing. These are not 24/7 surfaces and should be as characterful and eye-catching as we like. (The Duolingo / Linear / Notion pattern: playful moments, calm core.)

### The mascot is the Vela star
The four-point ambient star is already the brand. It becomes a character: expressive, animated, and warm while it guides the moments and celebrates a card lighting up; quiet and still as the wordmark star on the calm dashboard. One brand, two energies.
