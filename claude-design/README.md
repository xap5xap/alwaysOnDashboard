# Claude Design (Fable) session archive

Design outputs from the **UI/UX redesign** pivot (see [[aod-ui-redesign-pivot]] in memory and
[`docs/specs/vela-experience-brief.md`](../docs/specs/vela-experience-brief.md)). These PDFs were
generated in Claude Design (claude.ai/design) via its **share → export** option and dropped here so
the designs survive outside the chat and can be re-analyzed later.

Each PDF is a **single very tall storyboard page** (≈1262 × 6966 pt) — a sequence of labeled sections,
each with device frames plus explanatory copy. The design tool renders **web** as a stand-in for the
real React Native build; treat everything as experience/interaction direction, not shipping pixels.

## The sessions, in order

| # | PDF | Date | What it is | Status |
|---|-----|------|------------|--------|
| 1 | `Vela - The sky fills in.pdf` | 2026-07-09 | The structural **concept** for the whole experience: dashboard-as-onboarding, the calm **Glance** ↔ **Tend** dial, the ghost→lit card lifecycle, resize/move/delete in Tend, the zero-chrome wall, the contextual wall paywall. | Spine concept, committed |
| 2 | `Vela - Raising the Sail.pdf` | 2026-07-09 | The guided **onboarding front door**: cold open → deal cards one service at a time → Clock first, Weather location-only, "two cards, one cost" → lazy account at first real connect → "Your sky, lit." reveal → hands off to the Glance surface. Skip → Clock+Weather. Wall first-run = a pairing code. Silent gold-sail mascot. | Golden path, committed |
| 3 | `Vela - Many Skies.pdf` | 2026-07-10 | The **multi-dashboard canvas** above one dashboard: several "skies" swiped like iOS screens; **two altitudes inside one Tend** (card altitude + page altitude reached by pressing the grown page-dots); tending cards (move/add/configure/remove) and skies (reorder/label/delete); the Pro moment (2nd sky + wall) in two takes; the new-sky creation moment in two takes; hang-on-a-wall with an opt-in slow cycle; the wall with many skies. | Chat 1 of the shell pass; card-agnostic |
| 4 | `Vela - Many Skies - v2.pdf` | 2026-07-10 | **Revision of #3.** Retires the §1d row-list "Add a card" catalog and rebuilds it as a new top section **"Add by Seeing"** — a preview-first picker where you see the card at real size and previewed *on your own sky* before it lands: ghost-connect-in-place, an already-added mark ("Add again"), and size chosen by seeing (S/M/W/L flips tile + preview together). Two takes on the browse layout: **A "shelf under the sky"** (sky stays visible, centering a card previews it live) and **B "full gallery"** (iOS-like grid, preview is a mode). Fable leans **A** (+ B's search). Section 1 (Many Skies) carried over unchanged. | Add-flow redesign; supersedes #3's §1d |
| 5 | `Vela - Below Deck.pdf` | 2026-07-10 | **The account & connections home** ("Below Deck"). One quiet scrolling room, two shelves (Connections + Account), reached by **pull-down** or a **Tend page-altitude row** (wordmark-as-door rejected). Centerpiece: **reconnect = the first-connect door re-run per auth kind** — OAuth out-and-back / key paste / location — plus a calm **expired / error / stale / healthy** status legend ("only expired asks anything of a person"). Broken card **fixes in place** (a sheet on the card, Take A). **Three removes, three weights**: undo (card) / confirm (disconnect) / hold-to-delete (account). Delete-account full flow lands on a fresh Raising-the-Sail sky. Subscription **Free featured + Pro variant** (cancel/manage deferred to the App Store; restore lives here). Wall shows a broken card + "Tend from your phone"; a **light-theme** frame is included; the mascot is deliberately absent. Two open seams flagged: the pull-handle error dot, and whether phone sign-out blanks a paired wall. | Account & connections; strong, near-final |
| 6 | `Vela - The Fare.pdf` | 2026-07-10 | **The paywall + subscription lifecycle** ("The Fare"). Register committed to **Take B** — the paywall leads with a **live wall miniature** ticking with your real time, no hype; Take C (sail sells) rejected — the **sail is saved for the post-purchase "Welcome to Pro,"** never the pitch ("the sail has never once worked for money"). **Contextual paywall** = one screen, four "first breaths" (from the wall door / second-sky door / neutral "See Pro" ledger / post-lapse); constant offer below. Monthly default (annual not an ambush), 7-day trial in the button, price visible; **the store does the money** (native sheet as a gray abstraction; manage/cancel/switch = App Store; restore in-app). Lifecycle row across all states + **one honest nudge** 2 days out ("the only note you'll get"). Centerpiece **"paused, not lost"** lapse: nothing deleted, front sky stays free, extra skies + wall paused/kept, choose your free sky by dragging, Pro re-lights all. Anti-dark-pattern throughout; "a subscription is plumbing." | Paywall + lifecycle; strong. Superseded by #7 (trial removed). |
| 8 | `Vela - Holding Course.pdf` | 2026-07-11 | **The edge-state sweep** ("Holding Course") — app-level edges, phone + wall. Organizing principle: **"the mark sits at the scope of the cause"** — a 13px sky-line for a sky-wide fault, a card badge for one card's trouble, never both. Covers **offline** (amber "holding your last picture", last-known kept + honestly aged "from 2:41", heals with one accent breath "Back — catching up" then sinks, no toast); **Vela server unreachable** (red "our side, not yours · retrying" — condition/amber vs fault-ours/red, "nearer fault wins"); **one service erroring** (card badge only, sky unbothered); **cold launch** (cache-first — first frame *is* your sky honestly aged, freshen-in-place, skeleton-no-spinner only on a truly-fresh device, Clock lit first, wall never splashes/asks sign-in); **the empty sky** ("A clear sky · Tend this sky" invitation; wall falls back to the Clock, never dark/setup); **failed sign-in mid-onboarding** ("Linear didn't finish" not "failed", no red in first-run, lit stays lit, socket-not-a-scar, same golden-path reveal). Hardest-seam (1a): 3 takes, committed A (sky speaks once) + C's wall reading-distance discipline. **The wall never alarms.** | Edge sweep; commit-quality. **CLOSES the card-agnostic shell.** |
| 7 | `Vela - The Fare v2.pdf` | 2026-07-10 | **The Fare, trial removed — the committed version.** Pro is bought **outright**, no 7-day trial (Xavier's call 2026-07-10). Clean subtraction: CTA is the contextual reach-completion — **"Hang it on the wall" / "Make your second sky" / "Go Pro" / "Resume Pro"** ("the button buys, labeled with the errand it finishes"); subtext is price-only + "cancel anytime — nothing you made is deleted"; store sheet reads "starting today · Due today"; welcome de-trialed ("$3.99 a month · renews [date]", the sail breath kept); lifecycle row simplified to Free → Pro-active → Canceled → Grace → Lapsed; **the 2-day nudge removed** ("no trial, so no countdown and no nudge — renewals are the store's receipts"); §1d renamed "The quiet middle." Register/Take-B wall-miniature now **explicitly carries the persuasion alone** (option a). "Paused, not lost" (§1f) intact. **Supersedes #6.** | Paywall FINAL |

**Lineage:** 1 set the spine (one sky, glance/tend). 2 added the front door that assembles a
newcomer's first sky. 3 sits *above* a single sky — the canvas that holds several and every operation
on them — and explicitly leaves single-sky Tend unchanged from 1 and the guided front door to 2.

## What #3 (Many Skies) locks in

- **Direction B, two altitudes in one Tend.** The Glance/Tend "dial" is unchanged. In Tend the page
  dots grow into a pressable capsule; pressing them (or pinch-in) rises to **page altitude** where whole
  dashboards are thumbnail tiles; tapping a sky descends to its **card altitude**. Same two moves — tap
  to select, hold to drag — at both. "Swipe never edits."
- **Card grid contract** (the rule every future face must fit): `S 1×1 · M 1×2 · W 2×1 · L 2×2` on a
  two-column, 96px-row grid (24px gutters on the wall); **the value never shrinks below its step —
  detail truncates first, then drops.** Six states on one tile: ghost / connecting / live / stale /
  error / empty.
- **Cross-sky card move:** carry a held card to the screen edge and hold — the next sky slides under
  your finger, so a card moves between skies without lifting.
- **Delete-in-place:** the tile's face becomes the question ("Its 5 cards go with it. Delete / Keep"),
  no modal; connections survive (they belong to the account); the last sky can't be deleted, only emptied.
- **Nameless until named:** skies are dots, not names; an optional label lives only at page altitude and
  in the wall's hold capsule; clearing the text returns a sky to namelessness.
- **Pro = exactly two doors,** both "more places to look": a **second sky** and the **wall**.
- **The wall hangs one sky;** cycle is opt-in, off by default (dwell 5min / 15min / 1hr, ~800ms
  dissolve, skips empty skies). The wall stays glance-only; a one-second hold shows "which sky · Tend
  from your phone." First-time pairing reuses Raising the Sail's code flow.

## Open items flagged in #3 (not yet resolved)

- **"Tend" label** persists everywhere (the toggle reads *Glance | Tend*) — a known comprehension risk;
  rename candidate (Edit / Arrange).
- **Wall swipe gesture** left explicitly undecided (advance the cycle vs ignore) — a device-test call.
- **Page-altitude discoverability** (pressing tiny dots to reach dashboard management) — worth a
  first-time cue.
- Wordmark still shows the **retired 4-point star**; the mascot is the **gold sail** — propagate the
  sail mark before the per-face pass.

## Card faces (the per-service pass)

The card-agnostic shell is closed (sessions 1-8). This phase designs the **card faces themselves**, from
zero, **one service per chat** (see [[aod-ui-redesign-pivot]] in memory). Claude Design is fed only the
service's real **data palette** (from code, not the old pre-pivot mockups); prompts live in [`prompts/`](prompts/).

| Service | PDF | Date | Directions Fable returned | Decision |
|---|-----|------|------|------|
| **Clock** | `Vela - The Watch.pdf` | 2026-07-11 | Four faces + the ember ramp + the ghost + a live card. **Meridian** (the figure, alone: centered, no chrome). **Waterline** (a 1px hairline = the whole day, a 4px mark = now placed on it; zero accent). **Bell** (time as words rounded to 5 min, exact figure beneath). **Beacon** (figure fills the long axis, 24h, minutes a tint behind hours). Thesis: *"everything on the face is the time, or it isn't there."* Fable's pick: Waterline. | **V1 = Meridian** (Xavier, 2026-07-11). Waterline's day-line is a nice-to-have, **deferred** to a future version. Bell / Beacon out of V1 (Beacon a possible future wall night-posture). **Caption-less Clock adopted** — the one card with no `SERVICE · WIDGET` header ("a clock is self-evident"); a second clock wears its place as its only label. |
| **Weather** | `Vela - Weather Eye.pdf` | 2026-07-11 | Two cards (Current + Forecast), four directions for Current. **Abeam** (glyph + figure side by side). **Transit** (the sunrise→sunset arc carrying the sun's live position). **The Log** (no glyph, a number ledger — self-defeating). **Figurehead** (the glyph huge as a landmark). Forecast: a **List** and a **Range** (hi-lo as span-bars) take. One honest motion each. Fable's pick: Transit. | **V1 = Transit** (Xavier, 2026-07-11): Current leads with the arc (curve at Large, flat waterline at Wide/Medium, absent at Small); **Forecast = the Range take**. The Log and Figurehead rejected (Figurehead inverts the Clock-as-hero hierarchy, "the wrong king"). **Caption = `SERVICE · PLACE`** (`WEATHER · QUITO`, not "Current"). Sizes: Current all four (S/M/W/L), Forecast W/L. The "arc rhymes with the Clock's Waterline" argument is **void in V1** (Clock is Meridian); the arc stands on its own. |
| **Linear** | `Vela - The Manifest.pdf` | 2026-07-12 | Two cards. My Issues, four directions: **Muster** (count + roll call), **The Heading** (the one issue to pull next), **Stowage** (dense ledger), **Soundings** (count + a priority-mark silhouette, sorted heavy→light). Current Cycle, two takes: **Dead Reckoning** (smooth ring) and **The Log Line** (21-knot segmented ring). Unifying idea: "discrete work drawn as discrete marks." Fable's pick: Soundings + The Log Line. | **V1 = Soundings + The Log Line** (Xavier, 2026-07-12): My Issues = count + priority silhouette (reads at distance, "how many and how heavy"); Current Cycle = the 21-knot ring, **device-verify the knots on the Fire HD 8** — the smooth Dead Reckoning ring is the low-DPI fallback if they shimmer. Muster = free fallback, The Heading = future focus mode, Stowage = the phone's dense option. Caption = `LINEAR · PROJECT` / `LINEAR · TEAM` (needs_config reverts to the widget name). Priority is shape, never hue; My Issues fully monochrome, the one accent lives in the cycle ring. |
| **Calendar** | `Vela - Ship's Bells.pdf` (V1) · `Vela - Ship's Bells-V2.pdf` (V2, committed) | 2026-07-12 | Two cards (Next Event + Today's Agenda). V1 argued both ways: **Dead Reckoning** (fully bone) vs **Landfall** (the next event's "when" warms only in its last hour) — Fable picked Landfall + a late ramp, so bone most of the day. Xavier wanted color, so V2 **"Dressed Overall"** widened it. | **V1 = Dressed Overall** (widened Landfall, Xavier 2026-07-12): every event's time wears its distance on the `--when-*` ladder (dawn `#7FA3D9` far → balmy `#DC9853` at Now) — the thermometer read as time, capped at balmy so Calendar warmth is never trouble. Colorful all day incl. the 08:00 morning; the imminent event still pops warmest. **"One freeze, three postures"** (Dead Reckoning / Landfall / Dressed Overall via config). Caption = `CALENDAR · <calendar>`; never a pane. Device-verify the cool stops stay distinct at 13px on the Fire HD 8. |

**Build deltas the Clock (Meridian) carries into code:** no service header at *any* size (code today hides it
only at small, `hideHeaderAtSizes: ['small']`); the dusk→ember ramp runs ~3 h and gentle ("a shade a minute",
vs the 60-min default in `apps/app/src/kiosk/ambient.ts`); night recolors to the ember tokens; seconds sit a
whisper under the meridiem; an **OLED burn-in pixel-shift study** is queued for the wall (Meridian's figure is
static); `apps/app/src/widgets/sizes.ts` still holds the pre-pivot spans (`medium 2×1`, `wide 3×1`) and needs
the `M 1×2 / W 2×1` contract. States reduce to **live** (always) + **ghost** preview — the Clock can't fetch,
so no stale / error / empty / skeleton.

**Build deltas the Weather (Transit) cards carry into code:** Current Weather expands to all four sizes
(code has `small, medium` only → add `wide, large`); **the sun-arc needs today's sunrise/sunset, which only
the Forecast `daily=` operation fetches today — the Current operation must also pull today's sunrise/sunset**
(Open-Meteo returns `current=` + `daily=sunrise,sunset&forecast_days=1` in one call); the arc curves at Large,
flattens to a waterline at Wide/Medium, is absent at Small; night dims in the normal palette with the moon
glyph from `condition.isDay` (no ember); the refresh breath is an accent dot on the ~15-min cadence; rework
`WeatherIcon.tsx` to the 8-kind + day/night set at one line weight across three duties; Forecast adds the Range
span-bar layout; the caption becomes `WEATHER · <place>`. States (skeleton-with-arc, amber stale dot + "As
of", red error dot with the sun-mark **paused**, disconnected "Connect / Needs a location") match Holding
Course.

**Build deltas the Linear cards carry into code:** the priority-glyph set (five marks by shape — none-dashes /
1-2-3 bars / urgent block) at 11–34px duties; My Issues = count + the **Soundings** silhouette (marks sorted
heavy→light) at S/M/W/L, the Wide banner being count + silhouette; Current Cycle = **The Log Line** 21-knot
segmented ring (**must be device-verified on the low-DPI wall; fall back to the smooth Dead Reckoning ring if
the knots alias** — the AOD-81 density lesson) across S/M/W/L; motion is the settle only (a mark/knot moves
when work changes, ~400ms, else still); the sort (urgent → due → number) pushed to the data layer so the card
never re-ranks twice; caption `LINEAR · <project/team>`, reverting to the widget name in needs_config. States:
two good empties + loading (list + ring skeletons) + stale/error dots + disconnected + needs_config.

**Widget-system note — the caption is per-widget (confirmed across three faces):** it carries the most useful
identifier, not a fixed `SERVICE · WIDGET` — **none** (Clock, self-evident), **the place** (Weather,
`WEATHER · QUITO`), **the project / team** (Linear). The widget system needs a per-widget caption strategy
(hidden / place / custom / widget-name-fallback), not one rule.

## Palette — warming the system (2026-07-12) · SUPERSEDED

> **Superseded by the data-hue color law** (see the Color section below and [`docs/specs/design-color-law.md`](../docs/specs/design-color-law.md)). This "warm the neutrals" plan was explored openly, then replaced by the bolder 1C data-hue direction. Kept for the trail.

After three monochrome faces, Xavier flagged that the cards read too single-color and cold. **Decision: warm
the system, do not rainbow the cards.** Per-service accent colors would break the one-sky coherence and the
across-the-room legibility that the restraint is *functionally* protecting (color fails at distance and in dim
light on a 24/7 emissive wall). The real issue is that the palette is **cold** (a blue accent `#6E8BFF` on a
cold near-black `#0B0B0F`) while the **brand is warm** (the gold sail `#E2A94E`, the ember night `#C2362B`) —
"a cold spreadsheet, not a lantern." The fix is a **system-level palette re-tune** (`vela-DESIGN.md` §2 /
`unistyles.ts`): shift the one accent cold→warm (tied to the gold sail, resolving the collision with the amber
`warning` status), warm the near-black field and the neutrals, keep the ember night. The card **structures**
already chosen (Meridian figure, Transit arc, Soundings silhouette) are **color-temperature-independent**, so
warming costs nothing on work done — the finished directions just re-render warm. Do the palette pass **before
Calendar and Claude usage** so the last two design in the final palette, and retrofit the three done.

## Color — the data-hue law (2026-07-12)

The "warming" plan above was replaced by a bolder, more ownable direction: **color encodes meaning, drawn from real data, never decoration.** Full rules and the conscious revisions in [`docs/specs/design-color-law.md`](../docs/specs/design-color-law.md).

| PDF | Date | What it is |
|-----|------|------------|
| `Vela - Colors.pdf` | 2026-07-12 | The **open color exploration** on the Weather cards, four directions subtle→loud: **A Lamplight** (warm the neutral tokens), **B The Sky's Hour** (five time-of-day light stops), **C Running Lights** (figures wear data-hues: a temperature thermometer, rain teal, sun gold, storm violet, moon pale), **D Sailor's Delight** (the Weather card becomes a flat condition pane). Fable's own pick was 1e (B + C's thermometer). |
| `Vela - Made Fast.pdf` | 2026-07-12 | The **color freeze.** Xavier chose **1C (Running Lights) + a muted 1D pane on Weather**: figures wear the data's hue, the Weather background is a deep muted pane of the current sky, everything else stays dark. Freezes three token families for `unistyles.ts` — `--temp-*` (8 thermometer stops, `#7FA3D9` cold → `#D65A3C` ember), `--ink-*` (5 event inks: rain / sun / moon / storm / bone), `--pane-*` (12 condition panes). Four laws: pane owns the condition, figures own the readings, ≤3 hues/card, hue never the only carrier. Warm-on-warm solved by pinned lightness. Generalizes to Claude (spend on the thermometer) and Linear (warms only on a breach). |

**The law is a theme axis:** **Signature** (this, the default) / **Monochrome** (the roles collapse to bone; today's build) / a future **Per-service** theme — built against color *roles* so a theme is a token remap, not a redesign. Calendar's imminence ladder (`--when-*`) is the same thermometer read as time. Prompts in [`prompts/`](prompts/): `weather-color.md`, `calendar.md`.

## Re-rendering a PDF for analysis

The single tall page downsamples when opened whole. To read the detail, render at 150 DPI and slice into
horizontal bands (requires `poppler` / `pdftoppm`):

```sh
pdftoppm -r 150 -x 0 -y <yOffset> -W 2629 -H 1650 -png -f 1 -l 1 "Vela - Many Skies.pdf" band
```

## Related docs

- [`docs/specs/vela-experience-brief.md`](../docs/specs/vela-experience-brief.md) — the problem brief that seeded the pivot.
- [`docs/specs/vela-DESIGN.md`](../docs/specs/vela-DESIGN.md) — the design-system source of truth fed to Claude Design.
- [`docs/specs/design-redesign-brief.md`](../docs/specs/design-redesign-brief.md) — the original per-surface handoff brief.
- [`docs/specs/app-ia.md`](../docs/specs/app-ia.md) — the 14-surface information architecture the redesign is mapped against.
