// The Dressed Overall imminence ladder (AOD-136; design-color-law.md §6, claude-design/prompts/calendar.md
// "Dressed Overall"). The pure, React-free half the two Calendar leaves compose: an event's TIME-TO-EVENT
// mapped onto the theme.when 6-stop warmth ladder, so every event's time numeral "wears its imminence"
// (dawn-cool far -> balmy at Now, capped at balmy — never ember, because theme.when itself stops at balmy).
// Kept out of the leaf so the mapping is unit-testable and so the colour work stays a pure function of the
// theme's ROLE values (the leaf reads theme.when[stop], never a literal hex): in Monochrome every when-stop
// collapses to bone, so the whole ladder renders bone for free (§8 theme axis). All-day events do NOT ride
// the ladder — they get the §6 dawn chip in the leaf; asked for a stop anyway, they park at the calm
// `distant` end (minutesUntilStart returns null for them, and null -> distant).
import type { CalendarEvent } from './types';

/** The theme.when imminence stops, cool -> warm (distant = dawn-cool, now = balmy: the warmest a meeting gets). */
export type ImminenceStop = 'distant' | 'far' | 'approaching' | 'near' | 'soon' | 'now';

/**
 * Whole minutes from `now` to a TIMED event's start (negative once it has begun). `null` when there is no
 * time anchor to measure against — an all-day event (start is a bare "YYYY-MM-DD", no time), a missing
 * start, or an unparseable one — so a caller degrades to the calm end instead of blending against a bogus
 * delta. Rounds like formatWhen so the two agree at the boundaries (the hue never disagrees with the text).
 */
export function minutesUntilStart(event: CalendarEvent, now: Date): number | null {
  if (event.allDay) return null;
  const t = new Date(event.start).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / 60000);
}

/**
 * The theme.when stop an event's time numeral wears, from its minutes-to-start. The thresholds ARE the
 * frozen truth (the PDF's "~3h / ~90m / ..." anchors are approximate; each anchor lands at the cool edge
 * of its band below):
 *   now          diff < 20     (<=~20m, happening now, or already begun / past)
 *   soon      20 <= diff < 60  (~20m)
 *   near      60 <= diff < 90  (~60m)
 *   approaching 90 <= diff < 180 (~90m)
 *   far      180 <= diff < 360  (~3h)
 *   distant    diff >= 360      (>=6h; every next-DAY event lands here in practice, so "next-day -> distant"
 *                                falls out of the threshold with no separate calendar-day branch, and the
 *                                hue stays consistent with NextEvent's own "in Nh" / weekday kicker text)
 * A bad / NaN / missing / all-day start (minutesUntilStart -> null) parks at the calm `distant` end and
 * never crashes. Purely time-to-event: a past / in-progress event is warmest (`now`), the design's read of
 * "the soonest or happening-now event warmest" (§6).
 */
export function imminenceStop(event: CalendarEvent, now: Date): ImminenceStop {
  const diff = minutesUntilStart(event, now);
  if (diff == null) return 'distant';
  if (diff < 20) return 'now';
  if (diff < 60) return 'soon';
  if (diff < 90) return 'near';
  if (diff < 180) return 'approaching';
  if (diff < 360) return 'far';
  return 'distant';
}
