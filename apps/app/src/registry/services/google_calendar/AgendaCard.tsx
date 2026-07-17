// The "Today's Agenda" leaf renderer (AOD-8 §6.1, integration-calendar.md §4.2, design-calendar-weather.md
// §8). Reached only on data-bearing lifecycle states; the host draws every other state. Receives only
// { data, config, size }. The server returns a coarse now -> now+~36h window; THIS renderer scopes events
// to the current device-local day, because the "today" boundary depends on the device clock + timezone,
// which live on the device (§4.2, §6.4).
//
// AOD-35 polish: one event list, three densities. All-day events have no time anchor, so they group at the
// top (separated by a hairline); the soonest upcoming event is the agenda's one emphasis (an accent LEFT
// RAIL + an accent time), so the list points at what is next. At M (1x2; the old tall) a deep column of
// 2-line rows; at W (2x1; the banner layout the retired 3x1 wide slot wore pre-AOD-122) event cells laid
// left to right; at L (a coerced class, §9) single-line rows with a location on a second line. Overflow
// folds into "+N more". The empty render (no events left today, a normal state, not an error) is the
// shared §5.1 EmptyBody with the per-widget calendar glyph, no action.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import type { AgendaData, CalendarEvent } from './types';
import { EmptyBody } from '../../../widgets/EmptyBody';
import { CalendarGlyph } from './glyphs';

// How many rows fit a glance at each slot; the rest collapse into a "+N more" footer. AOD-122 remap:
// M (1x2) keeps the old tall 10; W (2x1) keeps 5 (the old medium and the retired wide agreed on 5);
// L the old large 8; S the old small 4 (defensive — S is not a declared Agenda size).
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = { S: 4, M: 10, W: 5, L: 8 };

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

/** Clock time for a timed event, or "All day" for an all-day one. */
function formatClock(event: CalendarEvent): string {
  if (event.allDay) return 'All day';
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return '';
  return start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function AgendaCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { events } = asAgendaData(data);
  const now = new Date();
  const today = events.filter((e) => startsToday(e, now));

  if (today.length === 0) {
    // §5.1 empty body: a calm "Nothing left today" with the calendar glyph, no action.
    return (
      <View style={styles.fill} testID="gcal-agenda-empty">
        <EmptyBody
          line="Nothing left today"
          subline="Enjoy the quiet"
          glyph={<CalendarGlyph color={theme.colors.accent} />}
        />
      </View>
    );
  }

  // All-day grouped on top; timed sorted ascending below; the soonest upcoming timed event is "next".
  const allDay = today.filter((e) => e.allDay);
  const timed = today
    .filter((e) => !e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const nowMs = now.getTime();
  const nextId = timed.find((e) => new Date(e.start).getTime() >= nowMs)?.id;

  const ordered = [...allDay, ...timed];
  const visible = ordered.slice(0, VISIBLE_BY_SIZE[size] ?? 6);
  const remaining = ordered.length - visible.length;
  const visibleAllDay = visible.filter((e) => e.allDay);
  const visibleTimed = visible.filter((e) => !e.allDay);
  const titleOf = (e: CalendarEvent) => e.summary || '(No title)';

  // W (2x1): a banner of event cells laid left to right, time over title, hairline dividers between.
  if (size === 'W') {
    return (
      <View style={styles.wideStrip} accessibilityRole="summary" testID="gcal-agenda">
        {visible.map((e, i) => {
          const isNext = e.id === nextId;
          return (
            <View key={e.id} style={[styles.wideCell, i > 0 && styles.cellBorder]}>
              <View
                style={[styles.rail, isNext && styles.railActive]}
                testID={isNext ? 'gcal-agenda-next-rail' : undefined}
              />
              <View style={styles.cellText}>
                <Text style={[styles.time, isNext && styles.timeNext]} numberOfLines={1}>
                  {formatClock(e)}
                </Text>
                <Text style={styles.evt} numberOfLines={1}>
                  {titleOf(e)}
                </Text>
              </View>
            </View>
          );
        })}
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

  // M (1x2): a deep column of 2-line rows (time over title); all-day grouped under a kicker on top.
  if (size === 'M') {
    return (
      <View style={styles.list} accessibilityRole="summary" testID="gcal-agenda">
        {visibleAllDay.length > 0 ? (
          <View style={styles.allDayGroup}>
            <Text style={styles.groupLabel}>ALL DAY</Text>
            {visibleAllDay.map((e) => (
              <Text key={e.id} style={styles.evt} numberOfLines={1}>
                {titleOf(e)}
              </Text>
            ))}
          </View>
        ) : null}
        {visibleAllDay.length > 0 && visibleTimed.length > 0 ? <View style={styles.divider} /> : null}
        {visibleTimed.map((e) => {
          const isNext = e.id === nextId;
          return (
            <View key={e.id} style={styles.tallRow}>
              <View
                style={[styles.rail, isNext && styles.railActive]}
                testID={isNext ? 'gcal-agenda-next-rail' : undefined}
              />
              <View style={styles.tallRowText}>
                <Text style={[styles.time, isNext && styles.timeNext]} numberOfLines={1}>
                  {formatClock(e)}
                </Text>
                <Text style={styles.evt} numberOfLines={1}>
                  {titleOf(e)}
                </Text>
              </View>
            </View>
          );
        })}
        {remaining > 0 ? (
          <Text style={styles.more} testID="gcal-agenda-more">
            +{remaining} more
          </Text>
        ) : null}
      </View>
    );
  }

  // L (2x2, a coerced class) and any other size: single-line rows with a 2nd location line.
  return (
    <View style={styles.list} accessibilityRole="summary" testID="gcal-agenda">
      {visibleAllDay.map((e) => (
        <View key={e.id} style={styles.largeRow}>
          <View style={styles.rail} />
          <Text style={styles.timeCol} numberOfLines={1}>
            {formatClock(e)}
          </Text>
          <Text style={[styles.evt, styles.largeEvt]} numberOfLines={1}>
            {titleOf(e)}
          </Text>
        </View>
      ))}
      {visibleAllDay.length > 0 && visibleTimed.length > 0 ? <View style={styles.divider} /> : null}
      {visibleTimed.map((e) => {
        const isNext = e.id === nextId;
        return (
          <View key={e.id} style={styles.largeRow}>
            <View style={[styles.rail, isNext && styles.railActive]} />
            <Text style={[styles.timeCol, isNext && styles.timeNext]} numberOfLines={1}>
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
        );
      })}
      {remaining > 0 ? (
        <Text style={styles.more} testID="gcal-agenda-more">
          +{remaining} more
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  fill: { flex: 1 },
  list: { gap: theme.spacing(1.5) },

  // the next-event accent left rail (3px); transparent on every other row so titles still align
  rail: { width: 3, borderRadius: 1.5, alignSelf: 'stretch', backgroundColor: 'transparent' },
  railActive: { backgroundColor: theme.colors.accent },

  // all-day group (M): a quiet kicker over the all-day titles, then a hairline
  allDayGroup: { gap: theme.spacing(1) },
  groupLabel: { ...theme.type.badge, color: theme.colors.textMuted },
  divider: { height: 1, backgroundColor: theme.colors.border },

  // time + title shared steps; the next event's time is accent
  time: { ...theme.type.meta, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  timeNext: { color: theme.colors.accent },
  evt: { ...theme.type.body, color: theme.colors.text },
  more: { ...theme.type.meta, color: theme.colors.textMuted, paddingTop: theme.spacing(0.5) },

  // M: 2-line rows (style keys keep their pre-slot names; only the WidgetSize ids changed, AOD-122)
  tallRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  tallRowText: { flexShrink: 1, gap: theme.spacing(0.25) },

  // W: event cells left to right
  wideStrip: { flexDirection: 'row', alignItems: 'stretch', flex: 1 },
  wideCell: { flex: 1, flexDirection: 'row', gap: theme.spacing(1.5), paddingRight: theme.spacing(2) },
  cellBorder: { borderLeftWidth: 1, borderLeftColor: theme.colors.border, paddingLeft: theme.spacing(2) },
  cellText: { flexShrink: 1, gap: theme.spacing(0.25) },
  moreCell: { alignItems: 'center', justifyContent: 'center', flexGrow: 0, flexBasis: 72 },

  // L: single-line rows, location on a 2nd line
  largeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  timeCol: { ...theme.type.meta, color: theme.colors.textMuted, fontVariant: ['tabular-nums'], width: 64 },
  largeRowText: { flexShrink: 1, gap: theme.spacing(0.25) },
  largeEvt: { flexShrink: 1 },
  loc: { ...theme.type.caption, letterSpacing: 0, color: theme.colors.textMuted },
}));
