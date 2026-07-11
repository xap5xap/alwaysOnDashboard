# Clock — Claude Design prompt (card-faces phase)

The first per-service card-face chat. One service per chat, designed from zero against
[`docs/specs/vela-DESIGN.md`](../../docs/specs/vela-DESIGN.md) §9 ("a card as a system"). The output PDF is
archived back into `claude-design/` like the shell sessions.

## Data palette audit — what the Clock actually knows

The Clock is Vela's **only `authClass: 'none'` service**: no server half, no proxy, no cache, no credential,
no provider. Its entire "data" is derived in the leaf from `new Date()` + `Intl.DateTimeFormat`, on-device,
with **zero network**. Ground truth: `apps/app/src/registry/services/clock/{index,types,time}.ts` +
`ambient/AmbientContext.tsx`. The complete set of values a Clock card can render:

| Value | What it is | Example |
|---|---|---|
| **time** | HH:MM, optional seconds; 12h or 24h. Seconds on → 1s tick; off → 60s tick. | `14:05` · `2:05 PM` · `14:05:32` |
| **date** | Optional line; full → short. | `Monday, June 28` · `Jun 28, 2026` · `6/28/26` |
| **zone / place** | Device-local by default (no place shown). An IANA override makes it a *second clock*: place label + GMT offset. | `New York` · `GMT−4` |
| **ambient phase + dimLevel** | Day vs. night signal (`useAmbient()`). The Clock recolors to a deep-red ember palette after dark and dims through dusk / lifts through dawn. Its signature. | `day` / `night`, `0..0.7` |

Derivable from the time alone (honest, free): AM/PM, hour/minute/second, weekday, day, month, year, and the
fraction of the day elapsed. Anything computable from the device clock is fair game.

## What to reject (data we do NOT have)

- **Sunrise / sunset times.** The solar schedule is *not plumbed* — only a fixed 07:00/21:00 day/night
  boundary exists, and only under the kiosk runtime. No "sun rises 6:42."
- **Weather, temperature, moon phase**, any astronomical data.
- **Alarms, timers, countdowns, upcoming events** — that's Calendar, a different service.
- **A city/location name** beyond the humanized IANA segment, and only when an override is set.
- **Multiple zones in one card.** One Clock instance = one zone. A world clock is *several* Clock cards,
  never one card with many cities.

## Sizes & states

- **Supported sizes: all four** — `small` · `medium` · `wide` · `large`. Under the redesign shell contract:
  **S 1×1 · M 1×2 · W 2×1 · L 2×2** on the 2-column, 96px-row grid. Header is suppressed at small (just the
  time). The Clock is the wall hero at large (display 96).
  - ⚠️ **Discrepancy to reconcile at build time:** the built `apps/app/src/widgets/sizes.ts` still encodes the
    *pre-pivot* spans (medium = 2×1 landscape, wide = 3×1 banner). We design to the **new** contract
    (M = 1×2 portrait, W = 2×1); `sizes.ts` gets updated when this face is built. Not a design blocker.
- **States are unusually few.** The Clock can't fetch, so it can never be **stale, errored, or empty** — the
  device clock always has a value (the spec makes `ClockView` unconditional). Only two faces exist: the
  **live** clock (always) and the **ghost/preview** in the card picker before it's placed. The day→night ember
  recolor is a live-face variation, not a separate state.

---

## The prompt (paste into Claude Design)

> Design the **Vela Clock card** as one system — the calm, living centerpiece of an always-on dashboard that
> hangs on a wall or sits on a shelf, lit 24 hours a day. This is not a utility clock widget; it is the one
> card a person is *happy* to have glowing in their room all day and all night. **Design it from zero.** Reach
> for something with a point of view — ambient and alive the way iOS StandBy and the Nest Hub are alive: calm,
> still, but breathing. Never flashy.
>
> **What this card lives in.** Vela is dark-first and emissive; each lit card is a point of light on a
> near-black field — one accent, no gradients, no glow, no shadows. The Clock is the most-looked-at card and
> the wall's hero. Its whole job is to be beautiful to glance at.
>
> **The real data — this is everything the Clock actually knows. Use only this; invent nothing else.** The
> Clock reads the *device's own clock*, on-device, with no network and no account. It can show:
> - **The time** — hours and minutes, optionally seconds; 12-hour ("2:05 PM") or 24-hour ("14:05"). With
>   seconds on it ticks every second ("14:05:32"); off, it settles once a minute.
> - **The date** — optional, from a full weekday line down to a short numeric one: "Monday, June 28" ·
>   "June 28, 2026" · "Jun 28, 2026" · "6/28/26".
> - **A second-clock identity** — normally the clock is *device-local* and shows no place name. Set to a
>   specific zone instead, it becomes a labeled second clock: a place name ("New York") and a GMT offset
>   ("GMT−4"). One card = one place. A world clock is *several* of these cards, never one card with many
>   cities.
> - **Day vs. night** — the Clock is the *one* card that knows whether it's day or night, and it changes
>   character after dark: by day it draws in the normal palette; after dark it recolors to a deep-red **ember**
>   so it never blasts white light into a dim room, dimming gently through dusk and lifting through dawn. Use
>   exactly these night colors: background `#0A0506`, the time in ember `#C2362B`, secondary `#8A201B`, muted
>   `#5E1714`.
>
> From the time alone you may also express the *passage* of the day — a ticking figure, a sweeping second, the
> sense of where we are between dawn and dark. Anything derivable from the clock itself is fair. **Do not use**
> sunrise/sunset times, weather, temperature, moon phase, alarms, timers, or upcoming events — the Clock holds
> none of that.
>
> **Aliveness = one moving element, from the data, never decoration.** The honest motion here is the passing
> second (a ticking digit, or a once-a-minute settle) and the slow day→night recolor. That is the whole motion
> budget. No spinners, no bouncing, no particles.
>
> **Four sizes, one system — fit both width and height at every one; never clip, never leave dead space.** The
> grid is two columns of 96px rows.
> - **Small (1×1)** — a single square tile: just the time, no header, no chrome. A bedside glance.
> - **Medium (1×2)** — a tall, half-width tile: time plus the date line.
> - **Wide (2×1)** — a full-width short banner: the time reads large, with date and (for a second clock) the
>   place and offset alongside.
> - **Large (2×2)** — the wall hero: the time as a commanding display figure, date and place in quiet
>   support. This is the one read from across a room.
>
> The time is always the dominant, brightest thing; use **tabular figures** so it never jitters as it ticks.
> When space runs tight the *detail* gives way first — seconds, then the date, then the place — never the time
> itself.
>
> **States.** The Clock is unusual: it can't fetch, so it can never be stale, errored, or empty — the device
> clock always has a value. So there are only two faces: the **live** clock (always), and the **ghost/preview**
> it shows in the card picker before it's placed (a quiet, un-lit version of itself at real size). Design that
> preview too.
>
> **Deliver 3–5 distinct directions.** Dark-first. Show each on a **phone (portrait)** and on a **landscape
> wall tablet** seen from across a room. Include at least one frame of the **night ember** face and one of a
> **second clock** (a place + offset). Use real times and dates, never placeholder text.
> 
> Finally, feel free to be creative. You are free to explore and design things by yourself. Don’t take what I said literally. Just be creative. 
