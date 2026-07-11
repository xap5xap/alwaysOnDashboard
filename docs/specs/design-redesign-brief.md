# Vela — UI/UX Redesign Brief (Claude Design handoff)

> Status: draft handoff, 2026-07-09. Purpose: give a fresh Claude Design chat (or any designer) full context to redesign Vela's app UI, without needing the testing transcript that produced it. Source of the problems: a new-user dogfood run on the Fire HD 8 against the live backend (issues AOD-93 through AOD-104). Tokens are verbatim from [`apps/app/unistyles.ts`](../../apps/app/unistyles.ts); brand and voice from [`design-brand.md`](design-brand.md).

## How to use this brief

- **Paste Section A (standing context) into every Claude Design chat.** It sets what Vela is, the brand, and the constraints.
- **Then paste the one Section B surface brief you're designing** (onboarding, or the card system). Design one surface per chat, not the whole app at once.
- **Attach the matching "before" screenshots** from [`assets/redesign-evidence/`](assets/redesign-evidence/) so the tool sees what is actually broken.
- Ask for 3-5 directions, converge, then translate the winner to React Native and re-test on the tablet.

---

## A. Standing context

### A1. What Vela is (one line + promise)
A personalized, **always-on ambient dashboard**. Connect the services you already use (Linear, Google Calendar, Claude usage, Weather), pick the cards you care about, arrange them, and glance at your whole world at once. It is meant to be **looked at, not interacted with**.
Promise / taglines: *"Always on. Never loud."* / *"Your whole world, quietly lit."*

### A2. Who it's for + how it's used
- **Primary:** people who live across many tools and want one calm surface that aggregates them (developers, founders, makers).
- **Kiosk users:** mount a cheap tablet on a wall or desk as an always-on display. This is the flagship **Kiosk Mode**: landscape, wall-mounted, glanced at from across a room.
- **Positioning:** like a MagicMirror or Smart Display, but a polished app. No Raspberry Pi, no config files. Install, connect, done. The differentiator is deep personalization across real services plus a true always-on kiosk.

### A3. The core model (it shapes the whole UI, preserve it)
**Services → Widgets → Layout.**
- **Service:** something you connect once with credentials (Linear, Calendar, Claude, Weather), managed in Settings. Clock needs no connection and is always available.
- **Widget (card):** a single glanceable unit a service publishes (Weather "Current", Linear "My Issues"). Has a title, supported sizes, and per-instance config.
- **Dashboard (layout):** a free-form arrangement of widget cards. Only widgets whose parent service is connected can be added.

### A4. Surfaces to (re)design
1. **Onboarding / first run** — sign in, understand, connect, first card. *(priority 1)*
2. **Dashboard** — the glanceable grid of cards.
3. **Arrange / editor** — move, resize, configure, add, remove.
4. **Connections / Settings** — connect and manage services.
5. **Kiosk wall** — full-screen, wall-mounted, auto-fit, day/night dim. The flagship.
6. **Paywall** — Free vs Pro.

### A5. Widget / service catalog (what the cards show)
- **Clock + Date** (no connection): big ambient time + date; recolors to a deep-red night palette after dark.
- **Weather** (user location, keyless): Current (temperature + condition glyph + feels/humidity/wind), Forecast.
- **Linear:** My Issues, Current Cycle (a progress ring).
- **Google Calendar:** Next Event, Today's Agenda.
- **Claude usage:** Spend month-to-date, Daily Spend sparkline.
Every card must read at multiple sizes (small / medium / wide / large) and in every state: loading, empty, error/stale, disconnected, live.

### A6. Brand + visual system (adopt verbatim, do not reinvent)
Dark-first, ambient, **one accent**. The identity is restraint: one accent on near-black. **No gradients, no glow, no drop shadows** (they read as glare on an emissive display). Calm, glanceable, never busy.

**Colors — dark theme (primary):**
```
background  #0B0B0F     surface     #16161D     surfaceAlt  #1F1F29     border  #2A2A36
text        #F4F4F8     textMuted   #9B9BA8
accent      #6E8BFF     ← the ONE accent: actions, in-flight refresh, a card's one highlighted figure
status (reserved for dots/badges ONLY, never decoration):  warning #F2B84B   error #FF6B6B   success #4CB782
ambient night (Clock only, after dark):  bg #0A0506   surface #140709   primary #C2362B
```
**Colors — light theme (variant):** background `#F6F6FA`, surface `#FFFFFF`, surfaceAlt `#EEEEF3`, border `#DADAE2`, text `#16161D`, textMuted `#6B6B78`, accent `#3F5BD6`.

**Type** — one humanist geometric sans (system stack: SF Pro on iOS, Roboto on Android). Numeric steps use **tabular figures** so digits don't jitter as values tick.
```
display 96/700   hero 44/700   xl 40/700   title 18/600   heading 15/600
body 14/500   label 13/600   meta 13/400   caption 11/500 (+1 tracking, UPPERCASE headers)   badge 10/700
```
**Spacing:** 4px base (all spacing is a multiple of 4). **Radius:** sm 8, md 14, lg 22, full (pill).

**Voice:** calm, glanceable, present, plain, honest. Say the value, then stop.
- Do: "Nothing left today." · "Connect Linear." · "The one screen you leave on."
- Don't: "Supercharge your productivity!" · "Unlock powerful integrations!" · exclamation marks, hype, jargon.
- Wordmark is lowercase `vela` led by a four-point star; the product name is **Vela** in prose; **Kiosk Mode** is capitalized.

### A7. Experience principles / north star  *(Xavier: confirm these match your vision)*
Vela should feel like a **calm night sky where each lit card is a point of light**. A first-time user should understand what it is and take one clear action within about **10 seconds**. The value dominates; the chrome recedes. Alive but still. It must never feel boring, broken, or busy.

### A8. Non-goals / anti-patterns
- Not a deep-interaction app: the dashboard is glanced at, not tapped through.
- No visual noise: no gradients, glows, shadows, multiple accents, or rainbow status colors.
- Don't break the one-accent discipline or the dark-first ambient feel.
- **Output target is React Native (Expo).** Design for a phone AND a landscape wall tablet. Claude Design outputs web, so treat it as visual/interaction direction; the RN build and an on-device check are a separate step.

### A9. What's wrong today (design goals, from real user testing)
A brand-new user (user zero, on a wall tablet) hit these in the first 20 minutes. Reframed as design goals; see the before/ screenshots.
- First run gave **no orientation or value**: *"I don't know what to do, or what this app is. It's boring."* → **Goal:** a first run that states the value in one line and offers one obvious first action.
- The first dashboard showed **placeholder clutter and dead space**. → **Goal:** a first dashboard that feels intentional and alive (a curated starter or a guided empty state).
- Cards **clipped when small and left dead space when large** (a clock read "19…" small; floated in a third of empty space when wide). → **Goal:** a card system where content fits and looks great at every size and state.
- Connecting a service was a **plain, unexplained list**. → **Goal:** a connections surface that explains each service (what its cards show, an icon, a preview).
- Connecting gave **no feedback and no path to the widget**. → **Goal:** connect → clear success → guided to add the card.
- Adding widgets gave **no "already added" cues**, so duplicates piled up. → **Goal:** an add surface that shows what's already placed and confirms each add.

*(Pure engineering bugs, keyboard-over-input, overlap placement, missing delete, are being fixed in code separately and are not design tasks. The screenshots show them only for context.)*

---

## B. Per-surface briefs (design one per chat)

### B1. Priority 1 — Onboarding / first run → first value
**Before:** `assets/redesign-evidence/01-first-run-no-orientation-stub.png`, `05-connections-no-descriptions.png`.
**Problem:** a new user signs in and lands on a dashboard with placeholder cards, no explanation, and no clear action. It feels boring and confusing.
**Goal:** in about 10 seconds a new user understands what Vela is, sees the value, and takes one clear action toward their first real card.
**Design:**
- A first-run moment that states the promise ("Your whole world, quietly lit") without a wall of text.
- A guided, skippable path: understand → connect one service (or add Clock/Weather, which need no OAuth) → watch a real card light up.
- A dashboard first/empty state that **invites the first action** instead of showing placeholder clutter.
- Make it feel alive on first sight (the night-sky feeling), not an empty black screen.
**Open question for the design:** is the first dashboard a **curated starter set** or a **guided empty state**? Explore both.
**Deliver:** 3-5 directions for the first-run sequence plus the first-dashboard state, dark-first, phone and landscape tablet.

### B2. Priority 2 — The widget card system
**Before:** `assets/redesign-evidence/02-clock-empty-space-when-wide.png`, `03-weather-overlapping-duplicates.png`.
**Problem:** the same card clips content when small and leaves dead space when large; content scales on one axis, so it looks broken at most sizes.
**Goal:** one card system where every widget reads beautifully at every supported size and state.
**Design:**
- **Card anatomy:** the quiet `SERVICE · WIDGET` caption header, the dominant value, secondary detail, an optional glyph, an in-flight refresh mark.
- **Size ramp:** small, medium, wide, large. Show how content adapts (scale, reflow, add or hide detail) so it fits within **both** width and height, never clipping, never floating in dead space.
- **States:** loading (skeleton, no spinner), empty ("Nothing left today."), error/stale, disconnected ("Connect X"), live.
- Worked examples: **Clock**, **Weather Current**, **Linear My Issues**.
**Deliver:** the card at all sizes and all states, presented as a single system. (Validate the winner on the low-DPI wall tablet, web previews are density-blind.)

---

## C. References (ambient-dashboard inspiration)
iOS StandBy, Google Nest Hub / Smart Displays, Widgetsmith, Apple Watch faces (Modular / Infograph), and Grafana (for the arrange interaction only). Pull the calm, one-glance-readable qualities; avoid their busyness.

## D. Evidence (attach these)
In [`assets/redesign-evidence/`](assets/redesign-evidence/):
- `01-first-run-no-orientation-stub.png` — landing dashboard: placeholder Stub card, clipped clock, no guidance.
- `02-clock-empty-space-when-wide.png` — a resized Clock leaving a third of the card empty.
- `03-weather-overlapping-duplicates.png` — three weather cards piled on top of each other.
- `04-keyboard-covers-input.png` — the connect input hidden behind the keyboard (engineering bug, context only).
- `05-connections-no-descriptions.png` — the plain, unexplained connections list.
- `06-add-sheet-no-added-indicator.png` — the Add sheet with no "already added" state.
