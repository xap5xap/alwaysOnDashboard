# Weather — Claude Design prompt (card-faces phase)

Second per-service card-face chat. One service, two cards (Current + Forecast), designed from zero against
[`docs/specs/vela-DESIGN.md`](../../docs/specs/vela-DESIGN.md) §9. The first card with real **movement**, so
this is where the "ambient-alive vs restraint" calibration gets set for the whole face pass.

## Data palette audit — what the Weather cards actually know

`authClass: 'platform_key'` (keyless Open-Meteo behind a shared platform key). The location lives on the
**connection**, not the widget, so both cards are zero-config. Ground truth:
`registry/services/weather/{types,index}.ts` + the server normalize in
`supabase/functions/_shared/operations.ts` (the `current=` / `daily=` selectors are the real boundary).

**Current Weather** (`current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m`, refresh ~15 min):

| Value | What it is | Example |
|---|---|---|
| **temperature** | The hero number; unit echoed from the provider (metric today) | `17°C` |
| **condition** | One of 8 groups → a glyph, + a human label, + day/night | `Partly cloudy`, group `cloudy`, day |
| **apparentTemperature** | Feels-like | `16°` |
| **humidityPct** | Relative humidity | `78%` |
| **windSpeed + windDirectionDeg** | Speed + a 0–360 bearing → 8-point compass | `9 km/h SE` |

**Forecast** (`daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`, 7 days, refresh ~30 min):

| Value | What it is | Example |
|---|---|---|
| **date + "Today"** | Per-day; Today is knowable and gets emphasis | `Today`, `Mon` |
| **condition** | One of the 8 groups → a day glyph | `Rain` |
| **tempMax / tempMin** | High (bright) / low (recedes) | `19° / 9°` |
| **precipProbabilityPct** | Chance of rain; may be `null` (omit) | `70%` |
| **sunrise / sunset** | Local times, per day — **populated but never rendered today** | `06:11` / `18:16` |

The **8 condition groups** (the full vocabulary): `clear · cloudy · fog · drizzle · rain · showers · snow ·
thunderstorm`. Also available: the current time and the day/night ambient phase (both cards dim after dark
with the wall, using the normal palette, not the Clock's ember).

## What to reject (data we do NOT collect)

- **Hourly / next-12-hours forecast** — only `current` and `daily` are requested. No hourly series or graph.
- **UV index, air pressure, visibility, dew point, cloud-cover %, air quality, weather alerts, moon phase.**
- **Precipitation amount (mm)** — only the *chance-of-rain %* exists.
- **Wind and humidity in the forecast** — those are *current only*, never per future day.
- **Feels-like per forecast day** — current only.

## Sizes & states

- **Current code split:** Current Weather = `small, medium`; Forecast = `wide, large` (the two cards divide
  the four footprints). Both zero-config; `hideHeaderAtSizes: ['small']` on Current.
- **Recommendation (a change from code, flag if you disagree):** design **Current Weather across all four
  sizes** so the wall gets a big ambient weather hero (it scales S→L cleanly). Keep **Forecast at W/L** (a
  multi-day strip needs width; never a 1×1). Overlap at W/L is fine — it just lets a wide slot hold either a
  current banner or a forecast strip.
- **States:** live is the main face. The shell already draws the generic ghost/connecting/stale/error/empty
  chrome; here we design the **live faces** + the loading skeleton + the disconnected "needs a location" face.
  Current Weather is never truly empty (a connected location always has conditions); Forecast's only empty is
  a quiet "No forecast".

## The movement calibration (the Weather-specific decision)

Aim **ambient-alive** (iOS StandBy / Nest Hub: calm-but-living), never flashy. **One honest moving element per
card, from the data, never decoration.** Honest hooks: the in-flight refresh breath; a condition glyph with a
whisper of life; or the strongest and unique to Weather, a **sunrise→sunset day arc** carrying the sun's real
current position (honest: sunrise + sunset + now). **Banned** (would break the one-night-sky restraint):
animated weather scenes, moving gradients, glow, drifting particle rain. Confident numerals and a characterful
glyph carry the rest.

---

## The prompt (paste into Claude Design)

> Design the **Vela Weather cards** as one system: the ambient weather face of an always-on dashboard that
> hangs on a wall or sits on a shelf, lit 24 hours a day. There are **two cards that share one visual
> language**: **Current Weather** (the glanceable hero) and **Forecast** (the multi-day companion). **Design
> from zero.** This is the first Vela card with real *movement*, so the bar is **ambient-alive**: calm and
> living the way iOS StandBy and the Nest Hub are, a weather face a person is happy to have glowing in the room
> all day. Never flashy, never a busy animated weather scene.
>
> **What these cards live in.** Vela is dark-first and emissive; each lit card is a point of light on a
> near-black field, one accent, no gradients, no glow, no shadows. The value dominates; the chrome recedes.
>
> **The real data — everything the Weather cards actually know. Use only this; invent nothing else.**
>
> *Current Weather* (updates about every 15 minutes):
> - **Temperature** (e.g. 17°C; the unit is whatever the provider returns, metric today).
> - **A condition**, as one of eight kinds — clear, cloudy, fog, drizzle, rain, showers, snow, thunderstorm —
>   plus a human label ("Partly cloudy") and whether it is currently **day or night** (a sun kind vs a moon
>   kind).
> - **Feels-like** temperature (16°).
> - **Humidity** (78%).
> - **Wind**: a speed (9 km/h) and a direction (a compass point, SE).
>
> *Forecast* (updates about every 30 minutes, up to 7 days):
> - Per day: the **condition** (one of the eight kinds), a **high and a low** (19° / 9°), a **chance-of-rain**
>   percentage (may be absent), and that day's **sunrise and sunset** times.
> - "Today" is knowable and gets the emphasis; later days recede.
>
> You also know the **current time** and the **day/night ambient phase** (both cards dim after dark with the
> rest of the wall, using the normal palette, not the Clock's ember).
>
> **Do not use** an hourly or next-12-hours forecast, UV index, air pressure, visibility, dew point,
> precipitation *amount* (only the chance-of-rain %), air quality, weather alerts, or moon phase. None of that
> is collected. **Wind and humidity are current only**, never per forecast day.
>
> **Aliveness — one honest moving element, ambient not flashy.** The budget is one slow, living thing per
> card, drawn from the data, never decoration. Honest options: the in-flight refresh breath; a condition glyph
> with a whisper of life (a sun that turns imperceptibly, a cloud that drifts a pixel); or the strongest and
> unique to Weather, a **sunrise-to-sunset day arc** carrying the sun's real position right now (you have
> today's sunrise, sunset, and the current time, so it is honest). No animated rain, no moving gradients, no
> glow — those are banned and would break the one-night-sky restraint.
>
> **The condition glyph is the distinctive hero.** Weather's identity is its glyph (sun / cloud / rain / snow
> / fog / thunderstorm), drawn in the emissive line language, one accent, readable across a room. It stands
> with the temperature as co-equal heroes.
>
> **The two cards and their footprints — fit both width and height at every size; never clip, never leave dead
> space.** The grid is two columns of 96px rows.
>
> *Current Weather* — the glanceable hero, design it across all four:
> - **Small (1×1)** — glyph over temperature, nothing else. The bedside glance.
> - **Medium (1×2)** — glyph and temperature, the condition label, then the feels / humidity / wind line.
> - **Wide (2×1)** — a banner: temperature and glyph leading, condition and the feels / humidity / wind detail
>   alongside.
> - **Large (2×2)** — the wall hero: glyph and temperature commanding, the condition, the feels / humidity /
>   wind, and room for the sunrise-to-sunset day arc. The one read from across a room.
>
> *Forecast* — the multi-day companion, in the winning direction's language:
> - **Wide (2×1)** — a strip of day columns (weekday / glyph / high over low / chance-of-rain), five days.
> - **Large (2×2)** — a seven-day list (weekday / glyph / condition / high-low), Today bright, later days
>   receding.
>
> The temperature and the glyph are always the brightest things; use tabular figures so values never jitter.
> When space runs tight the detail gives way first (wind, then humidity, then feels-like, then the condition
> label), never the temperature or the glyph.
>
> **States.** Live is the main face. Also show: loading (a skeleton shaped to the layout, no spinner); stale
> and error (a small dot or badge, never a recolor of the whole card); and disconnected ("Connect" / needs a
> location, and it must be tappable). Current Weather is never truly empty (a connected location always has
> conditions); Forecast's only empty is a quiet "No forecast".
>
> **Deliver 3–5 distinct directions for Current Weather**, then draw **Forecast in the winning direction's
> language** (1–2 takes). Dark-first. Show each on a **phone (portrait)** and on a **landscape wall tablet**
> seen from across a room. Include a **night** frame (a moon-kind condition with the ambient dim) and use
> **real values** — Quito: 17°C, feels 16°, 78%, 9 km/h SE, Partly cloudy; a rainy-highland week of highs
> ~18–21 and lows ~8–10, sunrise ~06:11, sunset ~18:16 — never placeholder text.
>
> Finally, feel free to be creative. Explore and invent within the data above; don't take my layout notes
> literally. The data palette is the only hard boundary; inside it, surprise me.
