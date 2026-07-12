# Vela — Color Law (data-colored: "colors that tell a story")

> Status: **Decided 2026-07-12.** Direction chosen from the `claude-design/Vela - Colors.pdf` exploration (four directions A–D). Xavier picked **1C (Running Lights)** as the law, with a **muted 1D (Sailor's Delight)** condition pane on the Weather card. This doc records the decision and the rules it sets; for color it supersedes the "one accent" sections of [`vela-DESIGN.md`](vela-DESIGN.md) §2 and [`design-redesign-brief.md`](design-redesign-brief.md) A6/A8. Exact hex tokens are frozen in a later step (see §10); this doc fixes the *law*, not the final swatches. Color is a **theme axis**: this doc describes the **default theme** (the 1C signature look), with monochrome and a future per-service theme sitting on the same role-based seam (§8). See [[aod-ui-redesign-pivot]].

## 1. The decision, in one line

Color encodes meaning. A value wears the hue of what it measures (1C); the Weather card's background carries a deep, muted pane of the current sky (1D). Everything else stays dark. Rain reads blue, the sun reads gold, heat banks toward ember, a clear night reads cool, and the numeral always says the same thing the color does.

## 2. Why this over the safe option

The prior recommendation (1e, "The Sky's Hour": warm the whole wall with the time of day) was systemic and safe but had no point of view. 1C gives Vela one you can name in a sentence and recognize across a room: *the dashboard where the data is colored by what it means.* It is the more ownable product, and because every hue sits beside the numeral that repeats it, it stays honest and accessible.

## 3. Two stories on two layers (the core model)

Color lives on exactly two layers, and they divide the labor so they never fight.

- **The figures' story (1C), the reading.** Numbers and glyphs take a hue drawn from the data. Meaning lives in the *marks*: a warm temperature glows gold, a cold one blue, rain falls in teal, the sun-mark is gold.
- **The field's story (1D, muted), the sky.** The Weather card's *background* is a deep, desaturated pane of the current condition. Meaning lives in the *field*: a rainy afternoon is a petrol card, a clear night a deep-indigo one.

**Layer rule:** on the Weather card the background owns the *condition* and the figures own the *readings*. The pane stays deep enough that the figures remain the brightest thing on it. On every other card there is no pane; the field stays Vela's near-black and the figures carry the whole story.

## 4. The meaning-hues (the palette)

All hues are drawn from data Vela already owns; none is decorative. They are anchored on colors already in the system so the palette stays one family.

**Temperature, a thermometer.** A continuous scale from cold to hot:

- cold → **Vela blue** (`#6E8BFF`, the existing accent)
- mild → **the sail's gold** (brand warm gold; exact hex from [`design-brand.md`](design-brand.md))
- hot → **the Clock's ember** (`#C2362B`, the existing night-primary)

Quito's week lives roughly 8–21°, so most days sit in the blue-to-gold half; real heat (28°+) is where ember appears. Stops frozen in §10.

**Condition and event hues** (each duplicates a glyph that still says it):

- **rain** → teal (the falling strokes; the cloud itself stays bone)
- **sun** → gold (the sun-mark, sunrise, sunset)
- **moon** → pale bone (the night glyphs)
- **storm** → violet (the bolt alone)
- **clouds, fog** → **no hue**; gray weather is allowed to be gray (muted / bone)

**Rules that keep it disciplined:**

- A card lights **at most three** hues at once.
- **Hue is never the only carrier.** Every colored figure sits next to the numeral or glyph that says the same thing (17 is still 17). This is the accessibility floor; it is non-negotiable.

## 5. The muted condition panes (Weather background)

The Weather card's background is one flat pane per condition-and-daylight, borrowed from 1D but pulled deep and desaturated:

- Deep enough that white / bone type stays the brightest thing on the card.
- Desaturated enough to read as pigment, not glare; one whispered step of chroma, never a poster.
- Flat: no gradient, no glow, no picture. The emissive-surface bans still hold.
- Families: clear / partly day = deep steel blue; cloudy = deep neutral gray; fog = deep gray-violet; drizzle / rain = deep petrol teal; thunderstorm = deep violet; snow = deep blue-gray; clear night = deep indigo; partly night = deep navy; clear golden-hour = deep amber-brown.
- **One pane per wall.** On the kiosk wall only the Weather card wears a pane; the rest stay near-black so the pane reads as *the sky*, not as theme.

Day vs night panes are chosen by a **boolean the data already has** (is the sun up), not a continuous time ramp. This is the key reason 1C+1D is cheaper and more robust than 1e: there is **no solar-elevation blend to tune**, so Quito and a high-latitude city both behave correctly with no extra math.

## 6. What every card does

- **Weather:** the full system: thermometer temperature, condition and event hues on the figures, a muted condition pane behind them.
- **Clock:** keeps its deep-red ember after dark (The Watch, already shipped). At night it becomes the one *saturated* voice in the room; the ember is now the hot end of the thermometer rather than a lonely exception.
- **Claude usage:** the spend runs the same cold → gold → ember scale toward the budget (calm under budget, warm near it, ember over). One fixed scale, on the figure.
- **Linear:** warms **only on a breach** (overdue, blocked); calm otherwise.
- **Calendar:** neutral for now; may later warm as an event approaches. Not colored in v1.
- **Every future card** inherits the law: one fixed meaning-scale per service, on the figures, no pane. No per-service **branding** colors in any theme; the per-service *theme* (§8) draws hue from your data, never the logo.

## 7. The night exam

Every choice is judged first at 21:40, in a dim room, from the bed and the sofa (Xavier dogfoods this nightly on the wall). The target night frame:

- Weather: a deep-indigo pane, a gold moon, a cool silver-blue temperature.
- Clock: the saturated ember, the only loud thing.
- Everything else: near-black with bone figures.

Three true colors, each meaning something, all restful. A hue that tires after dark is a hue we do not ship. **Verify this frame on the actual Fire HD 8 before freezing tokens;** web previews are density- and brightness-blind.

## 8. Themes (1C is the default)

Color is a **theme axis**, not a single fixed choice. Everything above describes Vela's **default theme, the 1C signature look.** Two more themes sit on the same machinery, because a theme is only a mapping from semantic color **roles** to actual colors, exactly how light and dark already work. The card *structures* (Meridian, Transit's arc, Soundings' silhouette) are color-independent, so every face works in every theme untouched; only the role-to-color mapping changes.

- **Monochrome** (the original restraint): every meaning-role collapses to the white / gray ramp. This is today's build, so it is nearly free to keep as the minimalist option.
- **Signature (1C), the default:** the roles map to the thermometer and condition hues in §4. This is the one we make sing.
- **Per-service** (future): the roles resolve from each service's **own data**: Linear's label / state / project colors, Calendar's event colors, tamed through Vela. The richest and most colorful theme, and the most expensive; not day one.

**Rules for the per-service theme only** (the other two do not need them):

- **Color from the data, never the logo.** A hue is allowed because it *is* a reading (an issue's priority, a calendar's event color), never because it is the service's brand color. Data in, branding out.
- **Tame the user's colors.** Label and event colors are chosen by the user, up close, on a bright phone. Before they reach a dark wall glanced from across a dim room, Vela caps their saturation, guarantees a minimum contrast on the field, and lets the color ride the hero element (the priority silhouette, the event block), not every line of text. A red-labeled issue still reads red; it reads as a point of light, not a highlighter.
- **Data cost.** Some of these colors are not fetched yet (Linear's labels and workflow-state are discarded by the current query, as Weather's sunrise / sunset once was). Surfacing them is a backend change, priced per service when that theme is built.

**Sequencing and placement:**

- **The default carries the product.** Most users never open a theme picker, so the default (1C) must be excellent on its own; themes are a layer on top, not a substitute for nailing one look.
- **Off the first-run path.** Comprehension is Vela's first problem; a newcomer is never asked to pick a color theme before feeling the product. The picker lives in Settings as a personalization reward, and per-service is a plausible **Pro** lever.
- **v1 ships Signature as the default and Monochrome as the free second theme** (it already exists). Per-service and the picker are post-launch.
- **Build implication (the one thing to get right):** faces bind to color **roles**, not literal hexes, so adding a theme is a token remap, never a redesign.

## 9. What this revises (conscious changes, not drift)

Against [`vela-DESIGN.md`](vela-DESIGN.md) §2 and the redesign brief A6/A8:

- **"Exactly one accent" → a bounded, meaning-bound palette.** More than one hue now appears, but only ever tied to a reading, never as decoration or per-service branding. The spirit (no rainbow chrome) holds.
- **"Status hues as dots / badges only, never fill" → data-hues may color a figure.** A colored numeral or glyph is now allowed when the color *is* the reading. Decorative fills are still banned.
- **The one-hairline surface rule gains one exception:** the Weather card's muted condition pane. No other card gets a colored surface.
- **Night is no longer Clock-only.** The Weather card may recolor to a deep sky pane after dark; the Clock keeps the *only saturated* ember.
- Unchanged and still binding: dark-first; no gradients, glow, or shadows; the hero value stays the brightest thing on every card; real data only; the services → widgets → layout seam (color is a token-level concern, cards are never special-cased).

## 10. Open items before code (the token freeze)

1. Freeze the thermometer stops and the condition-pane hexes as named tokens (`--temp-*`, `--sky-*`, `--data-rain / sun / moon / storm`) from the next render, then re-tune each on the low-DPI Fire HD 8 in a dark room.
2. Device-verify the night frame (§7) and the warm-on-warm case (a gold temperature on a warm pane) for contrast and legibility.
3. Sequence the v1 cut: temperature thermometer first, or the full weather set (temperature + rain-teal + sun-gold + moon + storm-violet) at once. Claude spend and Linear breach are a fast-follow, not day one.
4. Re-cut The Watch and Weather Eye finals under this law; carry it into Calendar and Claude usage as they are designed.
5. Reconcile into [`vela-DESIGN.md`](vela-DESIGN.md) §2 and `apps/app/unistyles.ts` once tokens are frozen.
6. Build the card faces against semantic color **roles**, not literal hexes, so monochrome and a future per-service theme are token remaps, not redesigns (the theme seam, §8).
