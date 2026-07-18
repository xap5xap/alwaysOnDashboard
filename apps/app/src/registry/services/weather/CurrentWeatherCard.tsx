// The "Current Weather" leaf renderer — the TRANSIT face (AOD-132; design-color-law.md §4-5/§7,
// claude-design/prompts/weather.md, the RB-M2 run book §5). Reached only on data-bearing lifecycle
// states; the generic host draws every other state's chrome. It receives only { data, config, size, box }
// and never branches on auth, loading, or errors. A connected location always has current conditions, so
// there is no empty state (§4.1). Units are echoed from the payload, so an imperial future needs no change.
//
// Transit is the ambient weather hero across FOUR sizes (was S/W only). The card wears a muted CONDITION
// PANE — one flat deep pane of the current sky (theme.pane[key], the §5/§9 one-surface exception, Weather
// only) — composited behind the figures by this leaf (it is not in the Weather Eye PDF; runbook §5 flag a).
// The figures wear the DATA's hue (1C, colour-law §4): the temperature runs the 8-stop thermometer
// (theme.temp, blended by °C at the draw site); the condition GLYPH stays bone (carried by SHAPE, never a
// tint); a gold sun-mark rides a sunrise→sunset arc — a full CURVE at L, a flat WATERLINE at W/M, ABSENT at
// S — and at night the sun-mark drops below the line as a gold moon crescent (§7). Colour binds to ROLES
// only, so Monochrome collapses the pane to the ordinary surface and every hue to bone for free (§8).
//
// The arc is STATIC-per-render (the sun position is computed once from now vs sunrise/sunset; the ambient
// life is the ~15-min refresh re-render, not an Animated loop — see TransitArc). Truncation obeys the
// FitBody philosophy: wind → humidity → feels → condition give way before the temperature or the glyph.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { CurrentWeatherData, WeatherCondition } from './types';
import { WeatherIcon } from './WeatherIcon';
import { TransitArc } from './TransitArc';
import { FitBody } from '../../../widgets/FitBody';
import { tabularWidth, fitValueScale, DEFAULT_MIN_SCALE } from '../../../widgets/fitLadder';
import { SIZE_CATALOGUE } from '../../../widgets/sizes';
import { UNIT_PX } from '../../../layout/geometry';
import { paneKeyFor, sunFraction, tempColor } from './transit';

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
    sunrise: typeof d.sunrise === 'string' ? d.sunrise : '',
    sunset: typeof d.sunset === 'string' ? d.sunset : '',
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

/** Width-fit a temperature string to the room a hand-rolled row leaves it (the FitBody primitives, reused
 *  outside FitBody's vertical stack for the W banner + the L hero row). Never below the legibility floor. */
function fitTempSize(text: string, base: number, availW: number, availH: number): number {
  const scale = fitValueScale(
    { width: tabularWidth(text, base), height: base * 1.18 },
    { width: Math.max(1, availW), height: Math.max(1, availH) },
    DEFAULT_MIN_SCALE,
  );
  return base * scale;
}

export function CurrentWeatherCard({ data, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const c = asCurrent(data);
  const unit = c.units.temperature;
  const tempText = `${Math.round(c.temperature)}${unit}`;
  const isDay = c.condition.isDay;
  const heroSize = theme.type.hero.fontSize ?? 44;

  // §5 the condition pane (Weather only): a flat deep pane of the current sky, bound to the role.
  const paneKey = paneKeyFor(c.condition.group, c.condition.code, isDay);
  const pane = theme.pane[paneKey];
  const paneBg = pane.bg;
  // §4 the thermometer temperature colour (role blend; bone under Monochrome).
  const tColor = tempColor(c.temperature, theme.temp);
  // The sun's honest position, computed ONCE this render (no loop); null degrades to no sun-mark.
  const fraction = sunFraction(c.sunrise, c.sunset, Date.now());
  // §7 the moon draws in the clear-night pane's gold, else the neutral moon ink.
  const moonColor = paneKey === 'clearNight' ? theme.pane.clearNight.moon : theme.ink.moon;

  // The body box the host computed (DP). Fall back to the slot geometry for a direct render / test w/o box.
  const cat = SIZE_CATALOGUE[size];
  const contentW = box?.width ?? Math.max(1, cat.nominalW * UNIT_PX - 2 * theme.spacing(3));
  const contentH =
    box?.height ??
    Math.max(1, cat.nominalH * UNIT_PX - 2 * theme.spacing(3) - (size === 'S' ? 0 : 24));

  // The condition glyph: bone (colour carried by SHAPE), its cloud occlusion filled with the PANE bg so it
  // reads cleanly against the sky (was colors.surface). Day/night from the payload's own isDay (§5.2).
  const glyph = (px: number) => (
    <WeatherIcon
      group={c.condition.group}
      isDay={isDay}
      size={px}
      color={theme.colors.text}
      surface={paneBg}
      strokeWidth={theme.weatherIcon.stroke}
    />
  );

  const tempNode = (fontSize: number) => (
    <Text style={[styles.tempBase, { fontSize, color: tColor }]} testID="weather-current-temp" numberOfLines={1}>
      {tempText}
    </Text>
  );

  // The pane background: absolute, bled by the card padding (theme.spacing(3)) to the card's inner edge,
  // where the host card's overflow:hidden + radius clip it — so the card "wears" the pane without a host
  // edit (the leaf composites it, runbook §5). pointerEvents none: purely a field behind the figures.
  const paneBackground = (
    <View testID="weather-current-pane" pointerEvents="none" style={[styles.pane, { backgroundColor: paneBg }]} />
  );

  const arc = (variant: 'curve' | 'waterline', height: number) => (
    <TransitArc
      variant={variant}
      width={contentW}
      height={height}
      isDay={isDay}
      fraction={fraction}
      lineColor={pane.line}
      sunColor={theme.ink.sun}
      moonColor={moonColor}
      paneBg={paneBg}
      stroke={theme.transit.stroke}
      sunRadius={theme.transit.sunRadius}
      moonRadius={theme.transit.moonRadius}
      inset={theme.transit.inset}
    />
  );

  const conditionLine = (
    <Text style={styles.condition} numberOfLines={1} testID="weather-current-condition">
      {c.condition.label}
    </Text>
  );
  const metaLine = (
    <Text style={styles.meta} numberOfLines={1} testID="weather-current-meta">
      Feels {Math.round(c.apparentTemperature)}° · {c.humidityPct}% · {Math.round(c.windSpeed)}{' '}
      {c.units.windSpeed} {compass(c.windDirectionDeg)}
    </Text>
  );

  // S (1×1): the self-evident glance is glyph over temperature (host suppresses the header). Arc absent;
  // the pane still wears the sky. The shared FitBody holds the icon as a lead and WIDTH-FITS the temp.
  if (size === 'S') {
    return (
      <View style={[styles.root, { minHeight: contentH }]} testID="weather-current" accessibilityRole="summary">
        {paneBackground}
        <FitBody
          size={size}
          box={box}
          headerShown={false}
          glance
          lead={{ key: 'icon', role: 'display', node: glyph(theme.weatherIcon.currentSmall), height: theme.weatherIcon.currentSmall }}
          value={{ key: 'temp', baseSize: heroSize, intrinsicWidth: tabularWidth(tempText, heroSize), render: tempNode }}
          gap={theme.spacing(1)}
        />
      </View>
    );
  }

  // W (2×1): the banner. temp + glyph lead on the left; condition + meta alongside on the right; a flat
  // waterline runs along the bottom. The wide-short reflow the AOD-123 audit flagged as an M2/M4 decision.
  if (size === 'W') {
    const glyphPx = theme.weatherIcon.currentSmall;
    const gap = theme.spacing(2);
    // Reserve a truncatable column for the detail (condition + meta); THAT column shrinks first, never the
    // temperature (color-law / FitBody truncation order). The temp+glyph lead is flexShrink:0 below, so the
    // font sized here to the ACTUAL remaining width (not a hardcoded half) is the temp's final width — the
    // flex row can no longer squeeze it into a one-glyph clip.
    const rightMin = 72;
    const bannerH = Math.max(24, contentH - theme.transit.waterlineHeight - theme.spacing(1));
    const tempW = fitTempSize(tempText, heroSize, Math.max(1, contentW - glyphPx - rightMin - gap * 2), bannerH);
    return (
      <View style={[styles.root, styles.stack, { minHeight: contentH }]} testID="weather-current" accessibilityRole="summary">
        {paneBackground}
        <View style={styles.bannerRow}>
          <View style={styles.leftGroup}>
            {tempNode(tempW)}
            {glyph(theme.weatherIcon.currentSmall)}
          </View>
          <View style={styles.rightGroup}>
            {conditionLine}
            {metaLine}
          </View>
        </View>
        {arc('waterline', theme.transit.waterlineHeight)}
      </View>
    );
  }

  // L (2×2): the wall hero. Glyph + temperature commanding on one row, the condition + meta below, and the
  // full curved sunrise→sunset arc anchored to the bottom. The one read from across a room.
  if (size === 'L') {
    const tempW = fitTempSize(tempText, heroSize, contentW - theme.weatherIcon.currentHero - theme.spacing(2), heroSize * 1.18);
    return (
      <View style={[styles.root, styles.stack, { minHeight: contentH }]} testID="weather-current" accessibilityRole="summary">
        {paneBackground}
        <View style={styles.heroGroup}>
          <View style={styles.heroRow}>
            {tempNode(tempW)}
            {glyph(theme.weatherIcon.currentHero)}
          </View>
          {conditionLine}
          {metaLine}
        </View>
        {arc('curve', theme.transit.arcHeight)}
      </View>
    );
  }

  // M (1×2): a vertical stack — glyph + temp, the condition, the feels/humidity/wind line — over a flat
  // waterline. FitBody fits the value + truncate-then-drops the detail within the room above the arc.
  const fitBoxM = { width: contentW, height: Math.max(1, contentH - theme.transit.waterlineHeight - theme.spacing(1)) };
  return (
    <View style={[styles.root, styles.stack, { minHeight: contentH }]} testID="weather-current" accessibilityRole="summary">
      {paneBackground}
      <FitBody
        size={size}
        box={fitBoxM}
        lead={{ key: 'icon', role: 'display', node: glyph(theme.weatherIcon.currentSmall), height: theme.weatherIcon.currentSmall }}
        value={{ key: 'temp', baseSize: heroSize, intrinsicWidth: tabularWidth(tempText, heroSize), render: tempNode }}
        detail={[
          { key: 'condition', role: 'heading', node: conditionLine },
          { key: 'meta', role: 'meta', node: metaLine },
        ]}
      />
      {arc('waterline', theme.transit.waterlineHeight)}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // position:relative anchors the absolute pane; NO overflow here — the host card clips the pane bleed.
  root: { position: 'relative' },
  // fill: figures at the top, the arc pinned to the bottom (M/W/L). S centres its glance via FitBody.
  stack: { flexDirection: 'column', justifyContent: 'space-between' },
  pane: {
    position: 'absolute',
    top: -theme.spacing(3),
    left: -theme.spacing(3),
    right: -theme.spacing(3),
    bottom: -theme.spacing(3),
  },
  heroGroup: { gap: theme.spacing(1) },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  // the temp+glyph lead NEVER shrinks (flexShrink 0), so the row can't squeeze the fitted temp into a clip;
  // the detail column is the flexible one (flex 1 + minWidth 0) so condition/meta truncate first instead.
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), flexShrink: 0 },
  rightGroup: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: theme.spacing(0.5) },
  // the temperature: type.hero geometry; the colour is applied INLINE (the data hue / the tempColor blend).
  tempBase: { ...theme.type.hero },
  // the condition label stays bone (the glyph carries the condition by shape; no accent tint — colour-law).
  condition: { ...theme.type.heading, color: theme.colors.text },
  meta: { ...theme.type.meta, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
}));
