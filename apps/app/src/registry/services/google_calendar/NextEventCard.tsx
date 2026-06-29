// The "Next Event" leaf renderer (AOD-8 §6.1, integration-calendar.md §4.1, design-calendar-weather.md
// §7). Reached only on data-bearing lifecycle states (fresh / stale / error-with-data); the generic host
// draws every other state's chrome. It receives only { data, config, size } and never branches on auth,
// loading, or errors. Relative times are computed against the DEVICE clock (§4).
//
// AOD-35 polish: the WHEN leads, the title is the value. The relative time is the emphasized figure (an
// accent, uppercased kicker), with the clock time riding alongside it muted; the title is type.title. An
// all-day event has no time anchor, so its kicker reads "ALL DAY" with no clock. At small (the 1x1 glance,
// header suppressed by the host) the body is the kicker over a 2-line title, no clock, no location. The
// empty render (hasEvent:false, a normal empty-window result, not an error) is the shared §5.1 EmptyBody
// with the per-widget calendar glyph -- a calm "Nothing next", carrying NO action.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CalendarEvent, NextEventData } from './types';
import { EmptyBody } from '../../../widgets/EmptyBody';
import { CalendarGlyph, PinGlyph } from './glyphs';

/** Defensive read: anything that is not a well-formed event renders as the empty "Nothing next" state. */
function asNextEventData(data: unknown): NextEventData {
  const d = data as { hasEvent?: unknown; event?: unknown } | null | undefined;
  if (d?.hasEvent === true && d.event && typeof d.event === 'object') {
    return { hasEvent: true, event: d.event as CalendarEvent };
  }
  return { hasEvent: false };
}

/** A glanceable "when" label against the device clock (integration-calendar.md §4); the style uppercases it. */
function formatWhen(event: CalendarEvent, now: Date): string {
  if (event.allDay) return 'All day';
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return '';
  const diffMin = Math.round((start.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return 'Now';
  if (diffMin < 60) return `in ${diffMin} min`;
  if (diffMin < 24 * 60) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  return start.toLocaleDateString(undefined, { weekday: 'short' });
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

  if (!next.hasEvent) {
    // §5.1 empty body: a calm "Nothing next" with the calendar glyph, no action (nothing is wrong).
    return (
      <View style={styles.fill} testID="gcal-next-event-empty">
        <EmptyBody
          line="Nothing next"
          subline="You're clear"
          glyph={<CalendarGlyph color={theme.colors.accent} />}
        />
      </View>
    );
  }

  const { event } = next;
  const isSmall = size === 'small';
  const when = formatWhen(event, new Date());
  const clock = formatClock(event);

  return (
    <View style={styles.body} accessibilityRole="summary" testID="gcal-next-event">
      {/* The when emphasis: an accent uppercased kicker; at medium the muted clock rides alongside. */}
      <View style={styles.whenLine}>
        <Text style={styles.when} testID="gcal-next-event-when">
          {when}
        </Text>
        {!isSmall && clock ? <Text style={styles.clock}>{`·  ${clock}`}</Text> : null}
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
  fill: { flex: 1 },
  body: { gap: theme.spacing(1) },
  whenLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) },
  // The kicker maps to type.label (the named scale step is 13/600; the AOD-35 §7 annotation says
  // 13/700 -- flagged as a tiny follow-up, mapped to the step here), accent, uppercased.
  when: { ...theme.type.label, color: theme.colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  clock: { ...theme.type.label, color: theme.colors.textMuted },
  title: { ...theme.type.title, color: theme.colors.text },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  location: { ...theme.type.meta, color: theme.colors.textMuted, flexShrink: 1 },
}));
