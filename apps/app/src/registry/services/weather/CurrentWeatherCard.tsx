// The "Current Weather" leaf renderer (AOD-8 §6.1, integration-weather.md §4.1, design-calendar-weather.md
// §5). Reached only on data-bearing lifecycle states; the generic host draws every other state's chrome.
// It receives only { data, config, size } and never branches on auth, loading, or errors. A connected
// location always has current conditions, so there is no empty state (§4.1). Units are echoed from the
// payload, so an imperial future (§10) needs no renderer change.
//
// AOD-35 polish: the value-first body. The temperature is the type.hero value with tabular-nums; the
// condition icon (WeatherIcon, §4) joins it at the bright colors.text tier; the condition label is the
// one accent line (type.heading); feels/humidity/wind recede as one muted type.meta line. At small (the
// 1x1 glance, header suppressed by the host) the body is just icon over temperature. The icon's day/night
// comes from the PAYLOAD (condition.isDay -> sun vs moon); the card's night DIM is the host's ambient
// overlay (Weather is overlay-default, not the Clock's deep-red opt-in) -- two independent signals (§5.2).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CurrentWeatherData, WeatherCondition } from './types';
import { WeatherIcon } from './WeatherIcon';

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

export function CurrentWeatherCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const c = asCurrent(data);
  const unit = c.units.temperature;
  const isSmall = size === 'small';

  // The condition icon, day or night by the payload's own isDay (the observation's local day/night), at
  // the size ramp's small or hero step. colors.text keeps it co-equal with the temperature value.
  const icon = (
    <WeatherIcon
      group={c.condition.group}
      isDay={c.condition.isDay}
      size={isSmall ? theme.weatherIcon.currentSmall : theme.weatherIcon.currentHero}
      color={theme.colors.text}
      surface={theme.colors.surface}
      strokeWidth={theme.weatherIcon.stroke}
    />
  );

  const temp = (
    <Text style={styles.temp} testID="weather-current-temp">
      {Math.round(c.temperature)}
      {unit}
    </Text>
  );

  // small (1x1): the self-evident glance is just icon over temperature (the host suppresses the header
  // at small). No condition label, no meta.
  if (isSmall) {
    return (
      <View style={styles.small} accessibilityRole="summary" testID="weather-current">
        {icon}
        {temp}
      </View>
    );
  }

  // medium (2x1): temperature + icon on the value row, the accent condition line, then the muted meta.
  return (
    <View style={styles.body} accessibilityRole="summary" testID="weather-current">
      <View style={styles.heroRow}>
        {temp}
        {icon}
      </View>
      <Text style={styles.condition} numberOfLines={1} testID="weather-current-condition">
        {c.condition.label}
      </Text>
      <Text style={styles.meta} numberOfLines={1} testID="weather-current-meta">
        Feels {Math.round(c.apparentTemperature)}° · {c.humidityPct}% · {Math.round(c.windSpeed)}{' '}
        {c.units.windSpeed} {compass(c.windDirectionDeg)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1) },
  small: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing(1) },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  temp: { ...theme.type.hero, color: theme.colors.text },
  condition: { ...theme.type.heading, color: theme.colors.accent },
  meta: { ...theme.type.meta, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
}));
