// The "Next Event" leaf renderer (AOD-8 §6.1, integration-calendar.md §4.1). Reached only on
// data-bearing lifecycle states (fresh / stale / error-with-data); the generic host draws every other
// state's chrome. It receives only { data, config, size } and never branches on auth, loading, or
// errors. Relative times are computed against the DEVICE clock (§4). Functional and on-brand-enough;
// the pixel polish is AOD-35.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CalendarEvent, NextEventData } from './types';

/** Defensive read: anything that is not a well-formed event renders as the empty "Nothing next" state. */
function asNextEventData(data: unknown): NextEventData {
  const d = data as { hasEvent?: unknown; event?: unknown } | null | undefined;
  if (d?.hasEvent === true && d.event && typeof d.event === 'object') {
    return { hasEvent: true, event: d.event as CalendarEvent };
  }
  return { hasEvent: false };
}

/** A glanceable "when" label against the device clock (integration-calendar.md §4). */
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

/** The clock time of a timed event (empty for all-day). */
function formatClock(event: CalendarEvent): string {
  if (event.allDay) return '';
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return '';
  return start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function NextEventCard({ data }: WidgetRenderProps) {
  const next = asNextEventData(data);

  if (!next.hasEvent) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Text style={styles.emptyText} testID="gcal-next-event-empty">
          Nothing next
        </Text>
      </View>
    );
  }

  const { event } = next;
  const when = formatWhen(event, new Date());
  const clock = formatClock(event);

  return (
    <View style={styles.body} accessibilityRole="summary" testID="gcal-next-event">
      <Text style={styles.when} testID="gcal-next-event-when">
        {clock && when ? `${when} · ${clock}` : clock || when}
      </Text>
      <Text style={styles.title} numberOfLines={2} testID="gcal-next-event-title">
        {event.summary || '(No title)'}
      </Text>
      {event.location ? (
        <Text style={styles.location} numberOfLines={1}>
          {event.location}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1) },
  empty: { paddingVertical: theme.spacing(2) },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  when: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  location: { color: theme.colors.textMuted, fontSize: 13 },
}));
