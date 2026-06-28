// The "Forecast" leaf renderer (AOD-8 §6.1, integration-weather.md §4.2). Reached only on data-bearing
// lifecycle states; the host draws every other state. Receives only { data, config, size }. The server
// zips the columnar daily arrays into ForecastDay rows (§6.1); this card lays them out, today first, and
// scopes how many rows show to the widget size. The weekday label is computed against the DEVICE clock
// (the date strings are local, §4.2). Functional and on-brand-enough; the icon set is AOD-35.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import type { ForecastData, ForecastDay, WeatherCondition } from './types';

// How many days fit a glance at each size. Forecast ships at wide/large; the others are defensive
// defaults so the card never reads an undefined count if mounted at an unexpected size.
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = { small: 3, medium: 4, wide: 5, large: 7, tall: 7 };
const FALLBACK_CONDITION: WeatherCondition = { code: -1, label: 'Unknown', group: 'cloudy', isDay: true };

/** Defensive read: a partial payload renders as the empty card, never a crash (§4.2). */
function asForecast(data: unknown): ForecastData {
  const d = (data ?? {}) as Partial<ForecastData>;
  const days = Array.isArray(d.days) ? (d.days as ForecastDay[]) : [];
  return { days, units: { temperature: d.units?.temperature ?? '°' } };
}

/** Parse "YYYY-MM-DD" as a LOCAL date so the weekday label matches the device-local day. */
function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "Today" for the current device-local day, else a short weekday ("Mon"). */
function dayLabel(date: string, now: Date): string {
  const d = parseLocalYmd(date);
  if (!d) return '';
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return 'Today';
  }
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function ForecastCard({ data, size }: WidgetRenderProps) {
  const { days, units } = asForecast(data);
  const now = new Date();
  const visible = days.slice(0, VISIBLE_BY_SIZE[size] ?? 5);

  if (visible.length === 0) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Text style={styles.emptyText} testID="weather-forecast-empty">
          No forecast
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list} accessibilityRole="summary" testID="weather-forecast">
      {visible.map((day) => {
        const condition = day.condition ?? FALLBACK_CONDITION;
        const precip = typeof day.precipProbabilityPct === 'number' ? ` · ${day.precipProbabilityPct}%` : '';
        return (
          <View key={day.date} style={styles.row}>
            <Text style={styles.day} numberOfLines={1}>
              {dayLabel(day.date, now)}
            </Text>
            <Text style={styles.condition} numberOfLines={1}>
              {condition.label}
              {precip}
            </Text>
            <Text style={styles.temps} numberOfLines={1}>
              <Text style={styles.tempMax}>{Math.round(day.tempMax)}°</Text>
              {' / '}
              <Text style={styles.tempMin}>{Math.round(day.tempMin)}°</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(1.5) },
  empty: { paddingVertical: theme.spacing(2) },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  day: { color: theme.colors.text, fontSize: 13, fontWeight: '700', width: 56 },
  condition: { color: theme.colors.textMuted, fontSize: 13, flexShrink: 1, flexGrow: 1 },
  temps: { fontSize: 13, fontVariant: ['tabular-nums'] },
  tempMax: { color: theme.colors.text, fontWeight: '600' },
  tempMin: { color: theme.colors.textMuted },
}));
