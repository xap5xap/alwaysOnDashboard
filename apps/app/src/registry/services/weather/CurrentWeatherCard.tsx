// The "Current Weather" leaf renderer (AOD-8 §6.1, integration-weather.md §4.1). Reached only on
// data-bearing lifecycle states; the generic host draws every other state's chrome. It receives only
// { data, config, size } and never branches on auth, loading, or errors. A connected location always
// has current conditions, so there is no empty state (§4.1). Units are echoed from the payload, so an
// imperial future (§10) needs no renderer change. Functional and on-brand-enough; the icon set and the
// day/night visual treatment are AOD-35.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CurrentWeatherData, WeatherCondition } from './types';

const FALLBACK_CONDITION: WeatherCondition = { code: -1, label: 'Unknown', group: 'cloudy', isDay: true };

/** Defensive read: a renderer must never crash on a partial payload (the host shows an empty card). */
function asCurrent(data: unknown): CurrentWeatherData {
  const d = (data ?? {}) as Partial<CurrentWeatherData>;
  const condition =
    d.condition && typeof d.condition === 'object' ? (d.condition as WeatherCondition) : FALLBACK_CONDITION;
  return {
    observedAt: typeof d.observedAt === 'string' ? d.observedAt : '',
    condition,
    temperature: typeof d.temperature === 'number' ? d.temperature : 0,
    apparentTemperature: typeof d.apparentTemperature === 'number' ? d.apparentTemperature : 0,
    humidityPct: typeof d.humidityPct === 'number' ? d.humidityPct : 0,
    windSpeed: typeof d.windSpeed === 'number' ? d.windSpeed : 0,
    windDirectionDeg: typeof d.windDirectionDeg === 'number' ? d.windDirectionDeg : 0,
    units: {
      temperature: d.units?.temperature ?? '°',
      windSpeed: d.units?.windSpeed ?? 'km/h',
      humidity: d.units?.humidity ?? '%',
    },
  };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** A coarse 8-point compass label for the wind direction (0-360). */
function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? 'N';
}

export function CurrentWeatherCard({ data }: WidgetRenderProps) {
  const c = asCurrent(data);
  const unit = c.units.temperature;

  return (
    <View style={styles.body} accessibilityRole="summary" testID="weather-current">
      <Text style={styles.temp} testID="weather-current-temp">
        {Math.round(c.temperature)}
        {unit}
      </Text>
      <Text style={styles.condition} numberOfLines={1} testID="weather-current-condition">
        {c.condition.label}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.metaItem} numberOfLines={1}>
          Feels like {Math.round(c.apparentTemperature)}
          {unit}
        </Text>
        <Text style={styles.metaItem} numberOfLines={1}>
          {c.humidityPct}
          {c.units.humidity} humidity
        </Text>
        <Text style={styles.metaItem} numberOfLines={1}>
          {Math.round(c.windSpeed)} {c.units.windSpeed} {compass(c.windDirectionDeg)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1) },
  temp: { color: theme.colors.text, fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  condition: { color: theme.colors.accent, fontSize: 15, fontWeight: '600' },
  meta: { gap: theme.spacing(0.5), paddingTop: theme.spacing(1) },
  metaItem: { color: theme.colors.textMuted, fontSize: 13 },
}));
