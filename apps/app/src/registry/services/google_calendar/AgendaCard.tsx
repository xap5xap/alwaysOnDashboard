// The "Today's Agenda" leaf renderer (AOD-8 §6.1, integration-calendar.md §4.2, design-calendar-weather.md
// §8). Reached only on data-bearing lifecycle states; the host draws every other state. Receives only
// { data, config, size }. The server returns a coarse now -> now+~36h window; THIS renderer scopes events
// to the current device-local day, because the "today" boundary depends on the device clock + timezone,
// which live on the device (§4.2, §6.4).
//
// AOD-136 Dressed Overall: every TIMED event's time numeral wears its OWN imminence on the theme.when
// ladder (dawn-cool far -> balmy at Now), so the list reads as a warmth spread — the soonest is warmest,
// the far ones cool — and that warmth, not an accent, now points at "next" (the AOD-35 accent LEFT RAIL +
// accent time are REMOVED; accent is reserved for repair chrome, drawn by the host). All-day events do NOT
// ride the ladder: they group on top in a calm DAWN-WASH chip (theme.when.distant at low opacity + dawn
// ink). Binds to ROLES only, so Monochrome collapses every time to bone (§8).
//
// AOD-35 polish: one event list, three densities. All-day events have no time anchor, so they group at the
// top (separated by a hairline). At M (1x2; the old tall) a deep column of
// 2-line rows; at W (2x1; the banner layout the retired 3x1 wide slot wore pre-AOD-122) event cells laid
// left to right; at L (a coerced class, §9) single-line rows with a location on a second line. Overflow
// folds into "+N more". The empty render (no events left today, a normal state, not an error) is now the
// host-drawn `empty` lifecycle phase (AOD-125, isAgendaEmpty), not a leaf body.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import type { AgendaData, CalendarEvent } from './types';
import { fitCount } from '../../../widgets/fitLadder';
import { imminenceStop } from './imminence';

// AOD-136 Dressed Overall: the all-day DAWN-WASH chip intensity. The calm all-day band sits on a faint
// wash of the dawn tone (theme.when.distant, the coolest imminence stop) laid as an absolute fill at this
// opacity so the ink over it stays crisp. Leaf-scoped numbers-only constant (the reuse-the-role + inline-
// opacity path, §new-token) — it adds NO theme token, and since it reuses theme.when.distant it collapses
// to a faint bone wash in Monochrome for free.
const DAWN_CHIP_OPACITY = 0.12;

// The pre-AOD-123 fixed per-size counts. AOD-122 remap: M (1x2) kept the old tall 10; W (2x1) 5; L 8;
// S 4. AOD-123 keeps these only as the no-box fallback: the VERTICAL layouts (M deep column, L rows) now
// derive the count from the box HEIGHT (fitCount) so a short cell never overflows — 10 two-line rows in a
// 144px M body was ~400px and clipped. The W BANNER strip stays count-based: it distributes cells across
// the WIDTH, so its budget is horizontal, not the height fitCount governs (a narrow-strip width-fit is an
// M4 follow-up, flagged).
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = { S: 4, M: 10, W: 5, L: 8 };

// Row-fit chrome for the vertical Agenda layouts (DP, conservative): M is a 2-line row (time over title),
// L a single-line row; both shed into "+N more".
const ROW_HEIGHT_BY_SIZE: Partial<Record<WidgetSize, number>> = { M: 42, L: 26 };

/** Defensive read: a renderer must never crash on a partial payload (host shows an empty card instead). */
function asAgendaData(data: unknown): AgendaData {
  const d = data as Partial<AgendaData> | null | undefined;
  return { events: Array.isArray(d?.events) ? (d!.events as CalendarEvent[]) : [] };
}

/** Parse an all-day "YYYY-MM-DD" as a LOCAL date, not UTC, so the device-local day boundary is correct. */
function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whether an event's start falls on the current device-local day (integration-calendar.md §4.2). */
function startsToday(event: CalendarEvent, now: Date): boolean {
  const start = event.allDay ? parseLocalYmd(event.start) : new Date(event.start);
  if (!start || Number.isNaN(start.getTime())) return false;
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}

/** AOD-125 emptiness predicate (WidgetDefinition.isEmpty): NO events start on the device-local day. `now` is
 *  epoch ms (deriveViewState passes it so the predicate stays pure). Emptiness is the "today"-scoped count —
 *  the same filter the render applies — never events.length, because the server's coarse now->now+~36h window
 *  can still hold tomorrow's events. Empty "today" -> the host-drawn empty phase; the leaf no longer draws it. */
export function isAgendaEmpty(data: unknown, now: number): boolean {
  const today = new Date(now);
  return !asAgendaData(data).events.some((e) => startsToday(e, today));
}

/** Clock time for a timed event, or "All day" for an all-day one. */
function formatClock(event: CalendarEvent): string {
  if (event.allDay) return 'All day';
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return '';
  return start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function AgendaCard({ data, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { events } = asAgendaData(data);
  const now = new Date();
  const today = events.filter((e) => startsToday(e, now));

  // AOD-125: an empty "today" is now the host-drawn `empty` phase (isAgendaEmpty), so the leaf is reached
  // only with events. The guard remains for crash-safety across a host/leaf now-skew and draws nothing.
  if (today.length === 0) return null;

  // All-day grouped on top; timed sorted ascending below.
  const allDay = today.filter((e) => e.allDay);
  const timed = today
    .filter((e) => !e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // AOD-136: each TIMED event's time numeral wears its own imminence (theme.when[stop], bound to the ROLE);
  // the all-day band parks at the calm dawn tone. `distant` (the coolest stop) is the dawn ink for the
  // all-day label + "All day" time text and the tone of the all-day chip wash.
  const timeColor = (e: CalendarEvent) => theme.when[imminenceStop(e, now)];
  const dawnInk = theme.when.distant;

  const ordered = [...allDay, ...timed];
  // AOD-123: the vertical layouts (M / L) count by HEIGHT so a short cell never overflows; the W banner
  // strip stays width-budgeted on the fixed count. Falls back to the fixed count on a direct render.
  const rowHeight = ROW_HEIGHT_BY_SIZE[size];
  const visibleCount =
    box && rowHeight != null
      ? fitCount(ordered.length, box.height, { rowHeight, gap: theme.spacing(1.5), footerHeight: 20 })
      : (VISIBLE_BY_SIZE[size] ?? 6);
  const visible = ordered.slice(0, visibleCount);
  const remaining = ordered.length - visible.length;
  const visibleAllDay = visible.filter((e) => e.allDay);
  const visibleTimed = visible.filter((e) => !e.allDay);
  const titleOf = (e: CalendarEvent) => e.summary || '(No title)';

  // W (2x1): a banner of event cells laid left to right, time over title, hairline dividers between. Each
  // timed time wears its imminence; an all-day cell's "All day" reads in the calm dawn ink (no chip wash in
  // the compact strip — the dawn ink is the calm signal). The next-event rail is gone (the warmth carries it).
  if (size === 'W') {
    return (
      <View style={styles.wideStrip} accessibilityRole="summary" testID="gcal-agenda">
        {visible.map((e, i) => (
          <View key={e.id} style={[styles.wideCell, i > 0 && styles.cellBorder]}>
            <View style={styles.cellText}>
              <Text
                style={[styles.time, { color: e.allDay ? dawnInk : timeColor(e) }]}
                numberOfLines={1}
                testID={e.allDay ? undefined : 'gcal-agenda-time'}
              >
                {formatClock(e)}
              </Text>
              <Text style={styles.evt} numberOfLines={1}>
                {titleOf(e)}
              </Text>
            </View>
          </View>
        ))}
        {remaining > 0 ? (
          <View style={[styles.wideCell, styles.cellBorder, styles.moreCell]}>
            <Text style={styles.more} testID="gcal-agenda-more">
              +{remaining} more
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  // M (1x2): a deep column of 2-line rows (time over title); all-day grouped on top in the dawn-wash chip.
  if (size === 'M') {
    return (
      <View style={styles.list} accessibilityRole="summary" testID="gcal-agenda">
        {visibleAllDay.length > 0 ? (
          <View style={styles.allDayChip} testID="gcal-agenda-allday">
            <View
              style={[styles.chipWash, { backgroundColor: dawnInk, opacity: DAWN_CHIP_OPACITY, pointerEvents: 'none' }]}
              testID="gcal-agenda-allday-wash"
            />
            <Text style={[styles.groupLabel, { color: dawnInk }]}>ALL DAY</Text>
            {visibleAllDay.map((e) => (
              <Text key={e.id} style={styles.evt} numberOfLines={1}>
                {titleOf(e)}
              </Text>
            ))}
          </View>
        ) : null}
        {visibleAllDay.length > 0 && visibleTimed.length > 0 ? <View style={styles.divider} /> : null}
        {visibleTimed.map((e) => (
          <View key={e.id} style={styles.tallRowText}>
            <Text style={[styles.time, { color: timeColor(e) }]} numberOfLines={1} testID="gcal-agenda-time">
              {formatClock(e)}
            </Text>
            <Text style={styles.evt} numberOfLines={1}>
              {titleOf(e)}
            </Text>
          </View>
        ))}
        {remaining > 0 ? (
          <Text style={styles.more} testID="gcal-agenda-more">
            +{remaining} more
          </Text>
        ) : null}
      </View>
    );
  }

  // L (2x2, a coerced class) and any other size: single-line rows with a 2nd location line. All-day rows
  // sit in the dawn-wash chip on top (dawn-ink "All day"); each timed time wears its imminence. No rail.
  return (
    <View style={styles.list} accessibilityRole="summary" testID="gcal-agenda">
      {visibleAllDay.length > 0 ? (
        <View style={styles.allDayChip} testID="gcal-agenda-allday">
          <View
            style={[styles.chipWash, { backgroundColor: dawnInk, opacity: DAWN_CHIP_OPACITY, pointerEvents: 'none' }]}
            testID="gcal-agenda-allday-wash"
          />
          {visibleAllDay.map((e) => (
            <View key={e.id} style={styles.largeRow}>
              <Text style={[styles.timeCol, { color: dawnInk }]} numberOfLines={1}>
                {formatClock(e)}
              </Text>
              <Text style={[styles.evt, styles.largeEvt]} numberOfLines={1}>
                {titleOf(e)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {visibleAllDay.length > 0 && visibleTimed.length > 0 ? <View style={styles.divider} /> : null}
      {visibleTimed.map((e) => (
        <View key={e.id} style={styles.largeRow}>
          <Text style={[styles.timeCol, { color: timeColor(e) }]} numberOfLines={1} testID="gcal-agenda-time">
            {formatClock(e)}
          </Text>
          <View style={styles.largeRowText}>
            <Text style={styles.evt} numberOfLines={1}>
              {titleOf(e)}
            </Text>
            {e.location ? (
              <Text style={styles.loc} numberOfLines={1}>
                {e.location}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      {remaining > 0 ? (
        <Text style={styles.more} testID="gcal-agenda-more">
          +{remaining} more
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(1.5) },

  // AOD-136 the all-day DAWN-WASH chip (M/L): the calm all-day band, grouped on top. The dawn tone
  // (theme.when.distant) rides in as a faint absolute FILL (chipWash) under the group so the ink over it
  // stays crisp; the container clips the wash to the rounded chip. Reuses existing tokens only (no colour).
  allDayChip: {
    position: 'relative',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  chipWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // the all-day group label (M): a quiet kicker; the dawn-ink COLOUR is applied inline.
  groupLabel: { ...theme.type.badge },
  divider: { height: 1, backgroundColor: theme.colors.border },

  // time + title shared steps. AOD-136: the time numeral's COLOUR is applied INLINE per event — the
  // theme.when[stop] imminence hue for a timed event, the dawn ink for an all-day "All day" — so it wears
  // the Dressed Overall warmth (the old flat-muted base + accent `timeNext` override are gone).
  time: { ...theme.type.meta, fontVariant: ['tabular-nums'] },
  evt: { ...theme.type.body, color: theme.colors.text },
  more: { ...theme.type.meta, color: theme.colors.textMuted, paddingTop: theme.spacing(0.5) },

  // M: 2-line rows (time over title). AOD-136 removed the accent left rail, so the row is just the stack.
  tallRowText: { flexShrink: 1, gap: theme.spacing(0.25) },

  // W: event cells left to right
  wideStrip: { flexDirection: 'row', alignItems: 'stretch', flex: 1 },
  wideCell: { flex: 1, paddingRight: theme.spacing(2) },
  cellBorder: { borderLeftWidth: 1, borderLeftColor: theme.colors.border, paddingLeft: theme.spacing(2) },
  cellText: { flexShrink: 1, gap: theme.spacing(0.25) },
  moreCell: { alignItems: 'center', justifyContent: 'center', flexGrow: 0, flexBasis: 72 },

  // L: single-line rows, location on a 2nd line
  largeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  timeCol: { ...theme.type.meta, fontVariant: ['tabular-nums'], width: 64 },
  largeRowText: { flexShrink: 1, gap: theme.spacing(0.25) },
  largeEvt: { flexShrink: 1 },
  loc: { ...theme.type.caption, letterSpacing: 0, color: theme.colors.textMuted },
}));
