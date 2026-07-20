// The "Next Event" leaf renderer (AOD-8 §6.1, integration-calendar.md §4.1, design-calendar-weather.md
// §7). Reached only on data-bearing lifecycle states (fresh / stale / error-with-data); the generic host
// draws every other state's chrome. It receives only { data, config, size } and never branches on auth,
// loading, or errors. Relative times are computed against the DEVICE clock (§4).
//
// AOD-35 polish: the WHEN leads, the title is the value. The relative time is the emphasized figure (an
// accent, uppercased kicker), with the clock time riding alongside it muted; the title is type.title. An
// all-day event has no time anchor, so its kicker reads "ALL DAY" with no clock. At S (the 1x1 glance,
// header suppressed by the host) the body is the kicker over a 2-line title, no clock, no location. The
// empty render (hasEvent:false, a normal empty-window result, not an error) is now the host-drawn `empty`
// lifecycle phase (AOD-125, isNextEventEmpty), not a leaf body.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CalendarEvent, NextEventData } from './types';
import { PinGlyph } from './glyphs';
import { imminenceStop, minutesUntilStart } from './imminence';

/** Defensive read: anything that is not a well-formed event reads as no-event (the host draws the empty). */
function asNextEventData(data: unknown): NextEventData {
  const d = data as { hasEvent?: unknown; event?: unknown } | null | undefined;
  if (d?.hasEvent === true && d.event && typeof d.event === 'object') {
    return { hasEvent: true, event: d.event as CalendarEvent };
  }
  return { hasEvent: false };
}

/** AOD-125 emptiness predicate (WidgetDefinition.isEmpty): nothing upcoming (hasEvent:false) -> the
 *  host-drawn empty phase. A normal empty-window result, not an error; the leaf no longer self-draws it. */
export function isNextEventEmpty(data: unknown): boolean {
  return !asNextEventData(data).hasEvent;
}

/** A glanceable "when" label against the device clock (integration-calendar.md §4); the style uppercases it.
 *  Shares the delta with the Dressed Overall hue (minutesUntilStart), so the kicker TEXT and its imminence
 *  COLOUR are computed off the same number and never disagree at a boundary. */
function formatWhen(event: CalendarEvent, now: Date): string {
  if (event.allDay) return 'All day';
  const diffMin = minutesUntilStart(event, now);
  if (diffMin == null) return ''; // an unparseable start (NaN); minutesUntilStart guards it
  if (diffMin <= 0) return 'Now';
  if (diffMin < 60) return `in ${diffMin} min`;
  if (diffMin < 24 * 60) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  return new Date(event.start).toLocaleDateString(undefined, { weekday: 'short' });
}

/** The clock time of a timed event (empty for all-day; an all-day event has no time anchor). */
function formatClock(event: CalendarEvent): string {
  if (event.allDay) return '';
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return '';
  return start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function NextEventCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const next = asNextEventData(data);

  // AOD-125: hasEvent:false is now the host-drawn `empty` phase (isNextEventEmpty), so the leaf is reached
  // only with an event. The guard remains for type-narrowing (and crash-safety) and draws nothing.
  if (!next.hasEvent) return null;

  const { event } = next;
  const isSmall = size === 'S'; // AOD-122 slot id (was 'small'; same 1x1 geometry)
  const now = new Date();
  const when = formatWhen(event, now);
  const clock = formatClock(event);
  // AOD-136 Dressed Overall: the when kicker WEARS its imminence on the theme.when ladder (replacing the
  // flat accent) — dawn-cool far, balmy at Now; an all-day event has no time anchor, so imminenceStop parks
  // it at the calm dawn tone (`distant`). Binds to the ROLE, so Monochrome collapses it to bone (§8).
  const whenColor = theme.when[imminenceStop(event, now)];

  return (
    <View style={styles.body} accessibilityRole="summary" testID="gcal-next-event">
      {/* The when emphasis: an uppercased kicker wearing its imminence hue; at W the bone clock rides
          alongside (the hue rides the kicker alone — the clock numeral stays bone). */}
      <View style={styles.whenLine}>
        <Text style={[styles.when, { color: whenColor }]} testID="gcal-next-event-when">
          {when}
        </Text>
        {!isSmall && clock ? (
          <Text style={styles.clock} testID="gcal-next-event-clock">{`·  ${clock}`}</Text>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2} testID="gcal-next-event-title">
        {event.summary || '(No title)'}
      </Text>

      {!isSmall && event.location ? (
        <View style={styles.locationLine}>
          <PinGlyph color={theme.colors.textMuted} />
          <Text style={styles.location} numberOfLines={1}>
            {event.location}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1) },
  whenLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  // The kicker maps to type.label (the named scale step is 13/600; the AOD-35 §7 annotation says
  // 13/700 -- flagged as a tiny follow-up, mapped to the step here), uppercased. AOD-136: the COLOUR is now
  // applied inline (theme.when[stop] — the Dressed Overall imminence hue), no longer a flat accent here.
  when: { ...theme.type.label, textTransform: 'uppercase', letterSpacing: 0.5 },
  clock: { ...theme.type.label, color: theme.colors.textMuted },
  title: { ...theme.type.title, color: theme.colors.text },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  location: { ...theme.type.meta, color: theme.colors.textMuted, flexShrink: 1 },
}));
