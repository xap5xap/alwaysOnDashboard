# Vela — DESIGN.md

> The design-system source of truth for **Claude Design**. Generated from the Vela repo specs: tokens are verbatim from [`apps/app/unistyles.ts`](../../apps/app/unistyles.ts) / [`design-tokens.md`](design-tokens.md), components from [`design-component-library.md`](design-component-library.md), voice/brand from [`design-brand.md`](design-brand.md).
>
> **Framework note.** Vela ships in **React Native (Expo)**. Claude Design renders **web**, so this file maps the system to web (CSS variables, and **Inter** as the closest free stand-in for the in-app system stack SF Pro / Roboto). Treat what Claude Design produces as **visual and interaction direction**; the real build is React Native against the tokens above, verified on a low-DPI wall tablet. Do not treat the web pixels as the shipping pixels.

---

## 1. Visual Theme & Atmosphere

Vela is a personalized, **always-on ambient dashboard**. You connect the services you already use (Linear, Google Calendar, Claude usage, Weather), pick the cards you care about, arrange them, and glance at your whole world at once. It is meant to be **looked at, not interacted with**.

- **Promise:** *"Always on. Never loud."* / *"Your whole world, quietly lit."*
- **The feeling:** a calm night sky where each lit card is a **point of light**. Alive but still. Glanceable, never busy. A first-time user understands what it is and takes one clear action within about **10 seconds**.
- **The identity is restraint:** dark-first, emissive, **one accent** on near-black. The value dominates; the chrome recedes.
- **Hard bans (these read as glare on an emissive display or break the one-accent discipline):** no gradients, no glow, no drop shadows, no second accent, no status colors used as decoration.

Reference vibe (pull the calm, one-glance-readable quality, avoid their busyness): iOS StandBy, Google Nest Hub / Smart Displays, Widgetsmith, Apple Watch Modular / Infograph faces.

---

## 2. Color Palette & Roles

Exactly **one accent** per theme on a near-black field. Status hues appear **only** as a small dot or badge, never as fill or decoration. Dark is the canonical ambient surface; light is a daylight variant.

```css
:root {
  /* ---- Dark theme (primary, the ambient surface) ---- */
  --bg:           #0B0B0F;  /* the field behind the cards; the darkest surface */
  --surface:      #16161D;  /* card fill, one hairline step above the field = a lit panel */
  --surface-alt:  #1F1F29;  /* raised: nested chip, selected row, popover/menu body */
  --border:       #2A2A36;  /* the 1px card edge — defines the card WITHOUT a shadow */
  --skeleton:     #23232E;  /* loading shimmer base (between surface-alt and border) */

  --text:         #F4F4F8;  /* the hero value + primary text — the brightest element */
  --text-muted:   #9B9BA8;  /* receding chrome: SERVICE·WIDGET headers, labels, meta */

  --accent:       #6E8BFF;  /* THE ONE accent: actions, in-flight refresh, one highlighted figure */
  --on-accent:    #FFFFFF;  /* text/icon ON an accent fill (button label, selected pill) */
  --accent-muted: rgba(110,139,255,0.14); /* low-accent surface: pressed text button, selected pill, PRO badge, focus halo */
  --focus-ring:   #6E8BFF;  /* keyboard / focus indicator (aliases accent) */
  --scrim:        rgba(0,0,0,0.60); /* fixed backdrop BEHIND a floating modal/sheet */

  /* Status — DOTS & BADGES ONLY, never decoration, never a fill */
  --warning:      #F2B84B;  /* stale */
  --error:        #FF6B6B;  /* error */
  --success:      #4CB782;  /* up to date / within-limit confirm */
}

/* ---- Light theme (daylight variant) ---- */
[data-theme="light"] {
  --bg:#F6F6FA; --surface:#FFFFFF; --surface-alt:#EEEEF3; --border:#DADAE2; --skeleton:#E4E4EC;
  --text:#16161D; --text-muted:#6B6B78;
  --accent:#3F5BD6; --on-accent:#FFFFFF; --accent-muted:rgba(63,91,214,0.12);
  --focus-ring:#3F5BD6; --scrim:rgba(0,0,0,0.40);
  --warning:#B5791B; --error:#D64545; --success:#2F8F63;
}
```

**Ambient night — the Clock ONLY, after dark.** This is not general UI color. When it goes dark, the surface dims uniformly, and the Clock (and only the Clock) recolors to a deep-red ember palette so it never blasts white light into a dim room:

```css
--night-bg:#0A0506; --night-surface:#140709; --night-border:#2E1214;
--night-primary:#C2362B; --night-secondary:#8A201B; --night-muted:#5E1714;
```

---

## 3. Typography Rules

One humanist geometric sans. In-app it is the **system stack** (SF Pro on iOS, Roboto on Android); on the web canvas use **Inter** as the closest free equivalent. There is no separate brand font.

- **Tabular figures on every value.** Numeric steps set `font-variant-numeric: tabular-nums` so a ticking or refreshing value does not jitter.
- One vertical rhythm for the whole app: the same scale sizes a wall clock and a settings row.

| Step | Size / weight | Tracking · numerics · line-height | Role |
|---|---|---|---|
| `display` | 96 / 700 | −1 · tabular | The wall hero (Clock large) |
| `hero` | 44 / 700 | −0.5 · tabular | A primary value: temperature, spend, Clock medium, a paywall price |
| `xl` | 40 / 700 | tabular | A large value in a denser card; an onboarding stat |
| `title` | 18 / 600 | | Card primary line; settings section title; dialog title |
| `heading` | 15 / 600 | | A labeled condition; a settings row label; a form group head |
| `body` | 14 / 500 | line-height 20 | Default body; the empty-body line; onboarding paragraph; default button label |
| `label` | 13 / 600 | | A label above a value; a small button label; an input label |
| `meta` | 13 / 400 | line-height 18 | Muted secondary detail; a row subtitle; a helper line |
| `caption` | 11 / 500 | +1 · UPPERCASE · line-height 16 | The quiet `SERVICE · WIDGET` header; a section kicker; an input hint |
| `badge` | 10 / 700 | +1 · UPPERCASE | The stale / error badge; a "PRO" tag; a count pill |

---

## 4. Component Stylings

Every component color is a **role reference**, never a raw hex. Nothing draws a shadow.

**Buttons** — four variants, radius 14 (a full-pill button uses radius-full), icon→label gap 8.
- `primary`: bg `--accent`, text `--on-accent`, no border. The one primary action per view.
- `secondary`: transparent bg, `--accent` text, 1px `--border`. A paired alternative (Cancel).
- `ghost`: transparent bg, `--accent` text, no border. A low-weight action / link.
- `destructive`: bg `--error`, text `--on-accent`. Disconnect / Remove.
- States: **pressed** fills darken ~12% (text buttons get an `--accent-muted` bg); **focused** draws a 2px `--focus-ring` offset from the edge; **disabled** opacity 0.38; **loading** shows a spinner and keeps the label, non-interactive.
- Sizes: `sm` 32h / 12 padX / `label` · `md` 40h / 16 padX / `body` (default) · `lg` 48h / 20 padX / `heading`.

**Inputs** — one fill (`--surface-alt`), 1px `--border`, radius 8, height 44, padX 12. States recolor the **border only**.
- default: value `--text`, placeholder `--text-muted`.
- focus: border → `--focus-ring` (1.5px) + a faint focus halo.
- error: border → `--error`, plus a `meta`/`--error` line below.
- disabled: opacity 0.4.
- Label: `caption` / `--text-muted` uppercase. Hint: `meta` / `--text-muted`.

**Toggles / segmented / pills**
- Toggle: track is a radius-full pill (52×30, knob r11). off = `--surface-alt` track + `--text-muted` knob (left); on = `--accent` track + `--on-accent` knob (right); focus = 2px ring.
- Segmented (exclusive choice): group `--surface-alt` + `--border`, radius 8; selected segment = `--accent` fill + `--on-accent`; others = `--text`.
- Pills (multi-select): selected = `--accent-muted` fill + `--accent` border + `--accent` text; unselected = `--border` + `--text`; radius-full.

**Cards, panels, rows** — all at elevation "raised" (`--surface` + 1px `--border`, no shadow).
- **Widget card** (the atom): `--surface` + `--border`, radius 14, padding 12. Anatomy: a quiet `SERVICE · WIDGET` caption header, the dominant value, secondary detail, an optional line glyph, an in-flight refresh mark.
- Row-group: `--surface` + `--border`, radius 14; rows split by 1px `--border` dividers.
- List row: optional leading glyph · identity (`title` + subtitle `meta`/`--text-muted`) · trailing (action / status / chevron); padding 12.
- Auth card: `--surface` + `--border`, radius 22, padding 24; the `vela` wordmark + fields + a primary button.

**Sheets / modals / popovers** — floating UI is `--scrim` + the "overlay" level (`--surface-alt`), never a shadow.
- Bottom sheet: `--scrim` over the field + a `--surface-alt` sheet, top corners radius 22, a grabber handle.
- Center modal: `--scrim` + a centered `--surface-alt` dialog, radius 22, title + body + button row.
- Popover / menu: `--surface-alt` + `--border`, radius 14, **no scrim** (it is anchored), items split by `--border`.

**Feedback**
- Skeleton: bars in `--skeleton`, shaped to the real layout (header + rows), a slow shimmer sweep. **No spinner.**
- Badges (`badge` step): status = a dot (`--warning`/`--error`/`--success`) + an uppercase label; accent = PRO / NEW as `--accent-muted` fill + `--accent` text (radius-full); count = `--accent` fill + `--on-accent`, or `--surface-alt` + `--border`.
- Lock / PRO: a dimmed list row with a padlock (`--text-muted`), a muted title, a PRO badge (`--accent-muted`), a trailing chevron to the paywall. Never an enabled-but-trapped control.

---

## 5. Layout Principles

> **REVISED 2026-07-17 (AOD-122). This section's free-form grid model is SUPERSEDED for the dashboard surface.** The Many Skies card-grid contract (`claude-design/Vela - Many Skies.pdf` §1c, recorded in `redesign-build-audit.md` §2.1) replaces free-form sizing with the **S/M/W/L slot grid**: S 1×1 / M 1×2 / W 2×1 / L 2×2 on a **two-column, 96px-row** grid. The code of record is [`apps/app/src/widgets/sizes.ts`](../../apps/app/src/widgets/sizes.ts) (`SIZE_CATALOGUE`, `coerceToSlotGrid`) with `UNIT_PX = 96` in [`layout/geometry.ts`](../../apps/app/src/layout/geometry.ts); persisted pre-slot layouts are coerced onto the grid at read time (no migration). The spacing and radius rungs below still hold; only the "free-form arrangement" grid bullet is superseded.

- **Spacing: 4px base.** Rungs and roles: 4 (icon→text) · 8 (intra-card row gap) · 12 (**card padding**) · 16 (element gap, list row v-padding) · 24 (section gap, **inter-card gutter**) · 32 (section break, screen top) · 48 (screen margins, a big empty-state block).
- **Radius:** `sm` 8 (chips, inputs, badge) · `md` 14 (**the card** and most panels) · `lg` 22 (sheets, modals, paywall, auth card) · `full` 9999 (pills, toggles, progress ends).
- **Grid:** the dashboard is a **free-form arrangement of cards**, not a rigid wall of identical tiles. Compose intentionally; leave breathing room without dead space. The value dominates; the chrome recedes to muted.

---

## 6. Depth & Elevation (NO shadows)

Vela is an **emissive** display, often a wall or shelf in a dim room, where the surface itself is the light. A drop shadow reads as glare or a smudge, not depth, so **there are no shadows anywhere.** Elevation is a step in surface fill plus a hairline border:

- **base (0):** the field (`--bg`), no border — the dashboard backdrop.
- **raised (1):** a card / panel / row-group — `--surface` + 1px `--border`. The default surface.
- **overlay (2):** a popover / menu / selected row — `--surface-alt` + 1px `--border`.
- **floating (modal / sheet):** paint `--scrim` over everything behind, then place the surface at the "overlay" level. Still no shadow.

---

## 7. Do's and Don'ts

**Do**
- Keep exactly **one accent**. Let the value be the brightest thing on screen; let all chrome recede to `--text-muted`.
- Use **tabular figures** on every number so values do not jitter as they tick or refresh.
- Fill the canvas with **real, intentional content**. A card must fit its bounds at every size: never clip, never float in dead space.
- Make it **alive but still.** Aliveness comes from confident numerals, real data density, and **one** moving element per card (the in-flight refresh pulse, a ticking digit). That is the whole motion budget.
- Write in the calm voice: plain, present, honest. *"Nothing left today." "Connect Linear." "The one screen you leave on."*

**Don't**
- No gradients, glows, drop shadows, or a second accent.
- No status color as decoration — only a dot or a badge.
- No hype, exclamation marks, or jargon. Not *"Supercharge your productivity!"*, not *"Unlock powerful integrations!"*.
- Don't make aliveness come from decoration; it comes from typography, real data, and one motion.
- Don't let a card clip when small or float in emptiness when wide. Fit to both width and height.

---

## 8. Responsive Behavior

- **Two form factors:** a **phone** (portrait) and a **landscape wall tablet** glanced at from across a room (the flagship **Kiosk Mode**). Design both.
- **Every card reads at four sizes:** small, medium, wide, large. Content adapts (scale, reflow, add or hide detail) to fit **both** width and height. Never clip; never leave dead space.
- **Every card has states:** loading (skeleton, no spinner) · empty (*"Nothing left today."*) · error / stale (a badge) · disconnected (*"Connect X"*, and it must be tappable) · live.
- **Day → night:** after dark the surface dims uniformly; the Clock alone recolors to the deep-red ambient-night palette (Section 2).

---

## 9. Agent Prompt Guide (reusable)

Design **one surface per chat**, ask for **3–5 directions**, converge, then hand the winner to the React Native build.

- **A card as a system:** *"Design the Vela [Weather Current / Linear My Issues / Clock] card as one system: small, medium, wide, and large, plus loading, empty, error, disconnected, and live states. Content must fit within both width and height at every size — never clip, never float in dead space. Use this real data: [paste values]. Aliveness from confident numerals and one moving element, never decoration. Dark-first; show it on a phone and on a landscape wall tablet."*
- **First run → first value:** *"Design the Vela first run: in about 10 seconds a new user understands what Vela is, sees the value, and takes one clear action toward a first real card. Guided but skippable: understand → connect one service (or add Clock/Weather, which need no login) → watch a real card light up. The first dashboard should feel alive, not an empty black screen."*
- **Always:** dark-first, one accent, no shadow/gradient/glow, real data over lorem, and attach 2–3 reference screenshots of ambient dashboards you like.
