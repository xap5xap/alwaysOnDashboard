// The "Current Weather" leaf renderer (AOD-8 §6.1, integration-weather.md §4.1, design-calendar-weather.md
// §5). Reached only on data-bearing lifecycle states; the generic host draws every other state's chrome.
// It receives only { data, config, size } and never branches on auth, loading, or errors. A connected
// location always has current conditions, so there is no empty state (§4.1). Units are echoed from the
// payload, so an imperial future (§10) needs no renderer change.
//
// AOD-35 polish: the value-first body. The temperature is the type.hero value with tabular-nums; the
// condition icon (WeatherIcon, §4) joins it at the bright colors.text tier; the condition label is the
// one accent line (type.heading); feels/humidity/wind recede as one muted type.meta line. At S (the
// 1x1 glance, header suppressed by the host) the body is just icon over temperature. The icon's day/night
// comes from the PAYLOAD (condition.isDay -> sun vs moon); the card's night DIM is the host's ambient
// overlay (Weather is overlay-default, not the Clock's deep-red opt-in) -- two independent signals (§5.2).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CurrentWeatherData, WeatherCondition } from './types';
import { WeatherIcon } from './WeatherIcon';
import { FitBody } from '../../../widgets/FitBody';
import { tabularWidth } from '../../../widgets/fitLadder';

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

export function CurrentWeatherCard({ data, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const c = asCurrent(data);
  const unit = c.units.temperature;
  const isSmall = size === 'S'; // AOD-122 slot id (was 'small'; same 1x1 geometry)

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

  const tempText = `${Math.round(c.temperature)}${unit}`;

  // S (1x1): the self-evident glance is icon over temperature (the host suppresses the header at S).
  // AOD-123: the fixed hero temp overflowed the 72px cell (e.g. "18°C" is ~110px at 44px, and icon+temp
  // was ~91px tall in a 72px body). The shared FitBody holds the icon as a lead and WIDTH-FITS the temp
  // into the space left, so the glance never clips either axis. No condition label, no meta (§4.1).
  if (isSmall) {
    const heroSize = theme.type.hero.fontSize ?? 44;
    return (
      <FitBody
        size={size}
        box={box}
        headerShown={false}
        glance
        lead={{ key: 'icon', role: 'display', node: icon, height: theme.weatherIcon.currentSmall }}
        value={{
          key: 'temp',
          baseSize: heroSize,
          intrinsicWidth: tabularWidth(tempText, heroSize),
          render: (fontSize) => (
            <Text style={[styles.temp, { fontSize }]} testID="weather-current-temp">
              {tempText}
            </Text>
          ),
        }}
        gap={theme.spacing(1)}
        testID="weather-current"
        accessibilityRole="summary"
      />
    );
  }

  const temp = (
    <Text style={styles.temp} testID="weather-current-temp">
      {tempText}
    </Text>
  );

  // W (2x1, and any other coerced slot): temperature + icon on the value row, the accent condition
  // line, then the muted meta. NOTE (AOD-123 audit): W keeps this row renderer; its temp+icon row fills
  // the 1-unit (48px) body, so the condition + meta below can still clip. A wide-short W that seats all
  // four elements needs a horizontal reflow (temp+icon left, condition/meta right) — an M4 face decision,
  // not a fit-mechanism one (flagged in the report). The smallest supported size (S) is fixed above.
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
