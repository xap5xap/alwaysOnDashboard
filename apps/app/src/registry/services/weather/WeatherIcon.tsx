// The weather icon set (design-calendar-weather.md §4), the bespoke centerpiece of the AOD-35 polish.
// Eight monochrome line glyphs, one per WeatherGroup the payload carries, plus three night variants:
// clear / cloudy / showers swap the sun for a crescent moon on condition.isDay; the five overcast or
// precipitating groups (fog / drizzle / rain / snow / thunderstorm) are isDay-invariant. Forecast days
// carry isDay = true (§4.2), so a forecast always uses the day form.
//
// Drawn in the AOD-37 chrome-glyph family: line glyphs in colors.text (the caller passes it), stroke 2
// (the weatherIcon token), round caps/joins, non-scaling-stroke so the stroke stays uniform whatever the
// per-context size and the inner scale transforms. The condition reads by SHAPE, never colour, so the
// temperature stays the one bright value and no icon tint collides with the amber stale dot or the blue
// accent (§4.1). The partly-cloud occludes the sun/moon behind it with a colors.surface fill (the caller
// passes the card fill), so the celestial element reads cleanly behind the cloud. The path data is the
// frozen design's, verbatim from assets/design-weather-icons.svg, in a 24x24 box centred on (12, 12).
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { WeatherGroup } from './types';

export interface WeatherIconProps {
  group: WeatherGroup;
  isDay: boolean;
  /** Rendered px (the weatherIcon size ramp: currentHero 44 / currentSmall 34 / forecastStrip 30 / forecastRow 22). */
  size: number;
  /** The glyph stroke colour (colors.text); the condition is carried by shape, not colour. */
  color: string;
  /** The card fill (colors.surface), used to occlude the sun/moon behind a cloud. */
  surface: string;
  /** The weatherIcon stroke token (2). */
  strokeWidth?: number;
  /** Overrides the default `weather-icon-{group}-{day|night}` testID (used to assert the day/night swap). */
  testID?: string;
}

// The two cloud silhouettes the set reuses: the higher one sits behind a sun/moon (cloudy/showers); the
// lower one is the standalone precip cloud (fog/drizzle/rain/snow/thunderstorm).
const CLOUD_BEHIND = 'M18 11h-1.26A8 8 0 1 0 9 21h9a5 5 0 0 0 0-10z';
const CLOUD_PRECIP = 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z';
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z';

export function WeatherIcon({ group, isDay, size, color, surface, strokeWidth = 2, testID }: WeatherIconProps) {
  // Shared stroke props for every line element (matches the mockup's `.gly` class). fill defaults to
  // none; a filled cloud overrides it with the surface colour to occlude the celestial element.
  const s = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
    fill: 'none' as const,
  };

  // The big full sun (clear-day): a centred disc with eight rays.
  const sun = (
    <>
      <Circle cx={12} cy={12} r={4.4} {...s} />
      <Line x1={12} y1={1.6} x2={12} y2={4.2} {...s} />
      <Line x1={12} y1={19.8} x2={12} y2={22.4} {...s} />
      <Line x1={1.6} y1={12} x2={4.2} y2={12} {...s} />
      <Line x1={19.8} y1={12} x2={22.4} y2={12} {...s} />
      <Line x1={4.6} y1={4.6} x2={6.5} y2={6.5} {...s} />
      <Line x1={17.5} y1={17.5} x2={19.4} y2={19.4} {...s} />
      <Line x1={4.6} y1={19.4} x2={6.5} y2={17.5} {...s} />
      <Line x1={17.5} y1={6.5} x2={19.4} y2={4.6} {...s} />
    </>
  );

  // A small sun tucked behind the cloud (cloudy-day), five short rays.
  const smallSunCloudy = (
    <G transform="translate(8 7.5)">
      <Circle cx={0} cy={0} r={2.5} {...s} />
      <Line x1={0} y1={-5.6} x2={0} y2={-3.8} {...s} />
      <Line x1={-5.6} y1={0} x2={-3.8} y2={0} {...s} />
      <Line x1={-4} y1={-4} x2={-2.7} y2={-2.7} {...s} />
      <Line x1={-4} y1={4} x2={-2.7} y2={2.7} {...s} />
      <Line x1={4} y1={-4} x2={2.7} y2={-2.7} {...s} />
    </G>
  );

  // A slightly smaller sun behind the showers cloud (showers-day), four rays.
  const smallSunShowers = (
    <G transform="translate(8 7)">
      <Circle cx={0} cy={0} r={2.3} {...s} />
      <Line x1={0} y1={-5.2} x2={0} y2={-3.6} {...s} />
      <Line x1={-5.2} y1={0} x2={-3.6} y2={0} {...s} />
      <Line x1={-3.7} y1={-3.7} x2={-2.5} y2={-2.5} {...s} />
      <Line x1={3.7} y1={-3.7} x2={2.5} y2={-2.5} {...s} />
    </G>
  );

  // Three snowflakes (a touch thinner, matching the mockup's 1.5 override).
  const flake = (tx: number, ty: number) => (
    <G transform={`translate(${tx} ${ty})`}>
      <Line x1={0} y1={-1.6} x2={0} y2={1.6} {...s} strokeWidth={1.5} />
      <Line x1={-1.4} y1={-0.8} x2={1.4} y2={0.8} {...s} strokeWidth={1.5} />
      <Line x1={-1.4} y1={0.8} x2={1.4} y2={-0.8} {...s} strokeWidth={1.5} />
    </G>
  );

  let body: React.ReactNode;
  switch (group) {
    case 'clear':
      body = isDay ? sun : <Path d={MOON} {...s} />;
      break;
    case 'cloudy':
      body = (
        <>
          {isDay ? (
            smallSunCloudy
          ) : (
            <Path d={MOON} transform="translate(8 7.6) scale(0.46) translate(-12 -12)" {...s} />
          )}
          <Path d={CLOUD_BEHIND} transform="translate(1.5 -1) scale(0.84)" {...s} fill={surface} />
        </>
      );
      break;
    case 'showers':
      body = (
        <>
          {isDay ? (
            smallSunShowers
          ) : (
            <Path d={MOON} transform="translate(8 7.1) scale(0.42) translate(-12 -12)" {...s} />
          )}
          <Path d={CLOUD_BEHIND} transform="translate(2 -1.6) scale(0.78)" {...s} fill={surface} />
          <Line x1={9.5} y1={16.6} x2={7.4} y2={22} {...s} />
          <Line x1={15} y1={16.6} x2={12.9} y2={22} {...s} />
        </>
      );
      break;
    case 'fog':
      body = (
        <>
          <Path d={CLOUD_PRECIP} transform="translate(1.8 -3.4) scale(0.78)" {...s} />
          <Line x1={5.5} y1={17.4} x2={16.5} y2={17.4} {...s} />
          <Line x1={7} y1={20} x2={18.5} y2={20} {...s} />
          <Line x1={5.5} y1={22.4} x2={14.5} y2={22.4} {...s} />
        </>
      );
      break;
    case 'drizzle':
      body = (
        <>
          <Path d={CLOUD_PRECIP} transform="translate(1.8 -3.4) scale(0.78)" {...s} />
          <Line x1={8.5} y1={16.8} x2={7.8} y2={18.8} {...s} />
          <Line x1={12.5} y1={16.8} x2={11.8} y2={18.8} {...s} />
          <Line x1={16.5} y1={16.8} x2={15.8} y2={18.8} {...s} />
        </>
      );
      break;
    case 'rain':
      body = (
        <>
          <Path d={CLOUD_PRECIP} transform="translate(1.8 -3.4) scale(0.78)" {...s} />
          <Line x1={8.6} y1={16.4} x2={6.9} y2={21.2} {...s} />
          <Line x1={12.6} y1={16.4} x2={10.9} y2={21.2} {...s} />
          <Line x1={16.6} y1={16.4} x2={14.9} y2={21.2} {...s} />
        </>
      );
      break;
    case 'snow':
      body = (
        <>
          <Path d={CLOUD_PRECIP} transform="translate(1.8 -3.4) scale(0.78)" {...s} />
          {flake(7.8, 18)}
          {flake(16.2, 18)}
          {flake(12, 21.6)}
        </>
      );
      break;
    case 'thunderstorm':
      body = (
        <>
          <Path d={CLOUD_PRECIP} transform="translate(1.8 -3.6) scale(0.78)" {...s} />
          <Path d="M13.4 15.6 L9.6 20.2 H12.2 L10.6 23.4" {...s} />
        </>
      );
      break;
    default:
      body = isDay ? sun : <Path d={MOON} {...s} />;
  }

  // The testID/a11y label ride a wrapping View (reliably queryable; it also lets a test assert the
  // day/night swap by `weather-icon-{group}-{day|night}`). The View sizes to the fixed-size Svg.
  return (
    <View
      testID={testID ?? `weather-icon-${group}-${isDay ? 'day' : 'night'}`}
      accessibilityLabel={group}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {body}
      </Svg>
    </View>
  );
}
