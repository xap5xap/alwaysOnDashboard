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
