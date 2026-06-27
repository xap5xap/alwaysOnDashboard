// The "Today's Agenda" leaf renderer (AOD-8 §6.1, integration-calendar.md §4.2). Reached only on
// data-bearing lifecycle states; the host draws every other state. Receives only { data, config, size }.
// The server returns a coarse now -> now+~36h window; THIS renderer scopes events to the current
// device-local day, because the "today" boundary depends on the device clock + timezone, which live on
// the device (§4.2, §6.4). Functional and on-brand-enough; pixel polish is AOD-35.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import type { AgendaData, CalendarEvent } from './types';

// How many rows fit a glance at each size; the rest collapse into a "+N more" footer.
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = {
  small: 4,
  medium: 5,
  wide: 5,
  large: 8,
  tall: 10,
};

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
  const { events } = asAgendaData(data);
  const now = new Date();
  const today = events.filter((e) => startsToday(e, now));
  const visible = today.slice(0, VISIBLE_BY_SIZE[size] ?? 6);
  const remaining = today.length - visible.length;

  if (today.length === 0) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Text style={styles.emptyText} testID="gcal-agenda-empty">
          Nothing left today
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list} accessibilityRole="summary" testID="gcal-agenda">
      {visible.map((event) => (
        <View key={event.id} style={styles.row}>
          <Text style={styles.time} numberOfLines={1}>
            {formatClock(event)}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {event.summary || '(No title)'}
          </Text>
        </View>
      ))}
      {remaining > 0 && (
        <Text style={styles.more} testID="gcal-agenda-more">
          +{remaining} more
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(1.5) },
  empty: { paddingVertical: theme.spacing(2) },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  time: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    width: 64,
  },
  title: { color: theme.colors.text, fontSize: 14, flexShrink: 1 },
  more: { color: theme.colors.textMuted, fontSize: 12, paddingTop: theme.spacing(0.5) },
}));
