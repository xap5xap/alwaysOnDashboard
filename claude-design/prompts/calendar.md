# Calendar card faces — the frozen palette (card-faces phase)

The fourth card-faces service (Clock → Weather → Linear → **Calendar** → Claude usage). A FRESH Claude Design chat in the Vela Design System project (which auto-applies the components / type / dark-first restraint). Designs Calendar's two cards from its REAL data, in the frozen Signature palette from Made Fast. Calendar carries color, drawn from imminence (Xavier's call 2026-07-12, overriding Made Fast's "a meeting isn't hot"); the pass explores HOW across both cards, not whether. See [[aod-ui-redesign-pivot]] and [`docs/specs/design-color-law.md`](../../docs/specs/design-color-law.md).

Real data audited from `apps/app/src/registry/services/google_calendar/*` + `integration-calendar.md`: per event = title, optional location, start/end, all-day flag; derived = a relative "when" (Now / in X min / in Xh / weekday) + a clock time; the app knows which event is next and which are today. Two cards: Next Event (one event or "Nothing next"), Today's Agenda (today's list, all-day grouped on top, the next one emphasized, "+N more", or "Nothing left today").

Reject list (NOT fetched — do not design with it): attendees / guests, RSVP, event description / notes, video or meeting links, organizer, recurring / repeat info, reminders, per-event color (Google's colorId is dropped in normalize), calendar color, free / busy, travel time, multiple calendars merged into one card.

Cross-cutting: Calendar's caption = which calendar (`CALENDAR · WORK`), continuing the per-widget caption strategy (none / place / project / calendar).

---

## The prompt (paste into a NEW chat in the Vela Design System project)

> The fourth in a series of card faces for **Vela**, a calm, dark-first, always-on dashboard glanced at from across a room and on a phone. The system (components, type, restraint) is already loaded. Design **Google Calendar's two cards**, from zero, using only the real data below and the color law we just froze for the whole app.
>
> **The two cards and their real data:**
> - **Next Event** (the glance): the single next upcoming event. You have its title, an optional location, its start time, and whether it is all-day. From the start the app derives a relative "when" (Now, in 20 min, in 3h, or a weekday) and a clock time (4:00 PM). Footprints: 1×1 (the bedside glance, no room for much) and 1×2. Its calm empty is "Nothing next / You're clear."
> - **Today's Agenda** (the list): today's events in order. All-day events group at the top; timed events sort ascending; the single soonest-upcoming event is the one emphasis. Overflow folds into "+N more." Footprints: 1×2 (a tall column of rows), 2×1 (a left-to-right banner of event cells), and 2×2 (rows with a location on a second line). Its calm empty is "Nothing left today / Enjoy the quiet."
> - Caption = which calendar (e.g. `CALENDAR · WORK`). Cover every state: live, the two calm empties, loading (a skeleton, never a spinner), stale, error, disconnected ("Connect Google Calendar"), and needs-a-calendar-chosen.
>
> **The color law (frozen, the same one Weather and the others obey):** color is meaning, never decoration. A figure wears a hue only when the hue IS a reading, and the numeral or label always sits beside it. Bone `#F4F4F8` is the default for anything with nothing to say. At most three hues on a card. No gradients, no glow, no shadow. **Calendar never wears a background pane. The pane belongs to Weather alone (it is the sky); every other card keeps the dark neutral field and lets its figures carry any color.**
>
> **Calendar carries color, and it comes from time.** Do not leave it a single bone color; a monochrome calendar reads as a dead spreadsheet on a wall, which is exactly what we are escaping. The reading Calendar owns is **imminence**, how soon a thing is, and it maps onto the same cool-to-warm family the rest of the app uses:
> - The soonest event, and anything **happening right now**, is the **warmest** (toward the sail's gold `#D9A458`); events further out cool through neutral to a distant blue. In an agenda this makes the list a quiet **timeline of warmth**: what is next glows, tonight recedes, so from across the room your eye lands on what is coming without reading a word.
> - **All-day** events have no time anchor, so they sit apart in a calm, cool band. A **clear day** ("Nothing left today") gets its own restful tone, a positive rather than a blank.
> This is one scale with many shades, so it does not spend the three-hue budget; it is the card's single honest reading wearing its color. Keep the clock time in numerals beside every warm mark, and Calendar still never wears a background pane (the pane is Weather's alone). Be genuinely colorful here, but every hue must be earned by how soon the thing is, never decoration. Explore how imminence reads across both cards and at every footprint, and give us a few directions to pick from.
>
> Keep everything the app established: dark-first, the hero value is the brightest thing on the card, real data only (Quito, a believable weekday), tabular figures so nothing jitters, on a phone and on the landscape wall, all footprints and all states presented as one system. Give us a few directions across Next Event and Agenda so we can see the range and pick. Surprise us.

---

## Follow-up (paste into the Ship's Bells chat)

Ship's Bells was run from an earlier version of this brief that offered a bone direction; the result (Dead Reckoning + a very restrained Landfall) argues for restraint, and Landfall is bone most of the day. We want the opposite. This follow-up keeps Landfall's mechanics and pushes it to the full timeline.

> Ship's Bells is beautiful, thank you. **Landfall is the direction, not Dead Reckoning** — we want the color. But we want to go the opposite way from the Late ramp: Calendar should feel colorful all day, never bone in the morning, while keeping everything you built (the `--when-*` ladder, the cap at balmy, the numerals beside every hue, one clear emphasis).
>
> Widen the ramp two ways:
> - **Color the whole agenda, not just the next event.** Every event's time wears its own proximity, so the list is a cool-to-warm spread from top to bottom, a real timeline of the day's shape.
> - **Give the far end a cool color, not bone.** Distant and morning events read a calm distant blue or teal, warming through neutral to the sail's gold as they approach, and balmy at Now. So even at 08:00 with nothing near, the card is a cool spread, never white.
>
> The soonest event is still the warmest, so "what's next" still pops from across the room. You keep the signal; we just stop letting the rest of the day fall to bone. And because far is now cool rather than warm, the card reads as a calm spectrum, not "chatty." Keep the cap at balmy (hot and ember stay Linear's breach and Claude's over-budget), the numerals beside every hue, at most the imminence scale plus a trouble dot, and never a pane. Add the calm cool band for all-day events and a restful tone for a clear day. Show it on **both** the morning wall (08:00, nothing near) and the afternoon wall (something at Now), so we can see it is colorful at 08:00, not only at 15:00.
