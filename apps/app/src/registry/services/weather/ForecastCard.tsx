// The "Forecast" leaf renderer (AOD-8 §6.1, integration-weather.md §4.2, design-calendar-weather.md §6).
// Reached only on data-bearing lifecycle states; the host draws every other state. Receives only
// { data, config, size }. The server zips the columnar daily arrays into ForecastDay rows (§6.1); this
// card lays them out today first, scoped to the widget size. The weekday label is computed against the
// DEVICE clock (the date strings are local, §4.2).
//
// AOD-35 polish: one payload, two layouts. At W (2x1; the banner layout the retired 3x1 wide slot wore
// pre-AOD-122) a STRIP of day columns (weekday / day-form icon / hi over lo / precip); at L a row LIST
// under the quiet header (weekday / icon / condition + precip / right-aligned hi-lo). The high is the
// bright figure (colors.text), the low recedes (colors.textMuted), both tabular so the column aligns;
// Today is bright and later weekdays recede (the relative-time emphasis). Forecast days always use the
// day form (§4.2). Precip shows in accent at W, muted at L, and is omitted when null. The degree string
// is echoed from the payload units (§6.2).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import type { ForecastData, ForecastDay, WeatherCondition } from './types';
import { WeatherIcon } from './WeatherIcon';

// How many days fit a glance at each slot. Forecast ships at W/L; S/M are defensive defaults so the
// card never reads an undefined count if mounted at an unexpected size. AOD-122 remap: W (2x1) takes
// the old 2x1 medium count (4 — the 3x1 banner's 5 columns don't fit a 2-unit width); L keeps the old
// large 7; S the old small 3; M (1x2) the old tall 7.
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = { S: 3, M: 7, W: 4, L: 7 };
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

/** Whether a "YYYY-MM-DD" is the current device-local day (Today gets the bright emphasis). */
function isToday(date: string, now: Date): boolean {
  const d = parseLocalYmd(date);
  return (
    !!d &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** "Today" for the current device-local day, else a short weekday ("Mon"). */
function dayLabel(date: string, now: Date): string {
  const d = parseLocalYmd(date);
  if (!d) return '';
  return isToday(date, now) ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function ForecastCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { days, units } = asForecast(data);
  const unit = units.temperature ?? '°';
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

  // Forecast days carry the day form (§4.2), so every icon is a day glyph.
  const icon = (group: WeatherCondition['group'], px: number) => (
    <WeatherIcon
      group={group}
      isDay
      size={px}
      color={theme.colors.text}
      surface={theme.colors.surface}
      strokeWidth={theme.weatherIcon.stroke}
    />
  );

  // W (2x1): the banner strip. Day columns left to right; weekday / icon / hi-lo / precip stacked.
  if (size === 'W') {
    return (
      <View style={styles.strip} accessibilityRole="summary" testID="weather-forecast">
        {visible.map((day) => {
          const condition = day.condition ?? FALLBACK_CONDITION;
          const today = isToday(day.date, now);
          return (
            <View key={day.date} style={styles.col}>
              <Text style={[styles.day, today ? styles.dayToday : styles.dayMuted]} numberOfLines={1}>
                {dayLabel(day.date, now)}
              </Text>
              {icon(condition.group, theme.weatherIcon.forecastStrip)}
              <Text style={styles.temps} numberOfLines={1}>
                <Text style={styles.hi}>{Math.round(day.tempMax)}{unit}</Text>
                {'  '}
                <Text style={styles.lo}>{Math.round(day.tempMin)}{unit}</Text>
              </Text>
              {day.precipProbabilityPct != null ? (
                <Text style={styles.precipWide} numberOfLines={1}>
                  {day.precipProbabilityPct}%
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  // L (and any other coerced slot): the row list under the quiet header.
  return (
    <View style={styles.list} accessibilityRole="summary" testID="weather-forecast">
      {visible.map((day) => {
        const condition = day.condition ?? FALLBACK_CONDITION;
        const today = isToday(day.date, now);
        const precip = day.precipProbabilityPct != null ? ` · ${day.precipProbabilityPct}%` : '';
        return (
          <View key={day.date} style={styles.row}>
            <Text style={[styles.day, styles.dayRow, today ? styles.dayToday : styles.dayMuted]} numberOfLines={1}>
              {dayLabel(day.date, now)}
            </Text>
            {icon(condition.group, theme.weatherIcon.forecastRow)}
            <Text style={styles.condRow} numberOfLines={1}>
              {condition.label}
              {precip}
            </Text>
            <Text style={styles.tempsRow} numberOfLines={1}>
              <Text style={styles.hi}>{Math.round(day.tempMax)}{unit}</Text>
              {'  '}
              <Text style={styles.lo}>{Math.round(day.tempMin)}{unit}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  empty: { paddingVertical: theme.spacing(2) },
  emptyText: { ...theme.type.body, color: theme.colors.textMuted },

  // W banner strip
  strip: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 },
  col: { flex: 1, alignItems: 'center', gap: theme.spacing(1.5) },

  // L row list
  list: { gap: theme.spacing(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },

  // weekday: Today bright, later days recede (the relative-time emphasis)
  day: { ...theme.type.label },
  dayRow: { width: 52 }, // fixed-width left column for the L row list; the strip column centres instead
  dayToday: { color: theme.colors.text },
  dayMuted: { color: theme.colors.textMuted },

  // hi (bright) / lo (muted), tabular so columns align
  temps: { ...theme.type.body, fontVariant: ['tabular-nums'], textAlign: 'center' },
  tempsRow: { ...theme.type.body, fontVariant: ['tabular-nums'], textAlign: 'right', minWidth: 64 },
  hi: { color: theme.colors.text },
  lo: { color: theme.colors.textMuted },

  // condition label (L only), with precip appended muted
  condRow: { ...theme.type.meta, color: theme.colors.textMuted, flexShrink: 1, flexGrow: 1 },

  // precip: accent at W (its own line), muted-appended at L (above)
  precipWide: {
    ...theme.type.caption,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
    color: theme.colors.accent,
  },
}));
