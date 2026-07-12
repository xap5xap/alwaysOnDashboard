# Weather in color — the chosen direction (card-faces phase)

Follow-up in the same **Weather Eye / Colors** chat (so Fable keeps the Weather data, the glyphs, the Transit faces, and the four color directions it just rendered). The open exploration (`Vela - Colors.pdf`) offered A–D; we picked. This pass turns the pick into Weather's **final color treatment** and freezes the palette. Decision recorded in [`docs/specs/design-color-law.md`](../../docs/specs/design-color-law.md). See [[aod-ui-redesign-pivot]].

What we chose: **1C (Running Lights) as the law + a muted 1D (Sailor's Delight) pane on Weather.** The figures wear the data's hue; the Weather card's background wears a deep, muted pane of the current sky; everything else stays dark.

---

## The prompt (paste into the Colors chat as a follow-up)

> We picked from the color pass. Thank you, that was exactly the range we needed.
>
> The direction is **1C (Running Lights), with a muted version of 1D (Sailor's Delight) on the Weather card.** In one sentence: the figures wear the hue of what they measure, and the Weather card's background is a deep, quiet pane of the current sky. We loved 1C most, rain reading blue, the sun gold, the temperature glowing from cold to hot. That is the whole idea, *colors that tell a story.* And we want the card backgrounds from 1D, but calmer.
>
> Make these two layers work together without fighting:
>
> - **The figures' story (1C):** the temperature runs a thermometer from cold to hot (Vela blue → the sail's gold → the Clock's ember); rain falls in teal; the sun-mark, sunrise and sunset are gold; the moon is pale; a storm's bolt is violet; clouds and fog stay bone (gray weather is allowed to be gray). A card lights at most three hues at once, and every colored figure keeps the numeral or glyph beside it that says the same thing.
> - **The field's story (1D, muted):** the Weather card's background is one flat, deep, desaturated pane of the current condition and daylight, clear-day steel blue, rain petrol, thunderstorm violet, clear-night deep indigo, golden-hour amber, and so on. Deep enough that the white temperature stays the brightest thing on the card; quiet enough to read as pigment, not a poster. Flat only: still no gradients, glow, or shadow.
>
> The rule that keeps them from colliding: **the background owns the condition, the figures own the readings.** Keep the pane deep so the figures always win. Watch the warm case especially, a gold temperature on a warm (golden-hour or hot) pane, and solve it so the number never mushes into its background.
>
> Now do three things:
>
> 1. **Freeze the palette.** Show the temperature thermometer as labeled stops with hex, the five condition and event hues with hex, and the muted condition panes as a swatch set with hex. This is the part we turn into tokens, so make it explicit and name each one.
> 2. **Apply it to Weather Eye, final.** Re-render the Transit faces (small, medium, wide, large) and the forecast, on a phone and on the landscape wall, at the same five Quito moments (06:40 first light, 14:32 partly cloudy, 16:20 a rain spell, 17:50 golden hour, 21:40 clear night). Include the wall night frame: a deep-indigo Weather pane, a gold moon, a cool temperature, beside the Clock's ember. Prove the night is restful.
> 3. **Prove it is a system, not a Weather trick.** Show the law on one non-Weather card: Claude spend running the same cold → gold → ember toward its budget, or Linear warming only on a breach. Same law, figures only, no pane.
>
> Keep everything else we established: dark-first, the Transit geometry unchanged, real Quito data, the hero value always the brightest thing, and the accessibility floor that hue is never the only carrier. Freeze the direction; this is the one we build.
