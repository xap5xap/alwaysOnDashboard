# Design: Vela long-press quick-actions menu

> The visual contract for the card long-press quick-actions menu (AOD-200). It restyles the [AOD-195](https://linear.app/thexap/issue/AOD-195) menu to the Vela bar; the menu's **behaviour and item set do not change** (AOD-195 owns those). Surfaced by the [AOD-190](https://linear.app/thexap/issue/AOD-190) device pass (2026-07-22, Fire HD 8), where the working menu read as unpolished ("quite ugly"). Design record: [`claude-design/Quick Actions Menu-selection-v2.png`](../../claude-design/Quick%20Actions%20Menu-selection-v2.png) (the locked v2 board). See [[aod-ui-redesign-pivot]].

> Status: **Locked 2026-07-23.** Direction chosen from two Claude Design rounds. v1 explored three directions (`1a` hairline / `1b` footprint glyphs / `1c` "Mirror"); v2 committed the merge Xavier picked, **`1c`'s chrome (icons, beak, local dim) × `1b`'s footprint size row**, and built it out (default, edit-hidden, night, states, edge-clamp). Two decisions taken at lock: the footprint **letter sits below the glyph** (v2 `2a`, safest at low DPI), and the **local focus dim is kept** (a conscious revision to the popover no-scrim rule, section 9). This doc fixes the contract; the build is a separate `type:tech-task`.

---

## 1. Purpose and scope

Long-pressing a placed card opens an anchored quick-actions menu at the touch point (the iPhone/iPad Home-Screen pattern). It works, but it renders in default primitive styling. This design fixes how it looks and how it seats on the card, nothing else.

**In scope (visual only):** the popover container (fill, elevation, radius, padding, min-width, the beak, the local dim, the pressed-card lift); the item rows (leading icons, typography, spacing, dividers, pressed and destructive states); the size row (the footprint-glyph picker, its selected and pressed states); the anchoring (position, beak, on-screen clamping, day and night).

**Out of scope (owned elsewhere):** the item set and when each item shows, the anchor math, the resize/persist path, and "the menu stays open on size select" are the [AOD-195](https://linear.app/thexap/issue/AOD-195) behaviour contract, honoured unchanged. The **"Remove?" delete confirm** the Delete row opens is [AOD-205](https://linear.app/thexap/issue/AOD-205). No registry / host / layout change; the [AOD-8](https://linear.app/thexap/issue/AOD-8) §10 seam holds (the menu names no service).

## 2. Locked context this builds on

- **The behaviour ([AOD-195](https://linear.app/thexap/issue/AOD-195), [`CardQuickActions.tsx`](../../apps/app/src/dashboard/CardQuickActions.tsx)).** Items, fixed: **Edit Widget** (only when the widget declares config fields), **Edit Screen** (always), **Delete Widget** (always), and a size row (only when the widget supports more than one size). Edit Widget opens the per-instance config sheet ([`design-dashboard-editor.md`](design-dashboard-editor.md) §7); Edit Screen enters Arrange (§4); Delete opens the [AOD-205](https://linear.app/thexap/issue/AOD-205) confirm; a size pick re-snaps immediately and the menu stays open. The anchor is the long-press point, clamped so the whole box stays on screen (`EDGE = 12`).
- **The primitives ([AOD-20](https://linear.app/thexap/issue/AOD-20), [`ui/Overlays.tsx`](../../apps/app/src/ui/Overlays.tsx)).** `Popover` (an anchored `elevation.overlay` surface, `radius.md`, items split by a 1px `border`, **no scrim**), `MenuItem` (a `type.body` label + optional accent check), and the [AOD-148](https://linear.app/thexap/issue/AOD-148) `Segmented`. This design restyles them; it does not invent a new control kit, with one named exception (the footprint picker, section 6 / section 9).
- **The color law ([`design-color-law.md`](design-color-law.md)).** The menu is **chrome, not data**: it wears no meaning-hue. The ink ramp carries the labels; the one blue accent is spent only on the selected size; red is spent only on Delete, as **ink, never a fill**.
- **The system ([`vela-DESIGN.md`](vela-DESIGN.md)).** Dark-first, emissive, no gradient / glow / shadow; elevation is a surface step plus a hairline. Target is the low-DPI Fire HD 8 plus phones, legible at a glance.

## 3. The direction, in one line

One committed menu: **leading thin-stroke icons on every row, Delete as red ink, a hairline beak at the touch point, a faint local dim that keeps only the pressed card and the menu lit, and a trackless footprint-glyph size row.** The card being edited lifts slightly; everything else recedes. It reads as the same product as the card faces and the shell, and it never competes with the data colour on the card under it.

## 4. The popover container

- **Surface and elevation.** `elevation.overlay` (`surfaceAlt` fill + 1px `border`), `radius.md` (14), `overflow: hidden` so rows and dividers clip to the corner. This is the shipped `Popover`, unchanged in kind.
- **Min-width.** `quickMenu.minWidth` 220 (the icon + label rows and the four-cell footprint row want more room than the 180 default).
- **The beak.** A small hairline beak (`quickMenu.beak`, 16 wide / 8 tall) on the edge facing the touch point, filled `surfaceAlt` with the 1px `border` continued along its two outer edges, so the menu reads as pinned to the card. It slides along its edge to stay pointed at the touch as the box is clamped (section 7). New vs the shipped `Popover` (which has no beak).
- **The local focus dim.** Behind the menu, a flat `quickMenu.dim` (black at ~0.40) covers the field and dims every card except the long-pressed one, which stays fully lit. This is softer than the modal `scrim` (0.60) and is the one deliberate revision to the popover no-scrim rule (section 9). Value to tune 0.35 to 0.50 on device (section 12).
- **The pressed-card lift.** The long-pressed card renders above the dim at `quickMenu.liftScale` (1.02) with a brightened hairline (border toward `textMuted`), the standard long-press "this is the one you grabbed" affordance. No shadow (the lift is scale + brightness, per the emissive rule). Compositing model for the build: paint the dim over the field, re-render the anchored card above it lifted, then the menu + beak above that (the iOS context-menu stack).

## 5. The item rows

- **Leading icons.** Each row carries a thin-stroke line glyph at `quickMenu.icon.size` 20, `quickMenu.icon.gap` 12 to the label, tone `textMuted`: a sliders/adjust glyph for **Edit Widget**, a two-pane layout glyph for **Edit Screen**, a circle-minus for **Delete Widget** (the icon takes the row's tone, so Delete's is `error`). Glyphs come from the app's existing line-glyph set; the build picks or authors the three.
- **Typography and metrics.** Label on the `type` scale (`body` 14/500, or `heading` 15/600 if we want the slightly bolder read; the build maps it to an existing token, it does not invent a size), colour `text`. Rows are `quickMenu.rowMinHeight` >= 48 (comfortable touch on the Fire HD 8), `paddingX` 16, split by the 1px `border` divider the `Popover` already draws.
- **Pressed.** The row fill steps down ~12% flat (the §4 pressed convention), no shadow, no motion beyond the fill.
- **The destructive Delete treatment.** Icon and label are `error` (red **ink**). Pressed keeps the **neutral** stepped-down fill, not a red one: Delete never floods red. This is the color-law rule made literal (red is a reading, not decoration) and the v2 "DESTRUCTIVE PRESSED, red ink, neutral fill" frame.

## 6. The footprint size picker

The size row is a **trackless row of footprint glyphs**, one per supported size, not the lettered `Segmented`. This is the "size of the widgets" read Xavier picked: the glyph shows what shape the widget becomes.

- **Glyphs.** Outline rounded-rects at a shared corner radius (3), proportioned to the real S/M/W/L slots: **S** 1×1 small square, **M** 1×2 tall, **W** 2×1 wide, **L** 2×2 large square. Correction from v2: **W is a wide rounded-rect, not a pill** (a pill read as a toggle; all four glyphs are one shape scaled). Unselected stroke `textMuted` 1.5.
- **Letter.** Below each glyph (locked: v2 `2a`), `type.caption` sizing, `textMuted` unselected. Kept as a backup label so size never rides on shape alone (the low-DPI glance floor, the color-law "never the only carrier" principle applied to shape).
- **Selected.** The current size's cell shows an `accentMuted` wash behind glyph + letter in a `radius.sm` container, the glyph outline `accent`, the letter `accent`. One selection at a time.
- **Pressed (pre-commit).** Pressing a different size lifts its ink (brightens) and commits on release; the resize applies and the menu stays open so the selection re-marks (AOD-195 behaviour). The v2 "SIZE PRESSED, ink lifts, commit on release" frame.
- **Subset.** A widget that supports a subset shows only those cells (Clock = S / W / L, no M), evenly spaced. The row is absent entirely for a single-size widget.
- **Trackless is the point.** Dropping the `Segmented` group track removes the surface-alt-on-surface-alt collision (the track fill equalled the popover fill); the glyphs need no track.

## 7. Anchoring, clamp, and night

- **Anchor and clamp.** Unchanged math (AOD-195): the box opens at the touch point and is nudged in so it never hangs off an edge, `EDGE = 12`. Near a corner it holds the 12 margin and stays fully on screen (v2 edge-clamp frame).
- **The beak follows.** The beak sits on the edge nearest the touch and slides along that edge (clamped within the corner radii) to keep pointing at the touch after the box is clamped. When the box flips above the touch (no room below), the beak moves to the bottom edge.
- **No persistent touch ring.** The ring in the v2 edge-clamp frame is an annotation, not UI; the beak + card lift are the anchor cues.
- **Night.** The menu keeps its **neutral `surfaceAlt` chrome and `text` labels** even on the night wall (it does not adopt the Clock's ember palette): it is a transient, touch-summoned overlay and its actions must stay legible. The blue selection and red Delete still read over the ember field. The local dim over an already-dark field wants the low end of the tuning range (section 12).

## 8. States (summary)

| State | Treatment | Source frame |
|---|---|---|
| Row pressed | Fill steps down ~12%, flat, no motion | v2 `2f` "ROW PRESSED" |
| Destructive pressed | Red ink stays, fill is neutral (never red) | v2 `2f` "DESTRUCTIVE PRESSED" |
| Size pressed | Glyph ink lifts; commit on release; menu stays open | v2 `2f` "SIZE PRESSED" |
| Selected size | `accentMuted` wash + `accent` outline + `accent` letter | v2 `2a` / `2c` |
| Edit-Widget hidden | Row absent; menu shorter; subset footprint row | v2 `2d` (Clock, S/W/L) |
| Night | Neutral chrome held; dim over the ember field | v2 `2e` |

## 9. What this revises (conscious changes, not drift)

- **The popover no-scrim rule gains one exception ([`vela-DESIGN.md`](vela-DESIGN.md) §4 / §6).** The quick-actions menu adds a **local focus dim** (`quickMenu.dim`, ~0.40). It is not a modal scrim: it is lighter than `scrim` (0.60), it hangs off the long-pressed card (which stays lit above it), and it answers the open question the AOD-200 brief named, whether a menu floating over a busy dashboard separates without help. Other popovers (the Theme picker) keep no scrim. Recorded here the way [`design-color-law.md`](design-color-law.md) §9 recorded its revisions, not slipped in.
- **The size row is a new control, not a `Segmented` restyle.** The trackless footprint picker (section 6) is a distinct control from the lettered `Segmented`, which stays as-is for its other call sites (the config sheet's `enum` size field, the Add gallery). The build adds a `FootprintSizePicker` (or a `Segmented variant="footprint"`); it does not repaint the existing `Segmented`. Unifying the Add-gallery size affordance with this glyph is a future seam (section 12), not this design's change.
- Unchanged and still binding: dark-first; no gradient / glow / shadow; one accent; red as ink only; the menu names no service.

## 10. Menu-scoped token additions (specified, not coded)

The menu composes mostly from existing roles (`elevation.overlay`, `popover.radius`, `border`, `text`, `textMuted`, `accent`, `accentMuted`, `error`, `radius.sm`, the `type` and `spacing` scales). Where it needs geometry the theme does not name, it adds one **menu-scoped component group**, numbers plus role-name aliases (never a hex), the way [AOD-21](https://linear.app/thexap/issue/AOD-21) added `appBar` / `screen`. Specified here, added to [`unistyles.ts`](../../apps/app/unistyles.ts) by the build.

| # | Addition | Kind | What it aliases / carries |
|---|---|---|---|
| 1 | `quickMenu` group | **Additive (component).** | `minWidth` 220 · `rowMinHeight` 48 · `rowPaddingX -> spacing(4)` · `icon` (`size` 20, `gap -> spacing(3)`, tone `-> textMuted`) · `destructive` (icon + label `-> error`; pressed fill stays the neutral pressed step) · `beak` (`w` 16, `h` 8, fill `-> elevation.overlay.surface`, edge `-> border`) · `dim -> rgba(0,0,0,0.40)` (the section 9 revision) · `liftScale` 1.02 (border brightens `-> textMuted`). Numbers + role names. |
| 2 | `quickMenu.footprint` sub-group | **Additive (component).** | Per-size glyph dims (S 14×14 · M 14×22 · W 24×14 · L 22×22), shared corner `3`, stroke `1.5 -> textMuted`; selected `fill -> accentMuted`, `outline -> accent`, `letter -> accent`; letter `-> type.caption` / `textMuted` below the glyph; cell touch `>= 44`, selected container `-> radius.sm`. Numbers + role names. |
| 3 | The pressed convention | **Composes, no new token.** | Row / glyph pressed = the §4 "fill darkens ~12%" step; reuse it, do not add a `pressed` colour. |

Typing safety (the `aod-unistyles-style-token-gotcha` note): `quickMenu` is numbers + role-name strings only; it references `type.caption` by role, it does not embed a `TextStyle` in the theme, so it does not reintroduce the deep-style typing flood.

## 11. Ownership and boundaries (named, not silent)

| Concern | Owner | Boundary |
|---|---|---|
| Item set, visibility rules, anchor math, "stays open on select" | [AOD-195](https://linear.app/thexap/issue/AOD-195) | This design restyles; it does not touch the behaviour. |
| The "Remove?" delete confirm the Delete row opens | [AOD-205](https://linear.app/thexap/issue/AOD-205) | This design styles the Delete **row** (red ink, neutral pressed fill); the confirm tile-face is AOD-205's. |
| The lettered `Segmented` | [AOD-148](https://linear.app/thexap/issue/AOD-148) | Stays for its other call sites; the footprint picker is additive (section 9). |
| Edit Widget destination (config sheet) | [`design-dashboard-editor.md`](design-dashboard-editor.md) §7 | The row opens the existing sheet; unchanged. |
| Edit Screen destination (Arrange) | [`design-dashboard-editor.md`](design-dashboard-editor.md) §4 | The row enters the existing arrange mode; unchanged. |

## 12. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| **The polish build** (apply this to [`CardQuickActions.tsx`](../../apps/app/src/dashboard/CardQuickActions.tsx); extend `MenuItem` with an icon slot + destructive tone; add the `FootprintSizePicker`; add the `Popover` beak; add the dim + lift compositing; add the `quickMenu` token group) | a `type:tech-task` | The visuals and the token are fixed here; the build implements them. |
| **The dim value + night verify** | the build / a device pass | Specified at 0.40; tune 0.35 to 0.50 on the Fire HD 8, and confirm the night frame (dim over the ember field) from across a dim room (the AOD-190 lineage). |
| **Phone-portrait check** | the build / device | Locked without a phone frame; the build verifies the menu + beak + four-cell row + clamp in a narrow column before it ships (not a redesign, a verification). |
| **Motion** (the long-press scale-in, the menu rise, the beak, the card lift timing) | the build | Named; exact timings are a build refinement, as [AOD-21](https://linear.app/thexap/issue/AOD-21) §10 left motion. |
| **The three line glyphs** (sliders / layout / circle-minus) | the build | From the existing glyph set; the build picks or authors them to the §5 tone. |
| **Footprint / Add-gallery unification** | future | The glyph could later replace the gallery's size affordance; named, not done, to keep AOD-200 scoped to the menu. |

## 13. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. **The container is fixed** (section 4): `elevation.overlay` + `radius.md` + `minWidth` 220, the hairline **beak**, the **local focus dim** (~0.40, the section 9 revision), and the **pressed-card lift** (1.02 + brightened hairline), no shadow.
> 2. **The item rows are fixed** (section 5): leading `textMuted` line icons (sliders / layout / circle-minus), `type`-scale labels, `rowMinHeight` >= 48, the ~12% pressed step, and **Delete as red ink on a neutral pressed fill** (never a red fill).
> 3. **The footprint size picker is fixed** (section 6): trackless S/M/W/L glyphs proportioned to the real slots (W corrected to a wide rounded-rect), the **letter below** (v2 `2a`), the `accentMuted` + `accent` selected state, the ink-lift-commit-on-release press, and the subset case (Clock S/W/L).
> 4. **Anchoring and night are fixed** (section 7): the `EDGE = 12` clamp, the beak that slides to point at the touch, no persistent ring, and the neutral chrome held over the night wall.
> 5. **The states are fixed** (section 8) and **the revisions are recorded** (section 9): the no-scrim exception and the footprint picker as a new control, not silent drift.
> 6. **The work is handed forward** (sections 10 to 12): the `quickMenu` token group is specified (not coded), the AOD-195 / AOD-205 / AOD-148 boundaries are drawn, and the dim-tune / phone / motion seams are left clean. No app code changed, no token coded. The **v2 board is the rendered record**.

| Acceptance clause | Where |
|---|---|
| Container: overlay + radius + minWidth, beak, dim, lift | Section 4 |
| Item rows: icons, type, pressed, red-ink Delete | Section 5 |
| Footprint picker: glyphs, letter-below, selected, press, subset | Section 6 |
| Anchoring, clamp, beak-follow, night | Section 7 |
| States + recorded revisions | Sections 8, 9 |
| `quickMenu` token; ownership; seams | Sections 10 to 12 |

## 14. References

- [AOD-200](https://linear.app/thexap/issue/AOD-200): this design's tracking issue (`type:design`, `area:app`, `from:dogfood`; project Redesign Build).
- [AOD-195](https://linear.app/thexap/issue/AOD-195) ([`CardQuickActions.tsx`](../../apps/app/src/dashboard/CardQuickActions.tsx)): the menu behaviour + item set this restyles. The direct upstream.
- [AOD-190](https://linear.app/thexap/issue/AOD-190): the device pass that flagged the unpolished look. The `from:dogfood` origin.
- [AOD-205](https://linear.app/thexap/issue/AOD-205): the sibling delete-confirm ("Remove?") tile-face this hands the Delete action to.
- [AOD-148](https://linear.app/thexap/issue/AOD-148): the `Segmented` size selector the footprint picker sits beside (and does not replace).
- [AOD-20](https://linear.app/thexap/issue/AOD-20) ([`design-component-library.md`](design-component-library.md), [`ui/Overlays.tsx`](../../apps/app/src/ui/Overlays.tsx)): `Popover` / `MenuItem` this restyles.
- [`design-color-law.md`](design-color-law.md): the chrome-not-data rule, red-as-ink, and the §9 revision-recording convention this follows.
- [`vela-DESIGN.md`](vela-DESIGN.md) / [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66) ([`unistyles.ts`](../../apps/app/unistyles.ts)): the roles, `elevation` ladder, `radius`, `type` / `spacing` scales the menu composes, and the theme the `quickMenu` group extends.
- [`design-dashboard-editor.md`](design-dashboard-editor.md): §4 Arrange (Edit Screen destination), §7 the per-instance config sheet (Edit Widget destination).
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
- Design record: [`claude-design/Quick Actions Menu-selection-v2.png`](../../claude-design/Quick%20Actions%20Menu-selection-v2.png) (locked v2 board), [`claude-design/Quick Actions Menu-selection.png`](../../claude-design/Quick%20Actions%20Menu-selection.png) (v1 three-direction exploration).
</content>
</invoke>
